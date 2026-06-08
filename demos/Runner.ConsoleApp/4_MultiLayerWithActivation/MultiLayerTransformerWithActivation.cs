using Runner.ConsoleApp.Math;

namespace Runner.ConsoleApp._4_MultiLayerWithActivation;



public class MultiLayerTransformerWithActivation(ModelWeights Weights)
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
            // embeddings is sequenceLength x hiddenDim, projection is hiddenDim x hiddenDim, result is sequenceLength x hiddenDim
            var queries = ApplyRoPETo(normalizedEmbeddings * layer.QueryProjection);
            var keys = ApplyRoPETo(normalizedEmbeddings * layer.KeyProjection);
            var values = normalizedEmbeddings * layer.ValueProjection;

            var attentionOutput = SingleHeadSelfAttention(Weights.HiddenDimension, sequenceLength, queries, keys, values);

            var projectedAttention = attentionOutput * layer.OutputProjection;

            embeddings = residual + projectedAttention;
            residual = embeddings;
            normalizedEmbeddings = RMSNorm(embeddings, layer.FeedForwardNormWeight);

            //gate and up projction are larger than hidden dimension, to allow for more complex interactions in the feedforward network
            Matrix gate= normalizedEmbeddings * layer.GateProjection;
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
    // by an angle proportional to sequence position, so attention naturally captures relative distance
    private static Matrix ApplyRoPETo(Matrix matrix)
    {
        float sequenceLength = matrix.Rows;
        float dimension = matrix.Columns;

        Matrix result = new(matrix.Rows, matrix.Columns);
        //for each of the vectors in the matrix (i.e. the amount of tokens)        
        for (int position = 0; position < sequenceLength; position++)
        {
            //rotate the pairs
            for (int j = 0; j < dimension; j += 2)
            {
                var x1 = matrix[position][j];
                var x2 = matrix[position][j + 1];

                //"low" dimensions rotate fast -> 0 / dimension = small exponent -> 10000^small = close to 1 -> 1/1 = large theta -> fast rotation
                //"high" dimensions rotate slower -> j / dimension = large exponent -> 10000^large = huge number -> 1/huge = tiny theta -> slow rotation
                var theta = 1.0F / MathF.Pow(10000.0F, j / dimension);

                //change the angle for the pair based on the position in the sequence
                var angle = position * theta;
                var cos = MathF.Cos(angle);
                var sin = MathF.Sin(angle);

                result[position][j] = x1 * cos - x2 * sin;
                result[position][j + 1] = x1 * sin + x2 * cos;
            }
        }
        return result;
    }

    private Matrix SingleHeadSelfAttention(int headDimension, int sequenceLength, Matrix queries, Matrix keys, Matrix values)
    {
        float scale = MathF.Sqrt(headDimension);

        Matrix attentionOutput = new(sequenceLength, headDimension);

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
                    // causality only looks backwards
                    scores[j] = float.NegativeInfinity;
                    continue;
                }
                // attention = query • key / sqrt(headDim)
                // dot product is a indication of how much 2 vectors are aligned
                // scaling to prevent large outputs (AxX + BxY + CxZ) can grow extremely large
                // in short how much does the vector representation of the question (query) align with the vector representation of the context (key)
                scores[j] = queries[i] * keys[j] / scale;
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

            attentionOutput[i] = attended;
        }
        return attentionOutput;
    }

    public static Matrix SigmoidLinearUnit(Matrix input)
    {
        Matrix result = new(input.Rows, input.Columns);

        for (int row = 0; row < input.Rows; row++)
        {
            for (int i = 0; i < input.Columns; i++)
            {
                float x =  input[row][i];
                float sigmoid = 1 / (1 + MathF.Exp(-x));
                result[row][i] = x * sigmoid;
            }
        }
        return result;
    }

    public static Matrix RMSNorm(Matrix input , Vector normWeight)
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
            result[i] = input[i] / rootMeanSquare * normWeight[i];

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