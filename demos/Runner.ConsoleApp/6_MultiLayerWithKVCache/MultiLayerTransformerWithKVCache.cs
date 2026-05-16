using Runner.ConsoleApp.Math;
using Runner.ConsoleApp.RandomOneLayer;

namespace Runner.ConsoleApp._6_MultiLayerWithKVCache;

public class MultiLayerTransformerWithKVCache(ModelWeights weights)
{
    private readonly List<Vector>[] _keyCache = new List<Vector>[weights.Layers.Length];
    private readonly List<Vector>[] _valueCache = new List<Vector>[weights.Layers.Length];

    // Process the full prompt, populate the cache, return the first predicted token
    public int Prefill(int[] promptTokens)
    {
        int sequenceLength = promptTokens.Length;
        Matrix embeddings = Embed(promptTokens);


        for (int layerIndex = 0; layerIndex < weights.Layers.Length; layerIndex++)
        {
            LayerWeights layer = weights.Layers[layerIndex];
            Matrix residual = embeddings;

            Matrix normalizedEmbeddings = RootMeanSquareNormalisation(embeddings, layer.AttentionNormWeight);

            var queries = ApplyRoPETo(normalizedEmbeddings * layer.QueryProjection, weights.HeadDimension);
            var keys = ApplyRoPETo(normalizedEmbeddings * layer.KeyProjection, weights.HeadDimension);
            var values = normalizedEmbeddings * layer.ValueProjection;

            _keyCache[layerIndex] = keys.ToRowList();
            _valueCache[layerIndex] = values.ToRowList();

            var attentionOutput = GroupedQueryAttention(sequenceLength, queries, keys, values);

            var projectedAttention = attentionOutput * layer.OutputProjection;

            embeddings = residual + projectedAttention;
            residual = embeddings;
            normalizedEmbeddings = RootMeanSquareNormalisation(embeddings, layer.FeedForwardNormWeight);

            Matrix gate = normalizedEmbeddings * layer.GateProjection;
            Matrix up = normalizedEmbeddings * layer.UpProjection;
            Matrix activated = SigmoidLinearUnit(gate);
            Matrix gated = activated.ElementwiseMultiply(up);
            Matrix feedForwardOutput = gated * layer.DownProjection;

            embeddings = residual + feedForwardOutput;
        }

        embeddings = RootMeanSquareNormalisation(embeddings, weights.FinalNormWeight);
        var logits = embeddings * weights.OutputEmbedding;

        Vector last = logits[sequenceLength - 1];
        var best = last.Data.Max();
        return Array.IndexOf(last.Data, best);
    }

    public int DecodeNext(int token)
    {
        Vector embedding = weights.EmbeddedTokens[token];

        for (int layerIndex = 0; layerIndex < weights.Layers.Length; layerIndex++)
        {
            LayerWeights layer = weights.Layers[layerIndex];
            Vector residual = embedding;

            Vector normalized = RootMeanSquareNormalisation(embedding, layer.AttentionNormWeight);

            int position = _keyCache[layerIndex].Count;

            // 1xhiddenDim • hiddenDim x headDim = 1xheadDim
            Vector query = normalized * layer.QueryProjection;
            // 1xhiddenDim • hiddenDim x keyValueDim = 1xkeyValueDim
            Vector key = normalized * layer.KeyProjection;
            // 1xhiddenDim • hiddenDim x keyValueDim = 1xkeyValueDim
            Vector value = normalized * layer.ValueProjection;

            query = ApplyRoPETo(query, weights.HeadDimension, position);
            key = ApplyRoPETo(key, weights.HeadDimension, position);

            _keyCache[layerIndex].Add(key);
            _valueCache[layerIndex].Add(value);

            Vector attentionOut = GroupedQueryAttentionWithCache(
                query,
                _keyCache[layerIndex],
                _valueCache[layerIndex]);

            Vector projectedAttention = attentionOut * layer.OutputProjection;

            embedding = residual + projectedAttention;
            residual =  embedding;

            Vector normalizedFeedForward = RootMeanSquareNormalisation(embedding, layer.FeedForwardNormWeight);

            Vector gate = normalizedFeedForward * layer.GateProjection;
            Vector up = normalizedFeedForward * layer.UpProjection;
            Vector activatedGate = SigmoidLinearUnit(gate);
            Vector gated = activatedGate.ElementwiseMultiply(up);
            Vector feedForwardOutput = gated * layer.DownProjection;

            embedding = residual + feedForwardOutput;
        }

        Vector finalNorm = RootMeanSquareNormalisation(embedding, weights.FinalNormWeight);
        Vector logits = finalNorm * weights.OutputEmbedding;

        float best = logits.Data.Max();
        return Array.IndexOf(logits.Data, best);
    }


    private Matrix Embed(int[] tokens)
    {
        var sequenceLength = tokens.Length;
        //translate the tokens to a sequence of embeddings
        Matrix embeddings = new(sequenceLength, weights.HiddenDimension);
        for (int row = 0; row < sequenceLength; row++)
        {
            embeddings[row] = weights.EmbeddedTokens[tokens[row]];
        }

        return embeddings;
    }

