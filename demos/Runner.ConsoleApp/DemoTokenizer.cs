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

    {"tiny", 3},
    {"hello", 4},
    {"replies", 5},
    {"to", 6},
    {"world", 7},
    {"llm", 8},
    {"this", 9},
    {"input", 10},
    {"is", 11},
    {"a", 12},
    {"tokens", 13},
    {"test", 14}
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