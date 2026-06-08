using Runner.ConsoleApp.Math;

namespace Runner.ConsoleApp;

public class RandomWeightLoader
{
    public static SingleLayerModelWeights LoadWeights(int vocabularySize, int hiddenDimension)
    {
        // Simulate loading weights from a file by generating random weights
        var random = new Random();

        var weights = new SingleLayerModelWeights
        {
            EmbeddedTokens = GenerateRandomMatrix(vocabularySize,
                hiddenDimension,
                random),
            QueryProjection = GenerateRandomMatrix(hiddenDimension,
                hiddenDimension,
                random),
            KeyProjection = GenerateRandomMatrix(hiddenDimension,
                hiddenDimension,
                random),
            ValueProjection = GenerateRandomMatrix(hiddenDimension,
                hiddenDimension,
                random),
            OutputProjection = GenerateRandomMatrix(hiddenDimension,
                hiddenDimension,
                random),
            OutputEmbedding = GenerateRandomMatrix(hiddenDimension,
                vocabularySize,
                random),
            AttentionNormWeight = GenerateRandomVector(hiddenDimension, random),
            FeedForwardNormWeight = GenerateRandomVector(hiddenDimension, random)
        };


        return weights;
    }

    public static ModelWeights LoadWeights(int vocabularySize, int hiddenDimension, int numberOfQueryHeads,
        int numberOfKeyValueHeads, int gateDimension, int numberOfLayers)
    {
        var random = new Random();
        int headDimension = hiddenDimension / numberOfQueryHeads;
        int keyValueDimension = numberOfKeyValueHeads * headDimension;

        var layers = new LayerWeights[numberOfLayers];
        for (int i = 0; i < numberOfLayers; i++)
        {
            layers[i] = new LayerWeights
            {
                AttentionNormWeight = GenerateRandomVector(hiddenDimension, random),
                FeedForwardNormWeight = GenerateRandomVector(hiddenDimension, random),
                QueryProjection = GenerateRandomMatrix(hiddenDimension, hiddenDimension, random),
                KeyProjection = GenerateRandomMatrix(hiddenDimension, keyValueDimension, random),
                ValueProjection = GenerateRandomMatrix(hiddenDimension, keyValueDimension, random),
                OutputProjection = GenerateRandomMatrix(hiddenDimension, hiddenDimension, random),
                GateProjection = GenerateRandomMatrix(hiddenDimension, gateDimension, random),
                UpProjection = GenerateRandomMatrix(hiddenDimension, gateDimension, random),
                DownProjection = GenerateRandomMatrix(gateDimension, hiddenDimension, random),
            };
        }

        return new ModelWeights
        {
            NumberdOfQueryHeads = numberOfQueryHeads,
            NumberOfKeyValueHeads = numberOfKeyValueHeads,
            EmbeddedTokens = GenerateRandomMatrix(vocabularySize, hiddenDimension, random),
            Layers = layers,
            OutputEmbedding = GenerateRandomMatrix(hiddenDimension, vocabularySize, random),
            FinalNormWeight = GenerateRandomVector(hiddenDimension, random)
        };
    }

    private static Vector GenerateRandomVector(int length, Random random)
    {
        var data = new float[length];
        for (int i = 0; i < length; i++)
            data[i] = (float)(random.NextDouble() * 2 - 1);
        return new Vector(data, length);
    }

    private static Matrix GenerateRandomMatrix(int rows, int columns, Random random)
    {
        var data = new float[rows][];
        for (int i = 0; i < rows; i++)
        {
            data[i] = new float[columns];
            for (int j = 0; j < columns; j++)
            {
                data[i][j] = (float)(random.NextDouble() * 2 - 1); // Random values between -1 and 1
            }
        }

        return new Matrix(data, rows, columns);
    }
}