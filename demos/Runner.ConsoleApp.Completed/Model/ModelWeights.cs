namespace Runner.ConsoleApp.Completed.Model;

public class ModelWeights
{
    public float[][] EmbedTokens { get; }
    public float[][] InputLayerNorm { get; }
    public float[][] QueryProjection { get; }
    public float[][] KeyProjection { get; }
    public float[][] ValueProjection { get; }
    public float[][] OutputProjection { get; }
    public float[][] PostAttentionLayerNorm { get; }
    public float[][] GateProjection { get; }
    public float[][] UpProjection { get; }
    public float[][] DownProjection { get; }
    public float[] FinalNorm { get; }
    public float[] LanguageModelHead { get; }

    private ModelWeights(
        float[][] embedTokens,
        float[][] inputLayerNorm,
        float[][] queryProjection, float[][] keyProjection, float[][] valueProjection, float[][] outputProjection,
        float[][] postAttentionLayerNorm,
        float[][] gateProjection, float[][] upProjection, float[][] downProjection,
        float[] finalNorm, float[] languageModelHead)
    {
        EmbedTokens = embedTokens;
        InputLayerNorm = inputLayerNorm;
        QueryProjection = queryProjection;
        KeyProjection = keyProjection;
        ValueProjection = valueProjection;
        OutputProjection = outputProjection;
        PostAttentionLayerNorm = postAttentionLayerNorm;
        GateProjection = gateProjection;
        UpProjection = upProjection;
        DownProjection = downProjection;
        FinalNorm = finalNorm;
        LanguageModelHead = languageModelHead;
    }

    public static ModelWeights Load(string modelPath)
    {
        using var reader = new SafetensorsReader(modelPath);

        var embedFlat = reader.ReadTensor("model.embed_tokens.weight");
        var embedTokens = new float[ModelConfig.VocabularySize][];
        for (int i = 0; i < ModelConfig.VocabularySize; i++)
        {
            embedTokens[i] = new float[ModelConfig.Dimension];
            Array.Copy(embedFlat, i * ModelConfig.Dimension, embedTokens[i], 0, ModelConfig.Dimension);
        }

        var inputLayerNorm = new float[ModelConfig.NumLayers][];
        var queryProjection = new float[ModelConfig.NumLayers][];
        var keyProjection = new float[ModelConfig.NumLayers][];
        var valueProjection = new float[ModelConfig.NumLayers][];
        var outputProjection = new float[ModelConfig.NumLayers][];
        var postAttentionLayerNorm = new float[ModelConfig.NumLayers][];
        var gateProjection = new float[ModelConfig.NumLayers][];
        var upProjection = new float[ModelConfig.NumLayers][];
        var downProjection = new float[ModelConfig.NumLayers][];

        for (int l = 0; l < ModelConfig.NumLayers; l++)
        {
            Console.WriteLine($"Loading layer {l + 1}/{ModelConfig.NumLayers}...");

            inputLayerNorm[l] = reader.ReadTensor($"model.layers.{l}.input_layernorm.weight");
            queryProjection[l] = reader.ReadTensor($"model.layers.{l}.self_attn.q_proj.weight");
            keyProjection[l] = reader.ReadTensor($"model.layers.{l}.self_attn.k_proj.weight");
            valueProjection[l] = reader.ReadTensor($"model.layers.{l}.self_attn.v_proj.weight");
            outputProjection[l] = reader.ReadTensor($"model.layers.{l}.self_attn.o_proj.weight");
            postAttentionLayerNorm[l] = reader.ReadTensor($"model.layers.{l}.post_attention_layernorm.weight");
            gateProjection[l] = reader.ReadTensor($"model.layers.{l}.mlp.gate_proj.weight");
            upProjection[l] = reader.ReadTensor($"model.layers.{l}.mlp.up_proj.weight");
            downProjection[l] = reader.ReadTensor($"model.layers.{l}.mlp.down_proj.weight");
        }

        var finalNorm = reader.ReadTensor("model.norm.weight");
        var languageModelHead = reader.ReadTensor("lm_head.weight");

        Console.WriteLine("Model weights loaded.");

        return new ModelWeights(
            embedTokens, inputLayerNorm,
            queryProjection, keyProjection, valueProjection, outputProjection,
            postAttentionLayerNorm,
            gateProjection, upProjection, downProjection,
            finalNorm, languageModelHead);
    }
}
