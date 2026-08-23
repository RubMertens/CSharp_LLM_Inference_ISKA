using Runner.ConsoleApp.Math;

namespace Runner.ConsoleApp;


public class ModelWeights
{
    public int VocabularySize => EmbeddedTokens.Rows;
    public int HiddenDimension => EmbeddedTokens.Columns;

    public int NumberdOfQueryHeads {get;set;}
    public int NumberOfKeyValueHeads {get;set;}
    public int HeadDimension { get; set; }

    public required Matrix EmbeddedTokens { get; set; }

    public required LayerWeights[] Layers { get; set; }

    public required Matrix OutputEmbedding { get; set; }

    public required Vector FinalNormWeight { get; set; }
}

public class LayerWeights
{
    public required Vector AttentionNormWeight { get; set; }
    public required Vector FeedForwardNormWeight { get; set; }

    public required Matrix QueryProjection { get; set; }
    public required Matrix KeyProjection { get; set; }
    public required Matrix ValueProjection { get; set; }
    public required Matrix OutputProjection { get; set; }

    public required Matrix GateProjection { get; set; }
    public required Matrix UpProjection { get; set; }
    public required Matrix DownProjection { get; set; }
}
