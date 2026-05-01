namespace Runner.ConsoleApp.Completed.Math;



public static class FloatVector
{
    public static void MatVec(float[] output, float[] matrix, float[] input, int rows, int cols)
    {
        for (int i = 0; i < rows; i++)
        {
            float sum = 0f;
            int offset = i * cols;
            for (int j = 0; j < cols; j++)
            {
                sum += matrix[offset + j] * input[j];
            }
            output[i] = sum;
        }
    }

    public static void Add(float[] a, float[] b, int length)
    {
        for (int i = 0; i < length; i++)
        {
            a[i] += b[i];
        }
    }

    public static float Dot(float[] a, int aOffset, float[] b, int bOffset, int length)
    {
        float sum = 0f;
        for (int i = 0; i < length; i++)
        {
            sum += a[aOffset + i] * b[bOffset + i];
        }
        return sum;
    }
}
