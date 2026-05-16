# TinyLlama-1.1B-Chat-v1.0 Model Parameters

## Overview

| Property | Value |
|---|---|
| Model | TinyLlama/TinyLlama-1.1B-Chat-v1.0 |
| Architecture | LlamaForCausalLM |
| Parameter count | ~1.1B |
| Model type | llama |
| Training dtype | bfloat16 |
| Activation | SiLU |
| RMS norm epsilon | 1e-05 |

## Key Config Values

| Config field | Value |
|---|---|
| `vocab_size` | 32,000 |
| `hidden_size` | 2,048 |
| `num_hidden_layers` | 22 |
| `num_attention_heads` | 32 |
| `num_key_value_heads` | 4 |
| Head dimension | 64 (= 2048 / 32) |
| `intermediate_size` | 5,632 |
| `max_position_embeddings` | 2,048 |
| `rope_theta` | 10,000.0 |
| `rope_scaling` | null |
| `attention_bias` | false |
| `tie_word_embeddings` | false |

## Dimension Mapping to Our Weight Classes

### Derived dimensions

- **hiddenDim** = 2,048
- **vocabSize** = 32,000
- **keyValueDim** = num_key_value_heads * head_dim = 4 * 64 = 256
- **gateDim** (intermediate_size) = 5,632
- **head_dim** = hidden_size / num_attention_heads = 2,048 / 32 = 64

### ModelWeights

| Field | Shape | Dimensions |
|---|---|---|
| EmbeddedTokens | vocabSize x hiddenDim | 32,000 x 2,048 |
| OutputEmbedding | hiddenDim x vocabSize | 2,048 x 32,000 |
| FinalNormWeight | hiddenDim | 2,048 |
| NumberOfQueryHeads | | 32 |
| NumberOfKeyValueHeads | | 4 |
| HeadDimension | | 64 |
| Layers | | 22 layers |

### LayerWeights (per layer)

| Field | Shape | Dimensions |
|---|---|---|
| AttentionNormWeight | hiddenDim | 2,048 |
| FeedForwardNormWeight | hiddenDim | 2,048 |
| QueryProjection | hiddenDim x hiddenDim | 2,048 x 2,048 |
| KeyProjection | hiddenDim x keyValueDim | 2,048 x 256 |
| ValueProjection | hiddenDim x keyValueDim | 2,048 x 256 |
| OutputProjection | hiddenDim x hiddenDim | 2,048 x 2,048 |
| GateProjection | hiddenDim x gateDim | 2,048 x 5,632 |
| UpProjection | hiddenDim x gateDim | 2,048 x 5,632 |
| DownProjection | gateDim x hiddenDim | 5,632 x 2,048 |

## GQA Configuration

TinyLlama uses **Grouped-Query Attention (GQA)**, not standard Multi-Head Attention (MHA).

- 32 query heads, 4 key-value heads
- Group ratio: 32 / 4 = **8 query heads per KV head**
- Each group of 8 query heads shares a single key and value head
- This reduces KV cache memory by 8x compared to full MHA

## Parameter Count Breakdown

| Component | Parameters | Count |
|---|---|---|
| Token embedding | 32,000 x 2,048 | 65,536,000 |
| Output embedding | 2,048 x 32,000 | 65,536,000 |
| Final RMS norm | 2,048 | 2,048 |
| **Per-layer attention** | | |
| - Attention norm | 2,048 | 2,048 |
| - Q projection | 2,048 x 2,048 | 4,194,304 |
| - K projection | 2,048 x 256 | 524,288 |
| - V projection | 2,048 x 256 | 524,288 |
| - O projection | 2,048 x 2,048 | 4,194,304 |
| **Per-layer FFN** | | |
| - FFN norm | 2,048 | 2,048 |
| - Gate projection | 2,048 x 5,632 | 11,534,336 |
| - Up projection | 2,048 x 5,632 | 11,534,336 |
| - Down projection | 5,632 x 2,048 | 11,534,336 |
| **Per-layer total** | | **44,046,288** |
| **All 22 layers** | | **969,018,336** |
| **Embeddings + norm** | | **131,074,048** |
| **Grand total** | | **~1,100,092,384 (~1.1B)** |
