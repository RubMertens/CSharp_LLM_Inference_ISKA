using Runner.ConsoleApp.Math;

namespace Runner.ConsoleApp.RandomOneLayer;


public class ModelWeights
{
    public int VocabularySize => EmbeddedTokens.Rows;
    public int HiddenDimension => EmbeddedTokens.Columns;

    public int NumberdOfQueryHeads {get;set;}
    public int NumberOfKeyValueHeads {get;set;}
    public int HeadDimension { get; set; }
    // public int HeadDimension => HiddenDimension / NumberdOfQueryHeads;

    /// <summary>
    /// vocabSize x hiddenDim
    /// </summary>
    public required Matrix EmbeddedTokens { get; set; }

    public required LayerWeights[] Layers { get; set; }

    /// <summary>
    /// hiddenDim x vocabSize
    /// </summary>
    public required Matrix? OutputEmbedding { get; set; }

    /// <summary>
    /// hiddenDim
    /// </summary>
    public required Vector FinalNormWeight { get; set; }
}

public class LayerWeights
{
    /// <summary>
    /// hiddenDim
    /// </summary>
    public required Vector AttentionNormWeight { get; set; }

    /// <summary>
    /// hiddenDim
    /// </summary>
    public required Vector FeedForwardNormWeight { get; set; }

    /// <summary>
    /// hiddenDim x hiddenDim
    /// </summary>
    public required Matrix QueryProjection { get; set; }

    /// <summary>
    /// hiddenDim x keyValueDim
    /// </summary>
    public required Matrix KeyProjection { get; set; }

    /// <summary>
    /// hiddenDim x keyValueDim
    /// For simple demo: hiddenDim x hiddenDim is okay.
    /// </summary>
    public required Matrix ValueProjection { get; set; }

    /// <summary>
    /// hiddenDim x hiddenDim
    /// </summary>
    public required Matrix OutputProjection { get; set; }

    /// <summary>
    /// hiddenDim x gateDim
    /// (gateDim > hiddenDim)
    /// </summary>
    public required Matrix GateProjection { get; set; }
    /// <summary>
    /// hiddenDim x gateDim
    /// (gateDim > hiddenDim)
    /// </summary>
    
    public required Matrix UpProjection { get; set; }
    /// <summary>
    /// gateDim x hiddenDim
    /// (gateDim > hiddenDim)
    /// </summary>
    public required Matrix DownProjection { get; set; }
}