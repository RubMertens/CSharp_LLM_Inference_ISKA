using System.ComponentModel;
using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Net.Security;
using System.Security.Cryptography;
using Runner.ConsoleApp.Math;
using Runner.ConsoleApp.RandomOneLayer;

namespace Runner.ConsoleApp._3_MultiLayer;

public class MultiLayerTransformerWithKVCache   (ModelWeights Weights)
{
    public int PredictNextTokenGreedy(int[] tokens)
    {
        var logits = Forward(tokens);
        Vector last = logits[tokens.Length - 1];
        var best = last.Data.Max();
        var bestIndex = Array.IndexOf(last.Data, best);
        return bestIndex;
    }


    private Matrix Embed(int[] tokens)
    {
        var sequenceLength = tokens.Length;
        //translate the tokens to a sequence of embeddings
        Matrix embeddings = new(sequenceLength, Weights.HiddenDimension);
        for (int row = 0; row < sequenceLength; row++)
        {
            embeddings[row] = Weights.EmbeddedTokens[tokens[row]];
        }

        return embeddings;
    }

    public Matrix Forward(int[] tokens)
    {
        var sequenceLength = tokens.Length;
        //translate the tokens to a sequence of embeddings

        Matrix embeddings = Embed(tokens);


        foreach (var layer in Weights.Layers)
        {
            var residual = embeddings;

            // normalize
            Matrix normalizedEmbeddings = RMSNorm(embeddings, layer.AttentionNormWeight);

            // project each token into Q, K, V
            // Q is sequenceLength x hiddenDim (all query heads concatenated)
            // K and V are sequenceLength x keyValueDim (fewer heads than Q — this is the GQA optimization)
            // So sequenceLength x hiddenDim * hiddenDim x hiddenDim = sequenceLength x hiddenDim
            var queries = ApplyRoPETo(normalizedEmbeddings * layer.QueryProjection, Weights.HeadDimension);
            //and sequenceLength x hiddenDim * hiddenDim x keyValueDim = sequenceLength x keyValueDim
            var keys = ApplyRoPETo(normalizedEmbeddings * layer.KeyProjection, Weights.HeadDimension);
            var values = normalizedEmbeddings * layer.ValueProjection;

            // grouped query attention: multiple query heads share the same K/V head
            var attentionOutput = GroupedQueryAttention(sequenceLength, queries, keys, values);

            var projectedAttention = attentionOutput * layer.OutputProjection;

            embeddings = residual + projectedAttention;
            residual = embeddings;
            normalizedEmbeddings = RMSNorm(embeddings, layer.FeedForwardNormWeight);

            //gate and up projction are larger than hidden dimension, to allow for more complex interactions in the feedforward network
            Matrix gate = normalizedEmbeddings * layer.GateProjection;
            Matrix up = normalizedEmbeddings * layer.UpProjection;
            Matrix activated = SigmoidLinearUnit(gate);
            Matrix gated = activated.ElementwiseMultiply(up);
            // brings the dimension back down to hidden dimension so it can be added to the residual and passed to the next layer
            Matrix feedForwardOutput = gated * layer.DownProjection;

            embeddings = residual + feedForwardOutput;
        }

        embeddings = RMSNorm(embeddings, Weights.FinalNormWeight);
        var logits = embeddings * Weights.OutputEmbedding;
        return logits;
    }

