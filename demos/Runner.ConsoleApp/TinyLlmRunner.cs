

public class Matrix
{
    public float[][] Data { get; }
    public int Rows { get; }
    public int Columns { get; }

    public Matrix(int rows, int cols)
    {
        Rows = rows;
        Columns = cols;
        Data = new float[rows][];
        for (int i = 0; i < rows; i++)
            Data[i] = new float[cols];
    }

    public Matrix(float[][] data, int rows, int cols)
    {
        Rows = rows;
        Columns = cols;
        //validations

        if (data.Length != rows)
            throw new ArgumentException($"Data row count {data.Length} does not match specified rows {rows}.");
        for (int i = 0; i < rows; i++)
        {
            if (data[i].Length != cols)
                throw new ArgumentException($"Data column count {data[i].Length} in row {i} does not match specified columns {cols}.");
        }   

        Data = data;
    }

    public float this[int row, int col]
    {
        get => Data[row][col];
        set => Data[row][col] = value;
    }
    public Vector this[int row]
    {
        get => new(Data[row], Columns);
        set => Data[row] = value.Data;
    }


    public static Matrix operator *(Matrix a, Matrix b)
    {
        if (a.Columns != b.Rows)
            throw new InvalidOperationException("Incompatible matrix dimensions for multiplication.");

        Matrix result = new Matrix(a.Rows, b.Columns);
        for (var i = 0; i < a.Rows; i++)
        {
            for (var j = 0; j < b.Columns; j++)
            {
                float sum = 0;
                for (int k = 0; k < a.Columns; k++)
                {
                    sum += a.Data[i][k] * b.Data[k][j];
                }
                result.Data[i][j] = sum;
            }
        }
        return result;
    }

}



public class Vector
{
    public float[] Data { get; }
    public int Length { get; }

    public Vector(int size)
    {
        Length = size;
        Data = new float[size];
    }

    public Vector(float[] data, int length)
    {
        if (data.Length != length){
            throw new ArgumentException($"Data length {data.Length} does not match specified length {length}.");
        }
        Length = length;
        Data = data;
    }

    public static float operator *(Vector a, Vector b)
    {
        if (a.Length != b.Length)
            throw new InvalidOperationException("Incompatible vector dimensions for dot product.");

        float sum = 0;
        for (var i = 0; i < a.Length; i++)
        {
            sum += a.Data[i] * b.Data[i];
        }
        return sum;
    }

    public static Vector operator +(Vector a, Vector b)
    {
        if (a.Length != b.Length)
            throw new InvalidOperationException("Incompatible vector dimensions for addition.");

        Vector result = new Vector(a.Length);
        for (var i = 0; i < a.Length; i++)
        {
            result.Data[i] = a.Data[i] + b.Data[i];
        }
        return result;
    }

    public static Vector operator *(Vector a, float scalar)
    {
        Vector result = new(a.Length);
        for (var i = 0; i < a.Length; i++)
        {
            result.Data[i] = a.Data[i] * scalar;
        }
        return result;
    }

    public static Vector operator *(float scalar, Vector a) => a * scalar;

    public float this[int index]
    {
        get => Data[index];
        set => Data[index] = value;
    }
}




public class Transformer(ModelWeights Weights)
{
    
    public int PredictNextTokenGreedy(int[] tokens)
    {
        var logits= Forward(tokens);
        Vector last = logits[tokens.Length - 1];
        var best = last.Data.Max();
        var bestIndex = Array.IndexOf(last.Data, best);
        return bestIndex;
    }

