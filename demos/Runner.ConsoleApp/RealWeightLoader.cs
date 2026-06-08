using System.Buffers.Binary;
using System.IO.MemoryMappedFiles;
using System.Runtime.CompilerServices;
using System.Text.Json;
using Runner.ConsoleApp.Math;

namespace Runner.ConsoleApp;

/// <summary>
/// Loads real TinyLlama-1.1B (Llama architecture) weights from a HuggingFace
/// <c>model.safetensors</c> file into the demo's <see cref="ModelWeights"/> layout.
///
/// Two conventions must be reconciled with the demo transformer
/// (<c>MultiLayerTransformerWithKVCache</c>):
///
/// 1. The demo computes <c>x * W</c> (row-vector times matrix), so every PyTorch
///    Linear weight — stored as [out, in] — must be transposed to [in, out].
///
/// 2. The demo's RoPE is interleaved (GPT-J): it rotates consecutive dimension
///    pairs [2i, 2i+1] inside each head. HuggingFace stores Llama q_proj/k_proj
///    PERMUTED so that its split-half (NeoX) rotate_half reproduces the original
///    interleaved rotation. To feed those weights into interleaved RoPE we must
///    UN-PERMUTE q_proj and k_proj first (inverse of the HF Meta->NeoX permute).
/// </summary>
public static class RealWeightLoader
{
    /// <summary>Subset of model/config.json needed to build the weights.</summary>
    public sealed record LlamaConfig(
        int HiddenSize,
        int NumHiddenLayers,
        int NumAttentionHeads,
        int NumKeyValueHeads,
        int IntermediateSize,
        int VocabSize)
    {
        public int HeadDim => HiddenSize / NumAttentionHeads;
    }

    public static LlamaConfig LoadConfig(string configPath)
    {
        if (!File.Exists(configPath))
            throw new FileNotFoundException(
                $"Model config not found at '{configPath}'. Place TinyLlama's config.json there.",
                configPath);

        using JsonDocument doc = JsonDocument.Parse(File.ReadAllBytes(configPath));
        JsonElement root = doc.RootElement;

        int hidden = root.GetProperty("hidden_size").GetInt32();
        int heads = root.GetProperty("num_attention_heads").GetInt32();

        return new LlamaConfig(
            HiddenSize: hidden,
            NumHiddenLayers: root.GetProperty("num_hidden_layers").GetInt32(),
            NumAttentionHeads: heads,
            // num_key_value_heads is optional in Llama configs; default to heads (MHA).
            NumKeyValueHeads: root.TryGetProperty("num_key_value_heads", out var kv)
                ? kv.GetInt32()
                : heads,
            IntermediateSize: root.GetProperty("intermediate_size").GetInt32(),
            VocabSize: root.GetProperty("vocab_size").GetInt32());
    }

