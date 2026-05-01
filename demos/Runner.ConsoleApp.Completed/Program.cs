using Microsoft.ML.Tokenizers;
using Runner.ConsoleApp.Completed;
using Runner.ConsoleApp.Completed.Inference;
using Runner.ConsoleApp.Completed.Model;

var modelDir = args.Length > 0 ? args[0] : Directory.GetCurrentDirectory();
var prompt = args.Length > 1 ? args[1] : "Once upon a time";
var maxTokens = args.Length > 2 ? int.Parse(args[2]) : 256;
var temperature = 0.9f;
var topK = 40;

Console.WriteLine($"Model directory: {modelDir}");
Console.WriteLine($"Prompt: {prompt}");
Console.WriteLine($"Max tokens: {maxTokens}");
Console.WriteLine();

Console.WriteLine("Loading tokenizer...");
using var tokenizerStream = File.OpenRead(Path.Combine(modelDir, "tokenizer.model"));
var tokenizer = LlamaTokenizer.Create(tokenizerStream, addBeginOfSentence: true, addEndOfSentence: false);

Console.WriteLine("Loading model weights...");
var weights = ModelWeights.Load(Path.Combine(modelDir, "model.safetensors"));

var cache = new KvCache();
var transformer = new Transformer(weights, cache);
var rng = new Random();

var tokenIds = tokenizer.EncodeToIds(prompt);
if (tokenIds == null || tokenIds.Count == 0)
{
    Console.Error.WriteLine("Tokenization produced no tokens.");
    return;
}

Console.WriteLine($"Prompt tokens: {tokenIds.Count}");
Console.WriteLine();
Console.Write(prompt);

int token = tokenIds[0];
for (int pos = 0; pos < maxTokens; pos++)
{
    var logits = transformer.Forward(token, pos);

    int next;
    if (pos < tokenIds.Count - 1)
    {
        next = tokenIds[pos + 1];
    }
    else
    {
        next = Sampler.TopK(logits, ModelConfig.VocabularySize, topK, temperature, rng);

        if (next == tokenizer.EndOfSentenceId)
            break;

        var decoded = tokenizer.Decode(new[] { next });
        Console.Write(decoded);
    }

    token = next;
}

Console.WriteLine();
Console.WriteLine();
Console.WriteLine("Done.");