    // Rotary Position Embedding: encode position by rotating consecutive dimension pairs
    // by an angle proportional to sequence position, so attention naturally captures relative distance.
    // For multi-head attention, rotation happens independently within each head's chunk of dimensions —
    // the theta formula uses headDimension, not the full concatenated width.
    private static Matrix ApplyRoPETo(Matrix matrix, int headDimension)
    {
        Matrix result = new(matrix.Rows, matrix.Columns);
        for (int position = 0; position < matrix.Rows; position++)
        {
            result[position] = ApplyRoPETo(matrix[position], headDimension, position);
        }

        return result;
    }

    // Grouped Query Attention: each KV head is shared by a group of query heads.
    // With 32 query heads and 4 KV heads, every 8 query heads attend against the same key/value head.
    // This saves memory and compute on K/V projections while keeping Q expressive.
    private Matrix GroupedQueryAttention(int sequenceLength, Matrix queries, Matrix keys, Matrix values)
    {
        Matrix output = new(sequenceLength, weights.HiddenDimension);

        var groupSize = weights.NumberdOfQueryHeads / weights.NumberOfKeyValueHeads;
        float scale = MathF.Sqrt(weights.HeadDimension);

        for (int queryHead = 0; queryHead < weights.NumberdOfQueryHeads; queryHead++)
        {
            var keyValueHead = queryHead / groupSize;
            var queryOffset = queryHead * weights.HeadDimension;
            var keyValueOffset = keyValueHead * weights.HeadDimension;


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
                        [queryOffset..(queryOffset + weights.HeadDimension)];
                    var keyVector = keys[lookingTo]
                        [keyValueOffset..(keyValueOffset + weights.HeadDimension)];

                    scores[lookingTo] = queryVector * keyVector / scale;
                }

                var attentionWeights = Softmax(scores);

                Vector outputVector = new(weights.HeadDimension);
                for (int j = 0; j < sequenceLength; j++)
                {
                    var valueVector = values[j]
                        [keyValueOffset..(keyValueOffset + weights.HeadDimension)];
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
            result[row] = SigmoidLinearUnit(input[row]);
        }

        return result;
    }

    public static Matrix RootMeanSquareNormalisation(Matrix input, Vector normWeight)
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

    private static Vector ApplyRoPETo(Vector v, int headDimension, int position)
    {
        int totalDimension = v.Length;
        Vector result = new(totalDimension);

        for (int headStart = 0; headStart < totalDimension; headStart += headDimension)
        {
            for (int j = 0; j < headDimension; j += 2)
            {
                var x1 = v[headStart + j];
                var x2 = v[headStart + j + 1];

                var theta = 1.0F / MathF.Pow(10000.0F, (float)j / headDimension);
                var angle = position * theta;
                var cos = MathF.Cos(angle);
                var sin = MathF.Sin(angle);

                result[headStart + j] = x1 * cos - x2 * sin;
                result[headStart + j + 1] = x1 * sin + x2 * cos;
            }
        }

        return result;
    }

    // Attend one query vector against all cached K/V (no causal mask needed —
    // every cached token is in the past or is the current token itself)
    private Vector GroupedQueryAttentionWithCache(
        Vector queryRow,
        List<Vector> cachedKeys,
        List<Vector> cachedValues)
    {
        int cacheLength = cachedKeys.Count;
        Vector output = new(weights.HiddenDimension);

        var groupSize = weights.NumberdOfQueryHeads / weights.NumberOfKeyValueHeads;
        float scale = MathF.Sqrt(weights.HeadDimension);

        for (int queryHead = 0; queryHead < weights.NumberdOfQueryHeads; queryHead++)
        {
            var keyValueHead = queryHead / groupSize;
            var queryOffset = queryHead * weights.HeadDimension;
            var keyValueOffset = keyValueHead * weights.HeadDimension;

            var queryForHead = queryRow[queryOffset..(queryOffset + weights.HeadDimension)];

            Vector scores = new(cacheLength);
            for (int t = 0; t < cacheLength; t++)
            {
                var key = cachedKeys[t][keyValueOffset..(keyValueOffset + weights.HeadDimension)];
                scores[t] = queryForHead * key / scale;
            }

            var attentionWeights = Softmax(scores);

            Vector headOutput = new(weights.HeadDimension);
            for (int t = 0; t < cacheLength; t++)
            {
                var value = cachedValues[t][keyValueOffset..(keyValueOffset + weights.HeadDimension)];
                headOutput += attentionWeights[t] * value;
            }

            for (int j = 0; j < weights.HeadDimension; j++)
            {
                output[queryOffset + j] = headOutput[j];
            }
        }

        return output;
    }

    public static Vector SigmoidLinearUnit(Vector input)
    {
        Vector result = new(input.Length);
        for (int i = 0; i < input.Length; i++)
        {
            float x = input[i];
            float sigmoid = 1 / (1 + MathF.Exp(-x));
            result[i] = x * sigmoid;
        }

        return result;
    }

}
