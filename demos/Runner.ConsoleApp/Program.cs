// See https://aka.ms/new-console-template for more information
using Runner.ConsoleApp;
using Runner.ConsoleApp._3_MultiLayer;
using Runner.ConsoleApp.RandomOneLayer;

Console.WriteLine("Hello, World!");


var prompt = "This is a test";

var tokenizer = new DemoTokenizer();
var inputIds = tokenizer.Tokenize(prompt);
Console.WriteLine($"Input IDs: [{string.Join(", ", inputIds)}]");

// TinyLlama-style GQA config at small scale for demo:
// 8 query heads, 2 KV heads -> group size 4 (each KV head shared by 4 query heads)
// headDim = 64 / 8 = 8
var weights = RandomWeightLoader.LoadWeights(
    vocabularySize: tokenizer.VocabularySize,
    hiddenDimension: 64,
    numberOfQueryHeads: 8,
    numberOfKeyValueHeads: 2,
    gateDimension: 128,
    numberOfLayers: 2);

var runner = new MultiLayerTransformerWithGroupedQueryAttention(weights);

const int maxTokensToGenerate = 20;

Console.WriteLine("Generating tokens...");

Console.WriteLine($"Prompt: {prompt}");
while (true)
{
    var nextTokenId = runner.PredictNextTokenGreedy(inputIds);
    Console.WriteLine($"Predicted next token ID: {nextTokenId}");

    if (nextTokenId == tokenizer.EndOfSequenceToken || inputIds.Length >= maxTokensToGenerate)
    {
        Console.WriteLine("End of sequence reached or max token limit hit.");
        break;
    }

    // Append the predicted token ID to the input for the next prediction
    inputIds = inputIds.Append(nextTokenId).ToArray();
    var generatedText = tokenizer.Detokenize(inputIds);
    Console.WriteLine($"Generated text so far: {generatedText}");
}



