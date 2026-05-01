namespace Runner.ConsoleApp.Completed.Inference;

using SoftmaxOp = Runner.ConsoleApp.Completed.Math.SoftmaxOp;

public static class Sampler
{
    public static int TopK(float[] logits, int vocabSize, int k, float temperature, Random rng)
    {
        var topIndices = new int[k];
        var topValues = new float[k];

        for (int i = 0; i < k; i++)
        {
            topValues[i] = float.MinValue;
        }

        for (int i = 0; i < vocabSize; i++)
        {
            int minIdx = 0;
            for (int j = 1; j < k; j++)
            {
                if (topValues[j] < topValues[minIdx])
                    minIdx = j;
            }

            if (logits[i] > topValues[minIdx])
            {
                topValues[minIdx] = logits[i];
                topIndices[minIdx] = i;
            }
        }

        if (temperature <= 0)
        {
            int bestIdx = 0;
            for (int i = 1; i < k; i++)
            {
                if (topValues[i] > topValues[bestIdx])
                    bestIdx = i;
            }
            return topIndices[bestIdx];
        }

        for (int i = 0; i < k; i++)
        {
            topValues[i] /= temperature;
        }

        SoftmaxOp.Softmax(topValues, 0, k);

        float r = (float)rng.NextDouble();
        float cumulative = 0f;
        for (int i = 0; i < k; i++)
        {
            cumulative += topValues[i];
            if (r < cumulative)
                return topIndices[i];
        }

        return topIndices[k - 1];
    }
}