    public Matrix Forward(int[] tokens)
    {
        var sequenceLength = tokens.Length;
        //translate the tokens to a sequence of embeddings
        var embeddings = new Matrix(sequenceLength, Weights.HiddenDimension);
        for (int row = 0; row < sequenceLength; row++)
        {
            embeddings[row] = Weights.EmbeddedTokens[tokens[row]];
        }

        // normalize 
        var normalizedEmbeddings = new Matrix(sequenceLength, Weights.HiddenDimension);
        for (int row = 0; row < sequenceLength; row++)
        {
            normalizedEmbeddings[row] = RootMeanSquareNormalisation(embeddings[row]);
        }

        // project each token into Q, K, V
        // embeddings is sequenceLength x hiddenDim, projection is hiddenDim x hiddenDim, result is sequenceLength x hiddenDim
        var queries = normalizedEmbeddings * Weights.QueryProjection;
        var keys =  normalizedEmbeddings * Weights.KeyProjection;
        var values = normalizedEmbeddings * Weights.ValueProjection;

        var attentionOutput = SingleHeadSelfAttention(Weights.HiddenDimension, sequenceLength, queries, keys, values);

        var projectedAttention = attentionOutput * Weights.OutputProjection;

        var hidden = new Matrix(sequenceLength, Weights.HiddenDimension);
        for (int row = 0; row < sequenceLength; row++)
        {
            hidden[row] = embeddings[row] + projectedAttention[row];
        }
        var logits = hidden * Weights.OutputEmbedding;
        return logits;
    }

    private Matrix SingleHeadSelfAttention(int headDimension, int sequenceLength, Matrix queries, Matrix keys, Matrix values)
    {
        float scale = MathF.Sqrt(headDimension);

        var attentionOutput = new Matrix(sequenceLength, headDimension);
    
        //for each token, compute the attention scores against all other tokens
        for (int i = 0; i < sequenceLength; i++)
        {
            var scores = new float[sequenceLength];

            for (var j = 0; j < sequenceLength; j++)
            {
                if (j > i)
                {
                    // causal masking: prevent attending to future tokens by setting their scores to a very large negative number
                    // in language generation, you should never look to the future!
                    //causality only looks backwards
                    scores[j] = float.NegativeInfinity;
                    continue;
                }
                // attention = query dot key / sqrt(headDim)
                // dot product is a indication of how much 2 vectors are aligned
                // scaling to prevent large outputs (AxX + BxY + CxZ) can grow extremely large
                // in short how much does the vector representation of the question (query) align with the vector representation of the context (key)
                scores[j] = queries[i] * keys[j] / scale;
            }

            // make the sum of the score equal to 1 so that we can interpret them as probabilities. (1 == 100% attention, 0 == 0% attention)
            // we dont care about the actual numbers, just the relative differences between them.
            var attentionWeights = Softmax(scores);

            var attended = new Vector(headDimension);
            // now for each token in the sequence we have a score that indicates how important it is to the current token.
            for (int j = 0; j < sequenceLength; j++)
            {
                attended = attended + (attentionWeights[j] * values[j]);
            }

            attentionOutput[i] = attended;
        }
        return attentionOutput;
    }
    public static Vector RootMeanSquareNormalisation(Vector input)
    {
        float sumSquares = 0;
        for (int i = 0; i < input.Length; i++)
            sumSquares += input[i] * input[i];

        const float divideByZeroProtection = 1e-5f;
        float rootMeanSquare = MathF.Sqrt(sumSquares / input.Length + divideByZeroProtection);

        var result = new Vector(input.Length);
        for (var i = 0; i < input.Length; i++)
            result[i] = input[i] / rootMeanSquare;

        return result;
    }

    public static float[] Softmax(float[] input)
    {
        float max = input.Max();
        var exp = input.Select(x => MathF.Exp(x - max)).ToArray();
        float sum = exp.Sum();
        return exp.Select(x => x / sum).ToArray();
    }
}

public class ModelWeights
{
    public int VocabularySize => EmbeddedTokens.Rows;
    public int HiddenDimension => EmbeddedTokens.Columns;

    /// <summary>
    /// rows = vocab size, cols = hidden dimension
    /// </summary>
    public Matrix EmbeddedTokens { get; set; }

    /// <summary>
    /// hiddenDim x hiddenDim
    /// </summary>
    public Matrix QueryProjection { get; set; }
    /// <summary>
    /// hiddenDim x hiddenDim
    /// </summary>
    public Matrix KeyProjection { get; set; }
    /// <summary>
    /// hiddenDim x hiddenDim
    /// </summary>
    public Matrix ValueProjection { get; set; }
    /// <summary>
    /// hiddenDim x hiddenDim — projects attention output back
    /// </summary>
    public Matrix OutputProjection { get; set; }

    /// <summary>
    /// hiddenDim x vocabSize — projects hidden state to logits
    /// </summary>
    public Matrix OutputEmbedding { get; set; }
}


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