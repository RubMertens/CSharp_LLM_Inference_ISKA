using System.Runtime.InteropServices;
using System.Text.Json;

namespace Runner.ConsoleApp.Completed.Model;

public class SafetensorsReader : IDisposable
{
    private readonly FileStream _stream;
    private readonly long _dataStart;
    private readonly Dictionary<string, TensorMeta> _tensors = new();

    public SafetensorsReader(string filePath)
    {
        _stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read);

        Span<byte> headerSizeBytes = stackalloc byte[8];
        _stream.ReadExactly(headerSizeBytes);
        var headerSize = (long)BitConverter.ToUInt64(headerSizeBytes);

        var headerBytes = new byte[headerSize];
        _stream.ReadExactly(headerBytes);
        _dataStart = 8 + headerSize;

        using var doc = JsonDocument.Parse(headerBytes);
        foreach (var prop in doc.RootElement.EnumerateObject())
        {
            if (prop.Name == "__metadata__")
                continue;

            var dtype = prop.Value.GetProperty("dtype").GetString()!;
            var shapeArr = prop.Value.GetProperty("shape");
            var shape = new int[shapeArr.GetArrayLength()];
            for (int i = 0; i < shape.Length; i++)
                shape[i] = shapeArr[i].GetInt32();

            var offsetsArr = prop.Value.GetProperty("data_offsets");
            var offsets = new long[] { offsetsArr[0].GetInt64(), offsetsArr[1].GetInt64() };

            _tensors[prop.Name] = new TensorMeta(dtype, shape, offsets);
        }
    }

    public float[] ReadTensor(string name)
    {
        if (!_tensors.TryGetValue(name, out var meta))
            throw new KeyNotFoundException($"Tensor '{name}' not found");

        if (meta.Dtype != "F32")
            throw new NotSupportedException($"Unsupported dtype '{meta.Dtype}', only F32 is supported");

        var byteCount = (int)(meta.DataOffsets[1] - meta.DataOffsets[0]);
        var bytes = new byte[byteCount];

        _stream.Seek(_dataStart + meta.DataOffsets[0], SeekOrigin.Begin);
        _stream.ReadExactly(bytes);

        var floats = new float[byteCount / sizeof(float)];
        MemoryMarshal.Cast<byte, float>(bytes).CopyTo(floats);
        return floats;
    }

    public bool HasTensor(string name) => _tensors.ContainsKey(name);

    public void Dispose() => _stream.Dispose();

    private sealed record TensorMeta(string Dtype, int[] Shape, long[] DataOffsets);
}
