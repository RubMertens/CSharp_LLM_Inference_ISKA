// See https://aka.ms/new-console-template for more information
using Runner.ConsoleApp;
using Runner.ConsoleApp.RandomOneLayer;

Console.WriteLine("Hello, World!");


var prompt = "This is a test";

var tokenizer = new DemoTokenizer();
var inputIds = tokenizer.Tokenize(prompt);
Console.WriteLine($"Input IDs: [{string.Join(", ", inputIds)}]");


SingleLayerModelWeights weights = RandomWeightLoader.LoadWeights(tokenizer.VocabularySize, 32);

var runner = new Transformer(weights);

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



