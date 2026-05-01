namespace Runner.ConsoleApp.Completed.Math;

public static class RoPEOp
{
    public static void Apply(float[] q, float[] k, int pos, int headDim, int kvDim, float theta)
    {
        for (int i = 0; i < q.Length; i += 2)
        {
            int headDimIdx = i % headDim;
            float freq = 1.0f / MathF.Pow(theta, headDimIdx / (float)headDim);
            float angle = pos * freq;
            float cosVal = MathF.Cos(angle);
            float sinVal = MathF.Sin(angle);

            float v0 = q[i];
            float v1 = q[i + 1];
            q[i] = v0 * cosVal - v1 * sinVal;
            q[i + 1] = v0 * sinVal + v1 * cosVal;

            if (i < kvDim)
            {
                v0 = k[i];
                v1 = k[i + 1];
                k[i] = v0 * cosVal - v1 * sinVal;
                k[i + 1] = v0 * sinVal + v1 * cosVal;
            }
        }
    }
}
