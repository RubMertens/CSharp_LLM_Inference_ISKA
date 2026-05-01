namespace Runner.ConsoleApp.Completed.Math;

public static class SoftmaxOp
{
    public static void Softmax(float[] x, int offset, int length)
    {
        float maxVal = float.MinValue;
        for (int i = 0; i < length; i++)
        {
            if (x[offset + i] > maxVal)
                maxVal = x[offset + i];
        }

        float sum = 0f;
        for (int i = 0; i < length; i++)
        {
            x[offset + i] = MathF.Exp(x[offset + i] - maxVal);
            sum += x[offset + i];
        }

        for (int i = 0; i < length; i++)
        {
            x[offset + i] /= sum;
        }
    }
}
