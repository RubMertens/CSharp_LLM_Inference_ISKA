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

    public float this[int index]
    {
        get => Data[index];
        set => Data[index] = value;
    }
}