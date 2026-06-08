namespace Runner.ConsoleApp;

public class DemoTokenizer
{
    public int VocabularySize => Vocabulary.Count;
    public int EndOfSequenceToken => Vocabulary["<eos>"];
    public Dictionary<string, int> Vocabulary { get; set; } = new Dictionary<string, int>()
{
    //special tokens

    {"<bos>", 0}, // beginning of sequence
    {"<eos>", 1}, // end of sequence
    {"<unk>", 2}, // unknown token (for out of vocabulary words)

    {"hello", 3},
    {"world", 4},
    {"this", 5},
    {"is", 6},
    {"a", 7},
    {"test", 8},
    {"tiny", 9},
    {"llm", 10},
    {"replies", 11},
    {"to", 12},
    {"input", 13},
    {"tokens", 14}
};

    public DemoTokenizer()
    {
        // Pad to 250 entries so weight matrices are realistically sized for the demo.
        while (Vocabulary.Count < 250)
        {
            int id = Vocabulary.Count;
            Vocabulary[$"<unused{id}>"] = id;
        }
    }

    public int[] Tokenize(string input)
    {
        var tokens = input.Split(' ');
        return tokens.Select(token => Vocabulary.GetValueOrDefault(token, Vocabulary["<unk>"])).ToArray();
    }

    public string Detokenize(int[] tokenIds)
    {
        var reverseVocab = Vocabulary.ToDictionary(kvp => kvp.Value, kvp => kvp.Key);
        var tokens = tokenIds.Select(id => reverseVocab.GetValueOrDefault(id, "<unk>"));
        return string.Join(' ', tokens);
    }
}