namespace Runner.ConsoleApp.Completed;

public static class ModelConfig
{
    public const int Dimension = 2048;
    public const int HiddenDimension = 5632;
    public const int NumLayers = 22;
    public const int NumHeads = 32;
    public const int NumKvHeads = 4;
    public const int HeadDim = 64;
    public const int KeyValueDimension = 256;
    public const int KvMul = 8;
    public const int VocabularySize = 32000;
    public const int MaxSequenceLength = 2048;
    public const float RmsNormEps = 1e-5f;
    public const float RopeTheta = 10000.0f;
}
