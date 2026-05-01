using Runner.ConsoleApp.Math;

namespace Runner.ConsoleApp.RandomOneLayer;

public class Transformer(ModelWeights Weights)
{

    public int PredictNextTokenGreedy(int[] tokens)
    {
        var logits = Forward(tokens);
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
        var keys = normalizedEmbeddings * Weights.KeyProjection;
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