    /// <param name="modelDirectory">
    /// Directory containing <c>config.json</c> and <c>model.safetensors</c> (e.g. "model").
    /// </param>
    public static ModelWeights LoadWeights(string modelDirectory)
    {
        string configPath = Path.Combine(modelDirectory, "config.json");
        string weightsPath = Path.Combine(modelDirectory, "model.safetensors");

        if (!File.Exists(weightsPath))
            throw new FileNotFoundException(
                $"Model weights not found at '{weightsPath}'. " +
                "Download TinyLlama-1.1B-Chat-v1.0 'model.safetensors' from HuggingFace " +
                $"and place it in the '{modelDirectory}' directory.",
                weightsPath);

        LlamaConfig config = LoadConfig(configPath);

        using var safetensors = new SafeTensorsFile(weightsPath);

        int hidden = config.HiddenSize;
        int qHeads = config.NumAttentionHeads;
        int kvHeads = config.NumKeyValueHeads;
        int headDim = config.HeadDim;
        int kvDim = kvHeads * headDim;

        var layers = new LayerWeights[config.NumHiddenLayers];
        for (int i = 0; i < config.NumHiddenLayers; i++)
        {
            string p = $"model.layers.{i}.";

            // q_proj / k_proj: un-permute (inverse of HF Meta->NeoX) then transpose.
            float[][] q = safetensors.ReadMatrix(p + "self_attn.q_proj.weight", hidden, hidden);
            float[][] k = safetensors.ReadMatrix(p + "self_attn.k_proj.weight", kvDim, hidden);
            UnpermuteInPlace(q, qHeads);
            UnpermuteInPlace(k, kvHeads);

            layers[i] = new LayerWeights
            {
                AttentionNormWeight = safetensors.ReadVector(p + "input_layernorm.weight", hidden),
                FeedForwardNormWeight = safetensors.ReadVector(p + "post_attention_layernorm.weight", hidden),

                QueryProjection = Transpose(q, hidden, hidden),   // [hidden, hidden]
                KeyProjection = Transpose(k, kvDim, hidden),      // [hidden, kvDim]
                ValueProjection = Transpose(                      // [hidden, kvDim]
                    safetensors.ReadMatrix(p + "self_attn.v_proj.weight", kvDim, hidden), kvDim, hidden),
                OutputProjection = Transpose(                     // [hidden, hidden]
                    safetensors.ReadMatrix(p + "self_attn.o_proj.weight", hidden, hidden), hidden, hidden),

                GateProjection = Transpose(                       // [hidden, intermediate]
                    safetensors.ReadMatrix(p + "mlp.gate_proj.weight", config.IntermediateSize, hidden),
                    config.IntermediateSize, hidden),
                UpProjection = Transpose(                         // [hidden, intermediate]
                    safetensors.ReadMatrix(p + "mlp.up_proj.weight", config.IntermediateSize, hidden),
                    config.IntermediateSize, hidden),
                DownProjection = Transpose(                       // [intermediate, hidden]
                    safetensors.ReadMatrix(p + "mlp.down_proj.weight", hidden, config.IntermediateSize),
                    hidden, config.IntermediateSize),
            };
        }

        // embed_tokens stays [vocab, hidden] — used as a row lookup, no transpose.
        float[][] embed = safetensors.ReadMatrix("model.embed_tokens.weight", config.VocabSize, hidden);

        // lm_head [vocab, hidden] -> OutputEmbedding [hidden, vocab] (tie_word_embeddings=false).
        float[][] lmHead = safetensors.ReadMatrix("lm_head.weight", config.VocabSize, hidden);

        return new ModelWeights
        {
            NumberdOfQueryHeads = qHeads,
            NumberOfKeyValueHeads = kvHeads,
            HeadDimension = headDim,
            EmbeddedTokens = new Matrix(embed, config.VocabSize, hidden),
            Layers = layers,
            OutputEmbedding = Transpose(lmHead, config.VocabSize, hidden), // [hidden, vocab]
            FinalNormWeight = safetensors.ReadVector("model.norm.weight", hidden),
        };
    }

    /// <summary>
    /// Inverse of HuggingFace's Llama Meta->NeoX permutation, applied to a [out, in]
    /// weight (rows = out features) so the demo's interleaved RoPE sees the original
    /// interleaved layout.
    ///
    /// HF forward permute: view(nHeads, headDim/2, 2, in).transpose(1,2).reshape(out,in).
    /// The inverse therefore is:
    ///   view(nHeads, 2, headDim/2, in).transpose(1,2).reshape(out,in)
    /// i.e. for each head, the two halves [0..headDim/2) and [headDim/2..headDim) are
    /// interleaved back into consecutive pairs.
    /// </summary>
    private static void UnpermuteInPlace(float[][] weight, int nHeads)
    {
        int outFeatures = weight.Length;
        int rowsPerHead = outFeatures / nHeads; // = headDim
        int half = rowsPerHead / 2;

        var reordered = new float[outFeatures][];
        for (int h = 0; h < nHeads; h++)
        {
            int baseRow = h * rowsPerHead;
            // Source layout within a head: [firstHalf rows (0..half), secondHalf rows (half..headDim)].
            // Destination: interleave them as pair (firstHalf[j], secondHalf[j]) -> rows 2j, 2j+1.
            for (int j = 0; j < half; j++)
            {
                reordered[baseRow + 2 * j] = weight[baseRow + j];
                reordered[baseRow + 2 * j + 1] = weight[baseRow + half + j];
            }
        }

        Array.Copy(reordered, weight, outFeatures);
    }

    /// <summary>Transpose a row-major [rows, cols] weight into a Matrix [cols, rows].</summary>
    private static Matrix Transpose(float[][] src, int rows, int cols)
    {
        var data = new float[cols][];
        for (int j = 0; j < cols; j++)
        {
            var row = new float[rows];
            for (int i = 0; i < rows; i++)
                row[i] = src[i][j];
            data[j] = row;
        }

        return new Matrix(data, cols, rows);
    }

    /// <summary>
    /// Minimal safetensors reader. Format:
    ///   [8-byte little-endian u64 header length N][N-byte JSON header][raw tensor bytes].
    /// Tensor data_offsets in the header are relative to the start of the raw byte region.
    /// All TinyLlama tensors are BF16; each value is 2 bytes converted to float via
    /// (uint)bf16 &lt;&lt; 16 reinterpreted as float.
    /// </summary>
    private sealed class SafeTensorsFile : IDisposable
    {
        private readonly MemoryMappedFile _mmf;
        private readonly MemoryMappedViewAccessor _view;
        private readonly long _dataStart;
        private readonly Dictionary<string, TensorEntry> _tensors = new();

