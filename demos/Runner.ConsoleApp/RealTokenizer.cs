using Microsoft.ML.Tokenizers;

namespace Runner.ConsoleApp;

/// <summary>
/// Real SentencePiece BPE tokenizer for TinyLlama-1.1B-Chat-v1.0, backed by
/// Microsoft.ML.Tokenizers' <see cref="LlamaTokenizer"/>.
///
/// Mirrors the DemoTokenizer surface so it can be swapped into Program.cs:
///   - VocabularySize
///   - EndOfSequenceToken (2, "&lt;/s&gt;")
///   - int[] Tokenize(string)   -> ids WITH a leading BOS (1, "&lt;s&gt;")
///   - string Detokenize(int[])
///
/// Token ids match model/tokenizer_config.json: unk=0 "&lt;unk&gt;", bos=1 "&lt;s&gt;",
/// eos=2 "&lt;/s&gt;", tokenizer_class LlamaTokenizer.
/// </summary>
public class RealTokenizer
{
    private readonly LlamaTokenizer _tokenizer;

    public int VocabularySize { get; }
    public int EndOfSequenceToken { get; }

    /// <param name="modelPath">Path to the SentencePiece model (model/tokenizer.model).</param>
    public RealTokenizer(string modelPath)
    {
        using var modelStream = File.OpenRead(modelPath);

        // addBeginOfSentence defaults to true and addEndOfSentence to false, matching
        // the Llama default (add_bos_token). We pass them explicitly for clarity.
        _tokenizer = LlamaTokenizer.Create(
            modelStream,
            addBeginOfSentence: true,
            addEndOfSentence: false);

        VocabularySize = _tokenizer.Vocabulary.Count;
        EndOfSequenceToken = _tokenizer.EndOfSentenceId; // 2 ("</s>")
    }

    /// <summary>Encode text to token ids, prepending BOS ("&lt;s&gt;"=1) per Llama default.</summary>
    public int[] Tokenize(string input)
    {
        return _tokenizer.EncodeToIds(input).ToArray();
    }

    /// <summary>Decode token ids back to text.</summary>
    public string Detokenize(int[] tokenIds)
    {
        return _tokenizer.Decode(tokenIds);
    }
}
