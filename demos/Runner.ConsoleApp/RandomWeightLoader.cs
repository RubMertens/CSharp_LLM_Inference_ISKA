namespace Runner.ConsoleApp;

public class RandomWeightLoader
{
    public static ModelWeights LoadWeights(int vocabularySize, int hiddenDimension)
    {
        // Simulate loading weights from a file by generating random weights
        var random = new Random();

        var weights = new ModelWeights
        {
            EmbeddedTokens = GenerateRandomMatrix(vocabularySize, hiddenDimension, random),
            QueryProjection = GenerateRandomMatrix(hiddenDimension, hiddenDimension, random),
            KeyProjection = GenerateRandomMatrix(hiddenDimension, hiddenDimension, random),
            ValueProjection = GenerateRandomMatrix(hiddenDimension, hiddenDimension, random),
            OutputProjection = GenerateRandomMatrix(hiddenDimension, hiddenDimension, random),
            OutputEmbedding = GenerateRandomMatrix(hiddenDimension, vocabularySize, random)
        };


        return weights;
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