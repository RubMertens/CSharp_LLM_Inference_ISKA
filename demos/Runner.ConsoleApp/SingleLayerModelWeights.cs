using Runner.ConsoleApp.Math;

namespace Runner.ConsoleApp.RandomOneLayer;

public class SingleLayerModelWeights
{
    public int VocabularySize => EmbeddedTokens.Rows;
    public int HiddenDimension => EmbeddedTokens.Columns;

    public required Vector AttentionNormWeight { get; set; }
    public required Vector FeedForwardNormWeight { get; set; }

    /// <summary>
    /// rows = vocab size, cols = hidden dimension
    /// </summary>
    public required Matrix EmbeddedTokens { get; set; }

    /// <summary>
    /// hiddenDim x hiddenDim
    /// </summary>
    public required Matrix QueryProjection { get; set; }
    /// <summary>
    /// hiddenDim x hiddenDim
    /// </summary>
    public required Matrix KeyProjection { get; set; }
    /// <summary>
    /// hiddenDim x hiddenDim
    /// </summary>
    public required Matrix ValueProjection { get; set; }
    /// <summary>
    /// hiddenDim x hiddenDim — projects attention output back
    /// </summary>
    public required Matrix OutputProjection { get; set; }

    /// <summary>
    /// hiddenDim x vocabSize — projects hidden state to logits
    /// </summary>
    public required Matrix OutputEmbedding { get; set; }

}