namespace Runner.ConsoleApp.Completed.Model;

public class KvCache
{
    public float[] KeyCache { get; }
    public float[] ValueCache { get; }

    public KvCache()
    {
        int size = ModelConfig.NumLayers * ModelConfig.MaxSequenceLength * ModelConfig.KeyValueDimension;
        KeyCache = new float[size];
        ValueCache = new float[size];
    }

    public int Offset(int layer, int pos) =>
        layer * ModelConfig.MaxSequenceLength * ModelConfig.KeyValueDimension + pos * ModelConfig.KeyValueDimension;
}
