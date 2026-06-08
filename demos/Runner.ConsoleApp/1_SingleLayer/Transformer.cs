using Runner.ConsoleApp.Math;

namespace Runner.ConsoleApp._1_SingleLayer;

public class Transformer(SingleLayerModelWeights weights)
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
        Matrix embeddings = new(sequenceLength, weights.HiddenDimension);
        for (int row = 0; row < sequenceLength; row++)
        {
            embeddings[row] = weights.EmbeddedTokens[tokens[row]];
        }

        // normalize 
        Matrix normalizedEmbeddings = new(sequenceLength, weights.HiddenDimension);
        for (int row = 0; row < sequenceLength; row++)
        {
            normalizedEmbeddings[row] = RootMeanSquareNormalisation(embeddings[row], weights.AttentionNormWeight);
        }

        // project each token into Q, K, V
        // embeddings is sequenceLength x hiddenDim, projection is hiddenDim x hiddenDim, result is sequenceLength x hiddenDim
        var queries = normalizedEmbeddings * weights.QueryProjection;
        var keys = normalizedEmbeddings * weights.KeyProjection;
        var values = normalizedEmbeddings * weights.ValueProjection;

        var attentionOutput = SingleHeadSelfAttention(weights.HiddenDimension, sequenceLength, queries, keys, values);

        var projectedAttention = attentionOutput * weights.OutputProjection;

        Matrix hidden = new(sequenceLength, weights.HiddenDimension);
        for (int row = 0; row < sequenceLength; row++)
        {
            hidden[row] = embeddings[row] + projectedAttention[row];
        }
        var logits = hidden * weights.OutputEmbedding;
        return logits;
    }

    private Matrix SingleHeadSelfAttention(int headDimension, int sequenceLength, Matrix queries, Matrix keys, Matrix values)
    {
        float scale = MathF.Sqrt(headDimension);

        Matrix attentionOutput = new(sequenceLength, headDimension);

        //for each token, compute the attention scores against all other tokens
        for (int lookingFrom = 0; lookingFrom < sequenceLength; lookingFrom++)
        {
            var scores = new float[sequenceLength];

            for (var lookingTo = 0; lookingTo < sequenceLength; lookingTo++)
            {
                if (lookingTo > lookingFrom)
                {
                    // causal masking: prevent attending to future tokens by setting their scores to a very large negative number
                    // in language generation, you should never look to the future!
                    // causality only looks backwards
                    scores[lookingTo] = float.NegativeInfinity;
                    continue;
                }
                // attention = query • key / sqrt(headDim)
                // dot product is a indication of how much 2 vectors are aligned
                // scaling to prevent large outputs (AxX + BxY + CxZ) can grow extremely large
                // in short how much does the vector representation of the question (query) align with the vector representation of the context (key)
                scores[lookingTo] = queries[lookingFrom] * keys[lookingTo] / scale;
            }

            // make the sum of the score equal to 1 so that we can interpret them as probabilities. (1 == 100% attention, 0 == 0% attention)
            // we dont care about the actual numbers, just the relative differences between them.
            var attentionWeights = Softmax(scores);

            Vector attended = new(headDimension);
            // now for each token in the sequence we have a score that indicates how important it is to the current token.
            for (int j = 0; j < sequenceLength; j++)
            {
                attended = attended + (attentionWeights[j] * values[j]);
            }

            attentionOutput[lookingFrom] = attended;
        }
        return attentionOutput;
    }
    //aka RMSnorm
    public static Vector RootMeanSquareNormalisation(Vector input, Vector normWeight)
    {
        float sumSquares = input.Data.Sum(x => x * x);

        const float divideByZeroProtection = 1e-5f;
        float mean = sumSquares / input.Length;
        float rootMeanSquare = MathF.Sqrt(mean + divideByZeroProtection);

        Vector result = new(input.Length);
        for (var i = 0; i < input.Length; i++)
        {
            result[i] = input[i] / rootMeanSquare * normWeight[i];
        }

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