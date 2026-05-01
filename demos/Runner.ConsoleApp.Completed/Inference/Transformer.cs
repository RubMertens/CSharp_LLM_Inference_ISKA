namespace Runner.ConsoleApp.Completed.Inference;

using Runner.ConsoleApp.Completed.Math;
using Runner.ConsoleApp.Completed.Model;

public class Transformer
{
    private readonly ModelWeights _weights;
    private readonly KvCache _cache;

    private readonly float[] _residual;
    private readonly float[] _normalized;
    private readonly float[] _attentionOutput;
    private readonly float[] _query;
    private readonly float[] _key;
    private readonly float[] _value;
    private readonly float[] _attention;
    private readonly float[] _gate;
    private readonly float[] _up;
    private readonly float[] _logits;

    public Transformer(ModelWeights weights, KvCache cache)
    {
        _weights = weights;
        _cache = cache;

        _residual = new float[ModelConfig.Dimension];
        _normalized = new float[ModelConfig.Dimension];
        _attentionOutput = new float[ModelConfig.Dimension];
        
        _query = new float[ModelConfig.Dimension];
        _key = new float[ModelConfig.KeyValueDimension];
        _value = new float[ModelConfig.KeyValueDimension];
        _attention = new float[ModelConfig.MaxSequenceLength];

        _gate = new float[ModelConfig.HiddenDimension];
        _up = new float[ModelConfig.HiddenDimension];
        _logits = new float[ModelConfig.VocabularySize];
    }

    public float[] Forward(int token, int pos)
    {
        Array.Copy(_weights.EmbedTokens[token], _residual, ModelConfig.Dimension);

        for (int l = 0; l < ModelConfig.NumLayers; l++)
        {
            Attention(l, pos);
            FeedForward(l);
        }

        RmsNormOp.RmsNorm(_residual, _residual, _weights.FinalNorm, ModelConfig.Dimension, ModelConfig.RmsNormEps);
        FloatVector.MatVec(_logits, _weights.LanguageModelHead, _residual, ModelConfig.VocabularySize, ModelConfig.Dimension);

        return _logits;
    }

    private void Attention(int layer, int pos)
    {
        RmsNormOp.RmsNorm(_normalized, _residual, _weights.InputLayerNorm[layer], ModelConfig.Dimension, ModelConfig.RmsNormEps);

        FloatVector.MatVec(_query, _weights.QueryProjection[layer], _normalized, ModelConfig.Dimension, ModelConfig.Dimension);
        FloatVector.MatVec(_key, _weights.KeyProjection[layer], _normalized, ModelConfig.KeyValueDimension, ModelConfig.Dimension);
        FloatVector.MatVec(_value, _weights.ValueProjection[layer], _normalized, ModelConfig.KeyValueDimension, ModelConfig.Dimension);

        RoPEOp.Apply(_query, _key, pos, ModelConfig.HeadDim, ModelConfig.KeyValueDimension, ModelConfig.RopeTheta);

        int cacheOffset = _cache.Offset(layer, pos);
        Array.Copy(_key, 0, _cache.KeyCache, cacheOffset, ModelConfig.KeyValueDimension);
        Array.Copy(_value, 0, _cache.ValueCache, cacheOffset, ModelConfig.KeyValueDimension);

        for (int h = 0; h < ModelConfig.NumHeads; h++)
        {
            int qOffset = h * ModelConfig.HeadDim;
            int kvHead = h / ModelConfig.KvMul;
            float scale = 1.0f / MathF.Sqrt(ModelConfig.HeadDim);

            for (int t = 0; t <= pos; t++)
            {
                int keyCacheOffset = _cache.Offset(layer, t) + kvHead * ModelConfig.HeadDim;
                _attention[t] = FloatVector.Dot(_query, qOffset, _cache.KeyCache, keyCacheOffset, ModelConfig.HeadDim) * scale;
            }

            SoftmaxOp.Softmax(_attention, 0, pos + 1);

            for (int d = 0; d < ModelConfig.HeadDim; d++)
                _attentionOutput[qOffset + d] = 0f;

            for (int t = 0; t <= pos; t++)
            {
                int valCacheOffset = _cache.Offset(layer, t) + kvHead * ModelConfig.HeadDim;
                float a = _attention[t];
                for (int d = 0; d < ModelConfig.HeadDim; d++)
                    _attentionOutput[qOffset + d] += a * _cache.ValueCache[valCacheOffset + d];
            }
        }

        FloatVector.MatVec(_normalized, _weights.OutputProjection[layer], _attentionOutput, ModelConfig.Dimension, ModelConfig.Dimension);
        FloatVector.Add(_residual, _normalized, ModelConfig.Dimension);
    }

    private void FeedForward(int layer)
    {
        RmsNormOp.RmsNorm(_normalized, _residual, _weights.PostAttentionLayerNorm[layer], ModelConfig.Dimension, ModelConfig.RmsNormEps);

        FloatVector.MatVec(_gate, _weights.GateProjection[layer], _normalized, ModelConfig.HiddenDimension, ModelConfig.Dimension);
        FloatVector.MatVec(_up, _weights.UpProjection[layer], _normalized, ModelConfig.HiddenDimension, ModelConfig.Dimension);

        for (int i = 0; i < ModelConfig.HiddenDimension; i++)
            _gate[i] = Silu(_gate[i]) * _up[i];

        FloatVector.MatVec(_normalized, _weights.DownProjection[layer], _gate, ModelConfig.Dimension, ModelConfig.HiddenDimension);
        FloatVector.Add(_residual, _normalized, ModelConfig.Dimension);
    }

    private static float Silu(float x) => x / (1.0f + MathF.Exp(-x));
}
