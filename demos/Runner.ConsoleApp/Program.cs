using Runner.ConsoleApp;
using Runner.ConsoleApp._5_MultiLayerWithGQA;
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
    case 1: RunSingleLayer(); break;
    case 2: RunWithRope(); break;
    case 3: RunMultiLayer(); break;
    case 4: RunMultiLayerWithActivation(); break;
    case 5: RunMultiLayerWithGQA(); break;
    case 6: RunMultiLayerWithKVCache(); break;
    default: Console.WriteLine($"Unknown scenario {scenario}. Valid: 1-6."); break;
}

// --- Scenario runners ---

void RunSingleLayer()
{
    var weights = RandomWeightLoader.LoadWeights(
        vocabularySize: tokenizer.VocabularySize,
        hiddenDimension: 64);
    var runner = new Transformer(weights);
    GenerateGreedy(tokens => runner.PredictNextTokenGreedy(tokens));
}

void RunWithRope()
{
    var weights = RandomWeightLoader.LoadWeights(
        vocabularySize: tokenizer.VocabularySize,
        hiddenDimension: 64);
    var runner = new WithRope.MultiLayerTransformer(weights);
    GenerateGreedy(tokens => runner.PredictNextTokenGreedy(tokens));
}

void RunMultiLayer()
{
    var weights = LoadMultiLayerWeights(numberOfQueryHeads: 1, numberOfKeyValueHeads: 1);
    var runner = new MultiLayer.MultiLayerTransformer(weights);
    GenerateGreedy(tokens => runner.PredictNextTokenGreedy(tokens));
}

void RunMultiLayerWithActivation()
{
    var weights = LoadMultiLayerWeights(numberOfQueryHeads: 1, numberOfKeyValueHeads: 1);
    var runner = new MultiLayer.MultiLayerTransformerWithActivation(weights);
    GenerateGreedy(tokens => runner.PredictNextTokenGreedy(tokens));
}

void RunMultiLayerWithGQA()
{
    var weights = LoadMultiLayerWeights(numberOfQueryHeads: 8, numberOfKeyValueHeads: 2);
    var runner = new MultiLayerTransformerWithGroupedQueryAttention(weights);
    GenerateGreedy(tokens => runner.PredictNextTokenGreedy(tokens));
}

void RunMultiLayerWithKVCache()
{
    var weights = LoadMultiLayerWeights(numberOfQueryHeads: 8, numberOfKeyValueHeads: 2);
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

// --- Shared helpers ---

ModelWeights LoadMultiLayerWeights(int numberOfQueryHeads, int numberOfKeyValueHeads) =>
    RandomWeightLoader.LoadWeights(
        vocabularySize: tokenizer.VocabularySize,
        hiddenDimension: 64,
        numberOfQueryHeads: numberOfQueryHeads,
        numberOfKeyValueHeads: numberOfKeyValueHeads,
        gateDimension: 128,
        numberOfLayers: 2);

void GenerateGreedy(Func<int[], int> predict)
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