    // Rotary Position Embedding: encode position by rotating consecutive dimension pairs
    // by an angle proportional to sequence position, so attention naturally captures relative distance.
    // For multi-head attention, rotation happens independently within each head's chunk of dimensions —
    // the theta formula uses headDimension, not the full concatenated width.
    private static Matrix ApplyRoPETo(Matrix matrix, int headDimension)
    {
        int sequenceLength = matrix.Rows;
        int totalDimension = matrix.Columns;

        Matrix result = new(matrix.Rows, matrix.Columns);
        for (int position = 0; position < sequenceLength; position++)
        {
            // rotate pairs within each head independently
            for (int headStart = 0; headStart < totalDimension; headStart += headDimension)
            {
                for (int j = 0; j < headDimension; j += 2)
                {
                    var x1 = matrix[position][headStart + j];
                    var x2 = matrix[position][headStart + j + 1];

                    //"low" dimensions rotate fast -> 0 / dimension = small exponent -> 10000^small = close to 1 -> 1/1 = large theta -> fast rotation
                    //"high" dimensions rotate slower -> j / dimension = large exponent -> 10000^large = huge number -> 1/huge = tiny theta -> slow rotation
                    var theta = 1.0F / MathF.Pow(10000.0F, (float)j / headDimension);

                    //change the angle for the pair based on the position in the sequence
                    var angle = position * theta;
                    var cos = MathF.Cos(angle);
                    var sin = MathF.Sin(angle);

                    result[position][headStart + j] = x1 * cos - x2 * sin;
                    result[position][headStart + j + 1] = x1 * sin + x2 * cos;
                }
            }
        }

        return result;
    }
    // Grouped Query Attention: each KV head is shared by a group of query heads.
    // With 32 query heads and 4 KV heads, every 8 query heads attend against the same key/value head.
    // This saves memory and compute on K/V projections while keeping Q expressive.
    private Matrix GroupedQueryAttention(int sequenceLength, Matrix queries, Matrix keys, Matrix values)
    {
        Matrix output = new(sequenceLength, Weights.HiddenDimension);

        var groupSize = Weights.NumberdOfQueryHeads / Weights.NumberOfKeyValueHeads;
        float scale = MathF.Sqrt(Weights.HeadDimension);

        for (int queryHead = 0; queryHead < Weights.NumberdOfQueryHeads; queryHead++)
        {
            var keyValueHead = queryHead / groupSize;
            var queryOffset = queryHead * Weights.HeadDimension;
            var keyValueOffset = keyValueHead * Weights.HeadDimension;


            for (int lookingFrom = 0; lookingFrom < sequenceLength; lookingFrom++)
            {
                Vector scores = new(sequenceLength);
                for (int lookingTo = 0; lookingTo < sequenceLength; lookingTo++)
                {
                    if (lookingTo > lookingFrom)
                    {
                        scores[lookingTo] = float.NegativeInfinity;
                        continue;
                    }

                    var queryVector = queries[lookingFrom]
                        [queryOffset..(queryOffset + Weights.HeadDimension)];
                    var keyVector = keys[lookingTo]
                        [keyValueOffset..(keyValueOffset + Weights.HeadDimension)];

                    scores[lookingTo] = queryVector * keyVector / scale;
                }

                var attentionWeights = Softmax(scores);

                Vector outputVector = new(Weights.HeadDimension);
                for (int j = 0; j < sequenceLength; j++)
                {
                    var valueVector = values[j]
                        [keyValueOffset..(keyValueOffset + Weights.HeadDimension)];
                    outputVector += attentionWeights[j] * valueVector;
                }

                for (int j = 0; j < outputVector.Length; j++)
                {
                    output[lookingFrom, queryOffset + j] = outputVector[j];
                }
            }
        }
        return output;
    }


    public static Matrix SigmoidLinearUnit(Matrix input)
    {
        Matrix result = new(input.Rows, input.Columns);

        for (int row = 0; row < input.Rows; row++)
        {
            for (int i = 0; i < input.Columns; i++)
            {
                float x = input[row][i];
                float sigmoid = 1 / (1 + MathF.Exp(-x));
                result[row][i] = x * sigmoid;
            }
        }

        return result;
    }

    public static Matrix RMSNorm(Matrix input, Vector normWeight)
    {
        Matrix result = new(input.Rows, input.Columns);
        for (int row = 0; row < input.Rows; row++)
        {
            result[row] = RootMeanSquareNormalisation(input[row], normWeight);
        }

        return result;
    }

    //aka RMSnorm
    public static Vector RootMeanSquareNormalisation(Vector input, Vector normWeight)
    {
        float sumSquares = 0;
        for (int i = 0; i < input.Length; i++)
        {
            sumSquares += input[i] * input[i];
        }

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

    public static Vector Softmax(Vector input)
    {
        float max = input.Data.Max();
        var exp = input.Data.Select(x => MathF.Exp(x - max)).ToArray();
        float sum = exp.Sum();

        return new(exp.Select(x => x / sum).ToArray(), input.Length);
    }
}
