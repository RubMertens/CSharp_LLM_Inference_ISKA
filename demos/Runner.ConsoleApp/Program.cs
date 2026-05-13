using Runner.ConsoleApp;
using Runner.ConsoleApp.RandomOneLayer;
using WithRope = Runner.ConsoleApp._2_WithRope;
using MultiLayer = Runner.ConsoleApp._3_MultiLayer;
using Runner.ConsoleApp._6_MultiLayerWithKVCache;

var scenario = args.Length > 0 ? int.Parse(args[0]) : 1;

var prompt = "This is a test";
var tokenizer = new DemoTokenizer();
var inputIds = tokenizer.Tokenize(prompt);
const int maxTokensToGenerate = 20;

Console.WriteLine($"--- Scenario {scenario}: {ScenarioName(scenario)} ---");
Console.WriteLine($"Prompt: \"{prompt}\"");
Console.WriteLine($"Input IDs: [{string.Join(", ", inputIds)}]\n");

switch (scenario)
{
    case 1:
    {
        var weights = RandomWeightLoader.LoadWeights(
            vocabularySize: tokenizer.VocabularySize,
            hiddenDimension: 64);
        var runner = new Transformer(weights);
        RunGreedyLoop(tokens => runner.PredictNextTokenGreedy(tokens));
        break;
    }
    case 2:
    {
        var weights = RandomWeightLoader.LoadWeights(
            vocabularySize: tokenizer.VocabularySize,
            hiddenDimension: 64);
        var runner = new WithRope.MultiLayerTransformer(weights);
        RunGreedyLoop(tokens => runner.PredictNextTokenGreedy(tokens));
        break;
    }
    case 3:
    {
        var weights = RandomWeightLoader.LoadWeights(
            vocabularySize: tokenizer.VocabularySize,
            hiddenDimension: 64,
            numberOfQueryHeads: 1,
            numberOfKeyValueHeads: 1,
            gateDimension: 128,
            numberOfLayers: 2);
        var runner = new MultiLayer.MultiLayerTransformer(weights);
        RunGreedyLoop(tokens => runner.PredictNextTokenGreedy(tokens));
        break;
    }
    case 4:
    {
        var weights = RandomWeightLoader.LoadWeights(
            vocabularySize: tokenizer.VocabularySize,
            hiddenDimension: 64,
            numberOfQueryHeads: 1,
            numberOfKeyValueHeads: 1,
            gateDimension: 128,
            numberOfLayers: 2);
        var runner = new MultiLayer.MultiLayerTransformerWithActivation(weights);
        RunGreedyLoop(tokens => runner.PredictNextTokenGreedy(tokens));
        break;
    }
    case 5:
    {
        var weights = RandomWeightLoader.LoadWeights(
            vocabularySize: tokenizer.VocabularySize,
            hiddenDimension: 64,
            numberOfQueryHeads: 8,
            numberOfKeyValueHeads: 2,
            gateDimension: 128,
            numberOfLayers: 2);
        var runner = new MultiLayer.MultiLayerTransformerWithGroupedQueryAttention(weights);
        RunGreedyLoop(tokens => runner.PredictNextTokenGreedy(tokens));
        break;
    }
    case 6:
    {
        var weights = RandomWeightLoader.LoadWeights(
            vocabularySize: tokenizer.VocabularySize,
            hiddenDimension: 64,
            numberOfQueryHeads: 8,
            numberOfKeyValueHeads: 2,
            gateDimension: 128,
            numberOfLayers: 2);
        var runner = new MultiLayerTransformerWithKVCache(weights);
        RunKVCacheLoop(runner);
        break;
    }
    default:
        Console.WriteLine($"Unknown scenario {scenario}. Valid: 1-6.");
        break;
}

void RunGreedyLoop(Func<int[], int> predict)
{
    Console.WriteLine("Generating tokens...\n");
    var tokens = inputIds.ToArray();

    for (int i = 0; i < maxTokensToGenerate; i++)
    {
        var nextTokenId = predict(tokens);
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

void RunKVCacheLoop(MultiLayerTransformerWithKVCache runner)
{
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

        nextTokenId = runner.DecodeNext();
    }
}

static string ScenarioName(int scenario) => scenario switch
{
    1 => "Single-Layer Transformer",
    2 => "Single-Layer with RoPE",
    3 => "Multi-Layer Transformer",
    4 => "Multi-Layer with SiLU Activation",
    5 => "Multi-Layer with Grouped Query Attention",
    6 => "Multi-Layer with KV Cache",
    _ => "Unknown"
};
