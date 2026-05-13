using System.Diagnostics;

namespace Runner.ConsoleApp.Math;

[DebuggerDisplay("Vector: {Length}")]
public class Vector
{
    public float[] Data { get; }
    public int Length { get; }

    public Vector(int size)
    {
        Length = size;
        Data = new float[size];
    }

    public Vector(float[] data, int length)
    {
        if (data.Length != length)
        {
            throw new ArgumentException($"Data length {data.Length} does not match specified length {length}.");
        }
        Length = length;
        Data = data;
    }

    public static float operator *(Vector a, Vector b)
    {
        if (a.Length != b.Length)
            throw new InvalidOperationException("Incompatible vector dimensions for dot product.");

        float sum = 0;
        for (var i = 0; i < a.Length; i++)
        {
            sum += a.Data[i] * b.Data[i];
        }
        return sum;
    }

    public static Vector operator +(Vector a, Vector b)
    {
        if (a.Length != b.Length)
            throw new InvalidOperationException("Incompatible vector dimensions for addition.");

        Vector result = new Vector(a.Length);
        for (var i = 0; i < a.Length; i++)
        {
            result.Data[i] = a.Data[i] + b.Data[i];
        }
        return result;
    }

    public static Vector operator *(Vector a, float scalar)
    {
        Vector result = new(a.Length);
        for (var i = 0; i < a.Length; i++)
        {
            result.Data[i] = a.Data[i] * scalar;
        }
        return result;
    }

    public float Dot(Vector other) => this * other;

    public static Vector operator *(float scalar, Vector a) => a * scalar;

    public static Vector operator *(Vector a, Matrix m)
    {
        if (a.Length != m.Rows)
            throw new InvalidOperationException("Incompatible dimensions for vector-matrix multiplication.");

        Vector result = new(m.Columns);
        for (var j = 0; j < m.Columns; j++)
        {
            float sum = 0;
            for (int i = 0; i < a.Length; i++)
            {
                sum += a.Data[i] * m.Data[i][j];
            }
            result.Data[j] = sum;
        }
        return result;
    }

    public float this[int index]
    {
        get => Data[index];
        set => Data[index] = value;
    }

    public Vector ElementwiseMultiply(Vector other)
    {
        Vector result = new(Length);
        for (int i = 0; i < Length; i++)
            result[i] = Data[i] * other.Data[i];
        return result;
    }

    public Vector this[Range range]
    {
        get
        {
            var (offset, length) = range.GetOffsetAndLength(Length);
            Vector result = new(length);
            Array.Copy(Data, offset, result.Data, 0, length);
            return result;
        }
    }
}