        private readonly record struct TensorEntry(string Dtype, int[] Shape, long Begin, long End);

        public SafeTensorsFile(string path)
        {
            long fileLength = new FileInfo(path).Length;
            _mmf = MemoryMappedFile.CreateFromFile(path, FileMode.Open, mapName: null, capacity: 0,
                MemoryMappedFileAccess.Read);
            _view = _mmf.CreateViewAccessor(0, 0, MemoryMappedFileAccess.Read);

            // Header length: first 8 bytes, little-endian u64.
            var lenBytes = new byte[8];
            _view.ReadArray(0, lenBytes, 0, 8);
            long headerLength = BinaryPrimitives.ReadInt64LittleEndian(lenBytes);
            if (headerLength <= 0 || 8 + headerLength > fileLength)
                throw new InvalidDataException($"Invalid safetensors header length {headerLength}.");

            _dataStart = 8 + headerLength;

            var headerBytes = new byte[headerLength];
            _view.ReadArray(8, headerBytes, 0, (int)headerLength);

            using JsonDocument header = JsonDocument.Parse(headerBytes);
            foreach (JsonProperty prop in header.RootElement.EnumerateObject())
            {
                if (prop.NameEquals("__metadata__")) continue;

                string dtype = prop.Value.GetProperty("dtype").GetString()!;
                int[] shape = prop.Value.GetProperty("shape")
                    .EnumerateArray().Select(e => e.GetInt32()).ToArray();
                JsonElement offsets = prop.Value.GetProperty("data_offsets");
                long begin = offsets[0].GetInt64();
                long end = offsets[1].GetInt64();

                _tensors[prop.Name] = new TensorEntry(dtype, shape, begin, end);
            }
        }

        // Returns raw [rows, cols] data so the loader can un-permute / transpose before
        // wrapping in a Matrix.
        public float[][] ReadMatrix(string name, int rows, int cols)
        {
            TensorEntry entry = Lookup(name);
            if (entry.Shape.Length != 2 || entry.Shape[0] != rows || entry.Shape[1] != cols)
                throw new InvalidDataException(
                    $"Tensor '{name}' shape [{string.Join(",", entry.Shape)}] != expected [{rows},{cols}].");

            float[] flat = ReadBf16(entry, (long)rows * cols);
            var data = new float[rows][];
            for (int r = 0; r < rows; r++)
            {
                var row = new float[cols];
                Array.Copy(flat, (long)r * cols, row, 0, cols);
                data[r] = row;
            }

            return data;
        }

        public Vector ReadVector(string name, int length)
        {
            TensorEntry entry = Lookup(name);
            if (entry.Shape.Length != 1 || entry.Shape[0] != length)
                throw new InvalidDataException(
                    $"Tensor '{name}' shape [{string.Join(",", entry.Shape)}] != expected [{length}].");

            float[] data = ReadBf16(entry, length);
            return new Vector(data, length);
        }

        private TensorEntry Lookup(string name)
        {
            if (!_tensors.TryGetValue(name, out TensorEntry entry))
                throw new KeyNotFoundException($"Tensor '{name}' not found in safetensors file.");
            return entry;
        }

        private float[] ReadBf16(TensorEntry entry, long expectedCount)
        {
            if (entry.Dtype != "BF16")
                throw new NotSupportedException(
                    $"Tensor dtype '{entry.Dtype}' not supported (only BF16).");

            long byteCount = entry.End - entry.Begin;
            if (byteCount != expectedCount * 2)
                throw new InvalidDataException(
                    $"Tensor byte count {byteCount} != expected {expectedCount * 2} (BF16).");

            // Largest TinyLlama tensor is embed_tokens (32000*2048*2 = ~131MB), well under int.MaxValue.
            if (byteCount > int.MaxValue)
                throw new NotSupportedException($"Tensor too large to read in one buffer: {byteCount} bytes.");

            int count = (int)expectedCount;
            var raw = new byte[(int)byteCount];
            _view.ReadArray(_dataStart + entry.Begin, raw, 0, raw.Length);

            var result = new float[count];
            for (int i = 0; i < count; i++)
            {
                ushort bf16 = (ushort)(raw[i * 2] | (raw[i * 2 + 1] << 8)); // little-endian
                uint bits = (uint)bf16 << 16;
                result[i] = Unsafe.As<uint, float>(ref bits);
            }

            return result;
        }

        public void Dispose()
        {
            _view.Dispose();
            _mmf.Dispose();
        }
    }
}
