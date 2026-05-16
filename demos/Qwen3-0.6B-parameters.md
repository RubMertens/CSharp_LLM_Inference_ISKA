# Qwen3-0.6B Model Parameters

## Model Overview

| Property | Value |
|---|---|
| Name | Qwen/Qwen3-0.6B |
| Architecture | Qwen3ForCausalLM (decoder-only transformer) |
| Parameter count | ~0.6B |
| Model type | qwen3 |
| Native dtype | bfloat16 |

## Key Configuration Values

| Config field | Value |
|---|---|
| `vocab_size` | 151,936 |
| `hidden_size` | 1,024 |
| `num_hidden_layers` | 28 |
| `num_attention_heads` | 16 |
| `num_key_value_heads` | 8 |
| `head_dim` | 128 |
| `intermediate_size` | 3,072 |
| `max_position_embeddings` | 40,960 |
| `rope_theta` | 1,000,000 |
| `rope_scaling` | null |
| `hidden_act` | silu |
| `rms_norm_eps` | 1e-6 |
| `attention_bias` | false |
| `tie_word_embeddings` | true |
| `sliding_window` | null |

## Derived Dimensions

| Dimension | Formula | Value |
|---|---|---|
| hiddenDim | `hidden_size` | 1,024 |
| keyValueDim | `num_key_value_heads * head_dim` | 8 * 128 = 1,024 |
| queryDim | `num_attention_heads * head_dim` | 16 * 128 = 2,048 |
| gateDim / intermediateDim | `intermediate_size` | 3,072 |

Note: `queryDim` (2,048) != `hidden_size` (1,024) because `head_dim` is explicitly set to 128 rather than being derived as `hidden_size / num_attention_heads` (which would give 64).

## Weight Dimension Mapping

### ModelWeights

| Our field | Shape | Qwen3-0.6B dimensions | Safetensors key |
|---|---|---|---|
| EmbeddedTokens | vocabSize x hiddenDim | 151,936 x 1,024 | `model.embed_tokens.weight` |
| OutputEmbedding | hiddenDim x vocabSize | **tied** (transpose of EmbeddedTokens) | `lm_head.weight` (absent; reuse embed_tokens) |
| FinalNormWeight | hiddenDim | 1,024 | `model.norm.weight` |
| NumberOfQueryHeads | scalar | 16 | `num_attention_heads` |
| NumberOfKeyValueHeads | scalar | 8 | `num_key_value_heads` |
| HeadDimension | scalar | 128 | `head_dim` |

### LayerWeights (per layer, 28 layers)

| Our field | Shape | Qwen3-0.6B dimensions | Safetensors key pattern |
|---|---|---|---|
| AttentionNormWeight | hiddenDim | 1,024 | `model.layers.{l}.input_layernorm.weight` |
| FeedForwardNormWeight | hiddenDim | 1,024 | `model.layers.{l}.post_attention_layernorm.weight` |
| QueryProjection | hiddenDim x queryDim | 1,024 x 2,048 | `model.layers.{l}.self_attn.q_proj.weight` |
| KeyProjection | hiddenDim x keyValueDim | 1,024 x 1,024 | `model.layers.{l}.self_attn.k_proj.weight` |
| ValueProjection | hiddenDim x keyValueDim | 1,024 x 1,024 | `model.layers.{l}.self_attn.v_proj.weight` |
| OutputProjection | queryDim x hiddenDim | 2,048 x 1,024 | `model.layers.{l}.self_attn.o_proj.weight` |
| GateProjection | hiddenDim x gateDim | 1,024 x 3,072 | `model.layers.{l}.mlp.gate_proj.weight` |
| UpProjection | hiddenDim x gateDim | 1,024 x 3,072 | `model.layers.{l}.mlp.up_proj.weight` |
| DownProjection | gateDim x hiddenDim | 3,072 x 1,024 | `model.layers.{l}.mlp.down_proj.weight` |

## GQA Configuration

Qwen3-0.6B uses **Grouped Query Attention (GQA)**, not standard MHA.

- 16 query heads, 8 KV heads
- GQA group size = 16 / 8 = **2 query heads per KV head**
- Each KV head is shared by 2 query heads

This is a moderate GQA ratio. During attention, each pair of query heads shares the same key and value head, reducing KV cache memory by 2x compared to full MHA.

## Tied Embeddings

