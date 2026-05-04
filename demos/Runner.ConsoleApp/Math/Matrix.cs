using System.Diagnostics;

namespace Runner.ConsoleApp.Math;

[DebuggerDisplay("Matrix: {Rows}x{Columns}")]
public class Matrix
{
    public float[][] Data { get; }
    public int Rows { get; }
    public int Columns { get; }

    public Matrix(int rows, int cols)
    {
        Rows = rows;
        Columns = cols;
        Data = new float[rows][];
        for (int i = 0; i < rows; i++)
            Data[i] = new float[cols];
    }

    public Matrix(float[][] data, int rows, int cols)
    {
        Rows = rows;
        Columns = cols;
        //validations

        if (data.Length != rows)
            throw new ArgumentException($"Data row count {data.Length} does not match specified rows {rows}.");
        for (int i = 0; i < rows; i++)
        {
            if (data[i].Length != cols)
                throw new ArgumentException($"Data column count {data[i].Length} in row {i} does not match specified columns {cols}.");
        }

        Data = data;
    }

    public float this[int row, int col]
    {
        get => Data[row][col];
        set => Data[row][col] = value;
    }
    public Vector this[int row]
    {
        get => new(Data[row], Columns);
        set => Data[row] = value.Data;
    }


    public static Matrix operator *(Matrix a, Matrix b)
    {
        if (a.Columns != b.Rows)
            throw new InvalidOperationException("Incompatible matrix dimensions for multiplication.");

        Matrix result = new Matrix(a.Rows, b.Columns);
        for (var i = 0; i < a.Rows; i++)
        {
            for (var j = 0; j < b.Columns; j++)
            {
                float sum = 0;
                for (int k = 0; k < a.Columns; k++)
                {
                    sum += a.Data[i][k] * b.Data[k][j];
                }
                result.Data[i][j] = sum;
            }
        }
        return result;
    }

    public static Matrix operator +(Matrix a, Matrix b)
    {
        if (a.Rows != b.Rows || a.Columns != b.Columns)
            throw new InvalidOperationException("Incompatible matrix dimensions for addition.");

        Matrix result = new Matrix(a.Rows, a.Columns);
        for (var i = 0; i < a.Rows; i++)
        {
            for (var j = 0; j < a.Columns; j++)
            {
                result.Data[i][j] = a.Data[i][j] + b.Data[i][j];
            }
        }
        return result;
    }

    public Matrix ElementwiseMultiply(Matrix other)
    {
        return ElementwiseMultiply(this, other);
    }
    public static Matrix ElementwiseMultiply(Matrix a, Matrix b)
    {
        if (a.Rows != b.Rows || a.Columns != b.Columns)
            throw new InvalidOperationException("Incompatible matrix dimensions for element-wise multiplication.");

        Matrix result = new Matrix(a.Rows, a.Columns);
        for (var i = 0; i < a.Rows; i++)
        {
            for (var j = 0; j < a.Columns; j++)
            {
                result.Data[i][j] = a.Data[i][j] * b.Data[i][j];
            }
        }
        return result;
    }
}