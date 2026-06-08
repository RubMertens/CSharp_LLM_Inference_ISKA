using Runner.ConsoleApp;
using Runner.ConsoleApp._1_SingleLayer;
using Runner.ConsoleApp._4_MultiLayerWithActivation;
using Runner.ConsoleApp._5_MultiLayerWithGQA;
using WithRope = Runner.ConsoleApp._2_WithRope;
using MultiLayer = Runner.ConsoleApp._3_MultiLayer;
using Runner.ConsoleApp._6_MultiLayerWithKVCache;

var scenario = args.Length > 0 ? int.Parse(args[0]) : 1;
// Optional 2nd arg: model directory (scenario 7 only). Defaults to the absolute
// repo-root model dir so the launch is independent of the current working directory.
// An explicitly passed path (relative or absolute) wins.
var modelDirectory = args.Length > 1
    ? args[1]
    : "/Users/rubenmertens/_projects/iska-llm-runner/demos/model";

var prompt = "This is a test";
var tokenizer = new DemoTokenizer();
var inputIds = tokenizer.Tokenize(prompt);
const int maxTokensToGenerate = 20;

Console.WriteLine($"--- Scenario {scenario}: {ScenarioName(scenario)} ---");
// Scenario 7 uses the real tokenizer and prints its own prompt/IDs below.
if (scenario != 7)
{
    Console.WriteLine($"Prompt: \"{prompt}\"");
    Console.WriteLine($"Input IDs: [{string.Join(", ", inputIds)}]\n");
}

switch (scenario)
{
    case 1: RunSingleLayer(); break;
    case 2: RunWithRope(); break;
    case 3: RunMultiLayer(); break;
    case 4: RunMultiLayerWithActivation(); break;
    case 5: RunMultiLayerWithGQA(); break;
    case 6: RunMultiLayerWithKVCache(); break;
    case 7: RunRealTinyLlama(); break;
    default:
        Console.WriteLine(
            $"Unknown scenario {scenario}. Valid: 1-7.\n" +
            "Usage: dotnet run --project Runner.ConsoleApp -- <scenario> [model-dir]\n" +
            "  <scenario>  1-7 (default 1)\n" +
            "  [model-dir] optional model directory for scenario 7 " +
            "(default \"/Users/rubenmertens/_projects/iska-llm-runner/demos/model\")");
        break;
}

// --- Scenario runners ---

void RunSingleLayer()
{
    var weights = RandomWeightLoader.LoadWeights(
        vocabularySize: tokenizer.VocabularySize,
        hiddenDimension: 64);
    var runner = new Transformer(weights);

    Console.WriteLine("Generating tokens...\n");
    var tokens = inputIds.ToArray();
    for (int i = 0; i < maxTokensToGenerate; i++)
    {
        var nextTokenId = runner.PredictNextTokenGreedy(tokens);
        Console.WriteLine($"Predicted next token ID: {nextTokenId}");
        if (nextTokenId == tokenizer.EndOfSequenceToken || tokens.Length >= maxTokensToGenerate)
        {
            Console.WriteLine("End of sequence reached or max token limit hit.");
            break;
        }
        tokens = tokens.Append(nextTokenId).ToArray();
        Console.WriteLine($"Generated text so far: {tokenizer.Detokenize(tokens)}");
    }
}

void RunWithRope()
{
    var weights = RandomWeightLoader.LoadWeights(
        vocabularySize: tokenizer.VocabularySize,
        hiddenDimension: 64);
    var runner = new WithRope.MultiLayerTransformer(weights);

    Console.WriteLine("Generating tokens...\n");
    var tokens = inputIds.ToArray();
    for (int i = 0; i < maxTokensToGenerate; i++)
    {
        var nextTokenId = runner.PredictNextTokenGreedy(tokens);
        Console.WriteLine($"Predicted next token ID: {nextTokenId}");
        if (nextTokenId == tokenizer.EndOfSequenceToken || tokens.Length >= maxTokensToGenerate)
        {
            Console.WriteLine("End of sequence reached or max token limit hit.");
            break;
        }
        tokens = tokens.Append(nextTokenId).ToArray();
        Console.WriteLine($"Generated text so far: {tokenizer.Detokenize(tokens)}");
    }
}

void RunMultiLayer()
{
    var weights = RandomWeightLoader.LoadWeights(
        vocabularySize: tokenizer.VocabularySize,
        hiddenDimension: 64,
        numberOfQueryHeads: 1,
        numberOfKeyValueHeads: 1,
        gateDimension: 128,
        numberOfLayers: 2);
    var runner = new MultiLayer.MultiLayerTransformer(weights);

    Console.WriteLine("Generating tokens...\n");
    var tokens = inputIds.ToArray();
    for (int i = 0; i < maxTokensToGenerate; i++)
    {
        var nextTokenId = runner.PredictNextTokenGreedy(tokens);
        Console.WriteLine($"Predicted next token ID: {nextTokenId}");
        if (nextTokenId == tokenizer.EndOfSequenceToken || tokens.Length >= maxTokensToGenerate)
        {
            Console.WriteLine("End of sequence reached or max token limit hit.");
            break;
        }
        tokens = tokens.Append(nextTokenId).ToArray();
        Console.WriteLine($"Generated text so far: {tokenizer.Detokenize(tokens)}");
    }
}

