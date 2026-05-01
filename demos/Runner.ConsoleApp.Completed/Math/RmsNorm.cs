namespace Runner.ConsoleApp.Completed.Math;

public static class RmsNormOp
{
    public static void RmsNorm(float[] output, float[] x, float[] weight, int size, float eps = 1e-5f)
    {
        float ss = 0f;
        for (int j = 0; j < size; j++)
        {
            ss += x[j] * x[j];
        }
        ss /= size;
        ss = 1.0f / MathF.Sqrt(ss + eps);

        for (int j = 0; j < size; j++)
        {
            output[j] = weight[j] * (ss * x[j]);
        }
    }
}