`tie_word_embeddings: true` -- the input embedding matrix and output (lm_head) projection share the same weights. There is no separate `lm_head.weight` tensor in the safetensors files. The output logits are computed by multiplying the final hidden state by the transpose of `model.embed_tokens.weight`.

## Parameter Count Breakdown (approximate)

| Component | Formula | Parameters |
|---|---|---|
| Token embeddings | 151,936 x 1,024 | 155,582,464 |
| Per-layer attention norms (x28) | 28 x 1,024 | 28,672 |
| Per-layer Q projection (x28) | 28 x 1,024 x 2,048 | 58,720,256 |
| Per-layer K projection (x28) | 28 x 1,024 x 1,024 | 29,360,128 |
| Per-layer V projection (x28) | 28 x 1,024 x 1,024 | 29,360,128 |
| Per-layer O projection (x28) | 28 x 2,048 x 1,024 | 58,720,256 |
| Per-layer FFN norms (x28) | 28 x 1,024 | 28,672 |
| Per-layer gate projection (x28) | 28 x 1,024 x 3,072 | 88,080,384 |
| Per-layer up projection (x28) | 28 x 1,024 x 3,072 | 88,080,384 |
| Per-layer down projection (x28) | 28 x 3,072 x 1,024 | 88,080,384 |
| Final norm | 1,024 | 1,024 |
| Output head (tied) | 0 (shared with embeddings) | 0 |
| **Total** | | **~596M** |

## Compatibility Notes with C# Implementation

### 1. HeadDimension calculation -- MISMATCH

**Our code:** `HeadDimension = HiddenDimension / NumberOfQueryHeads` = 1,024 / 16 = **64**
**Qwen3-0.6B:** `head_dim` = **128**

Qwen3-0.6B explicitly sets `head_dim: 128`, making `queryDim = num_heads * head_dim = 16 * 128 = 2,048`, which is larger than `hidden_size` (1,024). The Q and O projections are **not square** -- they map between 1,024 and 2,048. The C# implementation assumes `HeadDimension = HiddenDimension / NumberOfQueryHeads`, which produces the wrong value for this model.

### 2. QueryProjection shape -- MISMATCH

**Our code:** `hiddenDim x hiddenDim` (1,024 x 1,024)
**Qwen3-0.6B:** `hiddenDim x queryDim` (1,024 x 2,048)

The Q projection output dimension is `num_attention_heads * head_dim = 2,048`, not `hidden_size`.

### 3. OutputProjection shape -- MISMATCH

**Our code:** `hiddenDim x hiddenDim` (1,024 x 1,024)
**Qwen3-0.6B:** `queryDim x hiddenDim` (2,048 x 1,024)

Same root cause as above. The output projection maps from the concatenated head outputs (2,048) back to hidden_size (1,024).

### 4. Tied embeddings -- needs handling

The model has no separate `lm_head.weight`. The `OutputEmbedding` matrix must be constructed as the transpose of `EmbeddedTokens`. The completed reference implementation loads `lm_head.weight` as a separate tensor, which will fail for this model.

### 5. RMSNorm epsilon -- minor difference

**Our code:** `1e-5f`
**Completed reference:** `1e-5f`
**Qwen3-0.6B:** `1e-6`

Off by 10x. Unlikely to cause major issues but technically incorrect.

### 6. RoPE theta -- large difference

**Completed reference:** `10,000`
**Qwen3-0.6B:** `1,000,000`

100x larger theta. This significantly affects positional encoding frequencies and must be updated for correct long-context behavior.

### 7. Attention bias -- compatible

Qwen3-0.6B has `attention_bias: false`. The C# implementation does not add bias terms to Q/K/V/O projections, so this is already correct.

### 8. Vocabulary size

**Completed reference:** 32,000 (Llama-style)
**Qwen3-0.6B:** 151,936

The `ModelConfig` constants need updating. The large vocab size (151,936) means the embedding matrix alone is ~156M parameters.

### Summary of Required Changes

1. **Critical:** Add explicit `head_dim` field instead of deriving it from `hidden_size / num_heads`
2. **Critical:** Update Q/O projection shapes to use `num_heads * head_dim` instead of `hidden_size`
3. **Critical:** Handle tied embeddings (transpose embed_tokens for output)
4. **Minor:** Update RMSNorm epsilon to `1e-6`
5. **Minor:** Update RoPE theta to `1,000,000`
6. **Config:** Update all ModelConfig constants for Qwen3-0.6B dimensions