void RunMultiLayerWithActivation()
{
    var weights = RandomWeightLoader.LoadWeights(
        vocabularySize: tokenizer.VocabularySize,
        hiddenDimension: 64,
        numberOfQueryHeads: 1,
        numberOfKeyValueHeads: 1,
        gateDimension: 128,
        numberOfLayers: 2);
    var runner = new MultiLayerTransformerWithActivation(weights);

    Console.WriteLine("Generating tokens...\n");
    var tokens = inputIds.ToArray();
    for (int i = 0; i < maxTokensToGenerate; i++)
    {
        var nextTokenId = runner.PredictNextTokenGreedy(tokens);
        Console.WriteLine($"Predicted next token ID: {nextTokenId}");
        if (nextTokenId == tokenizer.EndOfSequenceToken || tokens.Length >= maxTokensToGenerate)
        {
            Console.WriteLine("End of sequence reached or max token limit hit.");
            break;
        }
        tokens = tokens.Append(nextTokenId).ToArray();
        Console.WriteLine($"Generated text so far: {tokenizer.Detokenize(tokens)}");
    }
}

void RunMultiLayerWithGQA()
{
    var weights = RandomWeightLoader.LoadWeights(
        vocabularySize: tokenizer.VocabularySize,
        hiddenDimension: 64,
        numberOfQueryHeads: 8,
        numberOfKeyValueHeads: 2,
        gateDimension: 128,
        numberOfLayers: 2);
    var runner = new MultiLayerTransformerWithGroupedQueryAttention(weights);

    Console.WriteLine("Generating tokens...\n");
    var tokens = inputIds.ToArray();
    for (int i = 0; i < maxTokensToGenerate; i++)
    {
        var nextTokenId = runner.PredictNextTokenGreedy(tokens);
        Console.WriteLine($"Predicted next token ID: {nextTokenId}");
        if (nextTokenId == tokenizer.EndOfSequenceToken || tokens.Length >= maxTokensToGenerate)
        {
            Console.WriteLine("End of sequence reached or max token limit hit.");
            break;
        }
        tokens = tokens.Append(nextTokenId).ToArray();
        Console.WriteLine($"Generated text so far: {tokenizer.Detokenize(tokens)}");
    }
}

void RunMultiLayerWithKVCache()
{
    var weights = RandomWeightLoader.LoadWeights(
        vocabularySize: tokenizer.VocabularySize,
        hiddenDimension: 64,
        numberOfQueryHeads: 8,
        numberOfKeyValueHeads: 2,
        gateDimension: 128,
        numberOfLayers: 2);
    var runner = new MultiLayerTransformerWithKVCache(weights);

    Console.WriteLine("Generating tokens (with KV cache)...\n");
    var tokens = inputIds.ToArray();
    var nextTokenId = runner.Prefill(tokens);

    while (true)
    {
        Console.WriteLine($"Predicted next token ID: {nextTokenId}");

        if (nextTokenId == tokenizer.EndOfSequenceToken || tokens.Length >= maxTokensToGenerate)
        {
            Console.WriteLine("End of sequence reached or max token limit hit.");
            break;
        }

        tokens = tokens.Append(nextTokenId).ToArray();
        Console.WriteLine($"Generated text so far: {tokenizer.Detokenize(tokens)}");

        nextTokenId = runner.DecodeNext(nextTokenId);
    }
}

void RunRealTinyLlama()
{
    string weightsPath = Path.Combine(modelDirectory, "model.safetensors");

    if (!File.Exists(weightsPath))
    {
        Console.WriteLine(
            $"Real weights not found at '{weightsPath}'.\n" +
            "Download TinyLlama-1.1B-Chat-v1.0 'model.safetensors' from HuggingFace " +
            $"and place it in the '{modelDirectory}/' directory, then re-run scenario 7.\n" +
            "Override the directory with: dotnet run --project Runner.ConsoleApp -- 7 <model-dir>");
        return;
    }

    var realTokenizer = new RealTokenizer(Path.Combine(modelDirectory, "tokenizer.model"));
    const string realPrompt = "The capital of France is";

    Console.WriteLine("Loading real TinyLlama weights (this reads ~2.2GB, may take a moment)...");
    var weights = RealWeightLoader.LoadWeights(modelDirectory);
    var runner = new MultiLayerTransformerWithKVCache(weights);

    var realInputIds = realTokenizer.Tokenize(realPrompt);
    Console.WriteLine($"Real prompt: \"{realPrompt}\"");
    Console.WriteLine($"Input IDs: [{string.Join(", ", realInputIds)}]\n");
    Console.WriteLine("Generating tokens (real TinyLlama, KV cache)...\n");

    var tokens = realInputIds.ToArray();
    var nextTokenId = runner.Prefill(tokens);

    while (true)
    {
        Console.WriteLine($"Predicted next token ID: {nextTokenId}");

        if (nextTokenId == realTokenizer.EndOfSequenceToken || tokens.Length >= maxTokensToGenerate)
        {
            Console.WriteLine("End of sequence reached or max token limit hit.");
            break;
        }

        tokens = tokens.Append(nextTokenId).ToArray();
        Console.WriteLine($"Generated text so far: {realTokenizer.Detokenize(tokens)}");

        nextTokenId = runner.DecodeNext(nextTokenId);
    }
}

// --- Shared helpers ---

static string ScenarioName(int scenario) => scenario switch
{
    1 => "Single-Layer Transformer",
    2 => "Single-Layer with RoPE",
    3 => "Multi-Layer Transformer",
    4 => "Multi-Layer with SiLU Activation",
    5 => "Multi-Layer with Grouped Query Attention",
    6 => "Multi-Layer with KV Cache",
    7 => "Real TinyLlama-1.1B (safetensors + SentencePiece)",
    _ => "Unknown"
};
