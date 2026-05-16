# Qwen3.5-0.8B Model Parameters

## Model Overview

| Property | Value |
|----------|-------|
| Model | Qwen/Qwen3.5-0.8B |
| Architecture class | `Qwen3_5ForConditionalGeneration` |
| Architecture family | Qwen3.5 (multimodal: vision + text) |
| Text model type | `qwen3_5_text` |
| Parameter count | ~0.8B |
| Precision | bfloat16 |
| Attention type | Hybrid (mixed linear + full attention) |

**Important:** Qwen3.5-0.8B is a multimodal vision-language model, not a pure text decoder. Its text backbone uses a hybrid attention pattern: 18 linear attention layers and 6 full attention layers in a repeating pattern (3 linear, 1 full). The full attention layers use standard GQA (8 query heads, 2 KV heads). The linear attention layers use a separate head configuration (16 KV heads, different head dimensions). This hybrid architecture does not map cleanly to a standard decoder-only transformer implementation.

## Key Config Values (Text Component)

| Parameter | Config field | Value |
|-----------|-------------|-------|
| Vocab size | `vocab_size` | 248,320 |
| Hidden dimension | `hidden_size` | 1,024 |
| Number of layers | `num_hidden_layers` | 24 |
| Number of query heads (full attn) | `num_attention_heads` | 8 |
| Number of KV heads (full attn) | `num_key_value_heads` | 2 |
| Head dimension (full attn) | `head_dim` | 256 |
| Linear attention KV heads | `linear_num_key_heads` / `linear_num_value_heads` | 16 / 16 |
| Linear attention key head dim | `linear_key_head_dim` | 128 |
| Linear attention value head dim | `linear_value_head_dim` | 128 |
| Intermediate (gate) dimension | `intermediate_size` | 3,584 |
| Max context length | `max_position_embeddings` | 262,144 |
| RoPE theta | `rope_theta` | 10,000,000 |
| RoPE type | `rope_type` | default |
| Partial rotary factor | `partial_rotary_factor` | 0.25 |
| M-RoPE sections | `mrope_section` | [11, 11, 10] |
| Activation function | `hidden_act` | SiLU |
| RMS norm epsilon | `rms_norm_eps` | 1e-6 |
| Tied embeddings | `tie_word_embeddings` | true |
| Full attention interval | `full_attention_interval` | 4 |
| Linear conv kernel dim | `linear_conv_kernel_dim` | 4 |
| Attention bias | `attention_bias` | false |
| Attention output gate | `attn_output_gate` | true |

## Mapping to Our Weight Classes

### ModelWeights

| Our field | Shape | Qwen3.5-0.8B dimension | Notes |
|-----------|-------|------------------------|-------|
| EmbeddedTokens | vocabSize x hiddenDim | 248,320 x 1,024 | |
| OutputEmbedding | hiddenDim x vocabSize | N/A (tied) | `tie_word_embeddings=true`, so output embedding = transpose of EmbeddedTokens. No separate `lm_head` weight. |
| FinalNormWeight | hiddenDim | 1,024 | |
| NumberOfQueryHeads | scalar | 8 | For full attention layers only |
| NumberOfKeyValueHeads | scalar | 2 | For full attention layers only |
| HeadDimension | hiddenDim / numQueryHeads | 1,024 / 8 = 128 | **Mismatch:** config says `head_dim=256`, but 1024/8=128. The config `head_dim=256` means Q projection output is actually 8*256=2048, not equal to hidden_size. |
| Layers | array | 24 layers | |

### LayerWeights (Full Attention Layers: indices 3, 7, 11, 15, 19, 23)

| Our field | Shape | Qwen3.5-0.8B dimension | Notes |
|-----------|-------|------------------------|-------|
| AttentionNormWeight | hiddenDim | 1,024 | |
| FeedForwardNormWeight | hiddenDim | 1,024 | |
| QueryProjection | hiddenDim x queryDim | 1,024 x 2,048 | queryDim = num_attention_heads * head_dim = 8 * 256 = 2,048. **Not square** -- differs from our hiddenDim x hiddenDim assumption. |
| KeyProjection | hiddenDim x kvDim | 1,024 x 512 | kvDim = num_kv_heads * head_dim = 2 * 256 = 512 |
| ValueProjection | hiddenDim x kvDim | 1,024 x 512 | Same as KeyProjection |
| OutputProjection | queryDim x hiddenDim | 2,048 x 1,024 | Projects attention output back to hidden_size. **Not square.** |
| GateProjection | hiddenDim x gateDim | 1,024 x 3,584 | |
| UpProjection | hiddenDim x gateDim | 1,024 x 3,584 | |
| DownProjection | gateDim x hiddenDim | 3,584 x 1,024 | |

### LayerWeights (Linear Attention Layers: indices 0,1,2, 4,5,6, etc.)

Linear attention layers have different projection dimensions:

| Our field | Shape | Qwen3.5-0.8B dimension | Notes |
|-----------|-------|------------------------|-------|
| QueryProjection | hiddenDim x ? | 1,024 x ? | Uses `num_attention_heads` (8) but linear key/value heads differ |
| KeyProjection | hiddenDim x linearKvDim | 1,024 x 2,048 | linear_num_key_heads(16) * linear_key_head_dim(128) = 2,048 |
| ValueProjection | hiddenDim x linearVvDim | 1,024 x 2,048 | linear_num_value_heads(16) * linear_value_head_dim(128) = 2,048 |
| GateProjection | hiddenDim x gateDim | 1,024 x 3,584 | Same as full attention layers |
| UpProjection | hiddenDim x gateDim | 1,024 x 3,584 | Same |
| DownProjection | gateDim x hiddenDim | 3,584 x 1,024 | Same |

## GQA Configuration

For **full attention layers**: Grouped Query Attention (GQA) with group ratio 4:1.
- 8 query heads share 2 KV heads
- Each group of 4 query heads shares 1 KV head
- This is true GQA (not MHA where q_heads == kv_heads, not MQA where kv_heads == 1)

For **linear attention layers**: MHA-like configuration with 16 KV heads.
- The linear attention mechanism has its own separate head counts and dimensions
- This is a fundamentally different attention mechanism from standard scaled dot-product attention

## Estimated Parameter Breakdown

Assuming bfloat16 (2 bytes per parameter). Using full attention layer dimensions as representative.

| Component | Params per instance | Count | Total params |
|-----------|-------------------|-------|-------------|
| Token embeddings | 248,320 * 1,024 | 1 | 254,279,680 |
| Per-layer attention norms | 1,024 | 24 | 24,576 |
| Per-layer FFN norms | 1,024 | 24 | 24,576 |
| Per-layer Q projection (full, approx) | 1,024 * 2,048 | 6 | 12,582,912 |
| Per-layer K projection (full) | 1,024 * 512 | 6 | 3,145,728 |
| Per-layer V projection (full) | 1,024 * 512 | 6 | 3,145,728 |
| Per-layer O projection (full) | 2,048 * 1,024 | 6 | 12,582,912 |
| Per-layer K projection (linear) | 1,024 * 2,048 | 18 | 37,748,736 |
| Per-layer V projection (linear) | 1,024 * 2,048 | 18 | 37,748,736 |
| Per-layer gate projection | 1,024 * 3,584 | 24 | 88,080,384 |
| Per-layer up projection | 1,024 * 3,584 | 24 | 88,080,384 |
| Per-layer down projection | 3,584 * 1,024 | 24 | 88,080,384 |
| Final norm | 1,024 | 1 | 1,024 |
| Output head (tied) | 0 | - | 0 |
| **Subtotal (estimated)** | | | **~625M** |

Note: This estimate is rough. Linear attention layers also have conv kernels and potentially different Q projection sizes not fully specified in the config. The remaining parameters likely come from the vision encoder (~300M), linear attention Q projections, conv1d kernels, attention output gates, and MTP (multi-token prediction) layers (`mtp_num_hidden_layers=1`). The "0.8B" count includes the full multimodal model.

## Compatibility Notes for Our Implementation

1. **Tied embeddings**: No separate `lm_head` weight exists. Output logits use the transpose of the input embedding matrix.
2. **Non-square Q/O projections**: `head_dim=256` means Q output dim (2048) != hidden_size (1024). Our code assumes `hiddenDim x hiddenDim` for Q and O projections -- this would need adjustment.
3. **Hybrid attention**: Two distinct attention mechanisms per layer type. Our single-path attention loop cannot represent this without branching per layer type.
4. **M-RoPE**: Uses multimodal RoPE with 3 sections [11,11,10] for spatial/temporal dimensions, plus `partial_rotary_factor=0.25` (only 25% of head dimensions get rotary embeddings). Standard RoPE implementations need modification.
5. **Linear attention layers** use conv1d kernels (`linear_conv_kernel_dim=4`) and have their own head configuration -- this is a fundamentally different compute path.
6. **Attention output gate** (`attn_output_gate=true`): An additional gating mechanism on attention output not present in standard transformer implementations.
7. **Vision encoder**: Separate ViT with its own weights (depth 12, hidden 768, patch 16). Not relevant to text-only inference but present in the weight files.
