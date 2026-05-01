# TinyLlama v1.1 — Architecture Reference

## Model Overview

| Property | Value |
|---|---|
| **Model name** | TinyLlama_v1.1 |
| **Architecture** | LlamaForCausalLM (decoder-only transformer) |
| **Parameter count** | 1,100,048,384 (~1.1B) |
| **Architecture family** | LLaMA 2 |
| **Training data** | cerebras/SlimPajama-627B |
| **License** | Apache-2.0 |
| **ArXiv paper** | 2401.02385 |
| **Max sequence length** | 2048 tokens |
| **Vocabulary size** | 32,000 tokens |

## Model Hyperparameters

| Parameter | Value | Description |
|---|---|---|
| `num_hidden_layers` | 22 | Number of transformer blocks |
| `hidden_size` | 2048 | Embedding / residual stream dimension |
| `intermediate_size` | 5632 | FFN inner dimension (SwiGLU MLP) |
| `num_attention_heads` | 32 | Query heads |
| `num_key_value_heads` | 4 | KV heads (GQA, 8:1 ratio) |
| `head_dim` | 64 | Per-head dimension (hidden_size / num_attention_heads) |
| `vocab_size` | 32000 | Tokenizer vocabulary size |
| `max_position_embeddings` | 2048 | Maximum context length |
| `hidden_act` | silu | Activation function in MLP (SiLU / Swish) |
| `rms_norm_eps` | 1e-05 | RMSNorm epsilon |
| `rope_theta` | 10000.0 | RoPE base frequency |
| `rope_scaling` | null | No custom RoPE scaling |
| `tie_word_embeddings` | false | Embedding and LM head are separate matrices |
| `initializer_range` | 0.02 | Weight initialization std dev |
| `use_cache` | true | KV-cache enabled |
| `torch_dtype` | float32 | Storage precision |

### Derived Values

| Value | Formula | Result |
|---|---|---|
| `head_size` | hidden_size / n_heads | 64 |
| `kv_dim` | (hidden_size * n_kv_heads) / n_heads | 256 |
| `kv_mul` | n_heads / n_kv_heads | 8 |

### Parameter Breakdown

| Component | Parameters | Calculation |
|---|---|---|
| Embedding layer | 65,536,000 | vocab_size x hidden_size |
| Per transformer layer | 44,044,288 | See below |
| All 22 layers | 968,974,336 | 22 x 44,044,288 |
| Final RMSNorm | 2,048 | hidden_size |
| LM head (untied) | 65,536,000 | vocab_size x hidden_size |
| **Total** | **1,100,048,384** | |

Per-layer breakdown:

| Sub-component | Parameters | Calculation |
|---|---|---|
| Q projection | 4,194,304 | 2048 x 2048 |
| K projection | 524,288 | 2048 x 256 |
| V projection | 524,288 | 2048 x 256 |
| O projection | 4,194,304 | 2048 x 2048 |
| gate_proj (w1) | 11,534,336 | 2048 x 5632 |
| up_proj (w3) | 11,534,336 | 2048 x 5632 |
| down_proj (w2) | 11,534,336 | 5632 x 2048 |
| 2x RMSNorm | 4,096 | 2 x 2048 |
| **Layer total** | **44,044,288** | |

## Architecture Details

TinyLlama is a pre-norm decoder-only transformer. The data flow is:

```
input tokens
    -> Embedding Lookup
    -> [Transformer Block x 22]
    -> Final RMSNorm
    -> LM Head (linear projection)
    -> logits
```

### Embedding Layer

The embedding layer is a lookup table of shape `(vocab_size, hidden_size)` = `(32000, 2048)`.

Given an input token ID, the embedding layer copies the corresponding row to produce a float vector of size `(dim,)` = `(2048,)`. This vector enters the residual stream.

Weight name: `model.embed_tokens.weight`

### Transformer Block (x22 layers)

Each transformer block applies two sub-blocks with residual connections:

```
x = x + Attention(RMSNorm(x))
x = x + FFN(RMSNorm(x))
```

This is the "pre-norm" pattern: normalization is applied *before* each sub-block, and the sub-block output is added back to the residual stream.

#### RMSNorm

Root Mean Square Layer Normalization. Unlike standard LayerNorm, RMSNorm has no mean subtraction or bias — only a scale based on the root mean square, followed by element-wise multiplication with learned weights.

**Formula:**

```
rms = sqrt(mean(x[j]^2 for j in 0..dim-1) + eps)
output[j] = weight[j] * (x[j] / rms)
```

Equivalently:

```
ss = sum(x[j]^2 for j in 0..dim-1) / dim
ss = 1.0 / sqrt(ss + 1e-5)
output[j] = weight[j] * (ss * x[j])
```

- **eps** = 1e-5
- **weight** is a learned vector of shape `(dim,)` — one scale factor per dimension
- No bias term
- Two RMSNorm layers per transformer block: `input_layernorm` (before attention) and `post_attention_layernorm` (before FFN)

Weight names:
- `model.layers.{l}.input_layernorm.weight`
- `model.layers.{l}.post_attention_layernorm.weight`

#### Multi-Head Attention with GQA

Grouped Query Attention (GQA) uses fewer key/value heads than query heads to reduce KV-cache memory. TinyLlama uses 32 query heads and 4 KV heads (8:1 ratio).

**Step 1: Q/K/V Projections**

```
q = Wq @ xb     // (2048,) = (2048, 2048) @ (2048,)
k = Wk @ xb     // (256,)  = (256, 2048)  @ (2048,)
v = Wv @ xb     // (256,)  = (256, 2048)  @ (2048,)
```

No bias in any projection. K and V are written directly into the KV-cache at the current position.

Weight names:
- `model.layers.{l}.self_attn.q_proj.weight` — shape `(2048, 2048)`
- `model.layers.{l}.self_attn.k_proj.weight` — shape `(256, 2048)`
- `model.layers.{l}.self_attn.v_proj.weight` — shape `(256, 2048)`

**Step 2: Rotary Position Embeddings (RoPE)** — see dedicated section below.

**Step 3: Scaled Dot-Product Attention with GQA**

For each query head `h` (0 to 31):

```
// Query slice for head h
q_h = q[h * 64 : (h+1) * 64]             // (64,)

// Map query head to KV head: kv_head = h / 8 (integer division)
kv_head = h / kv_mul                       // e.g., heads 0-7 -> KV head 0

for t in 0..pos:                           // iterate over all cached positions
    k_t = key_cache[layer][t][kv_head * 64 : (kv_head+1) * 64]
    score[t] = dot(q_h, k_t) / sqrt(64)   // scaled dot-product

att[h] = softmax(score[0..pos])            // softmax over positions 0 to pos (causal)

// Weighted sum of values
out_h = sum(att[h][t] * value_cache[layer][t][kv_head * 64 : (kv_head+1) * 64] for t in 0..pos)
```

Causal masking is implicit: we only attend to positions 0 through `pos` (current token's position), so future tokens are never visible.

The outputs from all 32 heads are concatenated to form a vector of size `(2048,)`.

**Step 4: Output Projection + Residual**

```
attn_out = Wo @ concat(out_h for h in 0..31)   // (2048,) = (2048, 2048) @ (2048,)
x = x + attn_out                                // residual connection
```

Weight name: `model.layers.{l}.self_attn.o_proj.weight` — shape `(2048, 2048)`

#### Rotary Position Embeddings (RoPE)

RoPE encodes position information by rotating pairs of dimensions in the Q and K vectors. Each pair of consecutive dimensions `(x[i], x[i+1])` is treated as a 2D vector and rotated by an angle proportional to the token's position.

**Algorithm:**

```
for i in range(0, dim, 2):
    head_dim = i % head_size                          // position within head (0, 2, 4, ..., 62)
    freq = 1.0 / pow(10000.0, head_dim / head_size)  // frequency for this dimension pair
    angle = pos * freq                                 // rotation angle

    cos_val = cos(angle)
    sin_val = sin(angle)

    // Rotate query pair (always applied to full q vector)
    v0 = q[i]
    v1 = q[i+1]
    q[i]   = v0 * cos_val - v1 * sin_val
    q[i+1] = v0 * sin_val + v1 * cos_val

    // Rotate key pair (only for i < kv_dim = 256)
    if i < kv_dim:
        v0 = k[i]
        v1 = k[i+1]
        k[i]   = v0 * cos_val - v1 * sin_val
        k[i+1] = v0 * sin_val + v1 * cos_val
```

**Key properties:**
- Base theta: 10000.0
- Low dimension indices have high-frequency rotations (rapidly changing with position)
- High dimension indices have low-frequency rotations (slowly changing with position)
- The dot product `q . k` becomes position-dependent through the rotation, giving the model a sense of relative distance
- **Critical:** Save the original `v0` before computing the rotated pair — both outputs depend on the original values

#### KV-Cache

The KV-cache stores key and value vectors from all previous positions to avoid recomputation during autoregressive generation.

**Shape:**
- `key_cache`: `(n_layers, seq_len, kv_dim)` = `(22, 2048, 256)`
- `value_cache`: `(n_layers, seq_len, kv_dim)` = `(22, 2048, 256)`

**Mechanism:** At each forward pass for position `pos`, the newly computed K and V vectors are written into `cache[layer][pos]`. During attention, all positions `0..pos` are read from the cache.

**Memory per token per layer:** 256 floats (K) + 256 floats (V) = 512 floats = 2,048 bytes (fp32)

#### Feed-Forward Network (SwiGLU)

The FFN uses a SwiGLU (Swish-Gated Linear Unit) architecture with three linear projections and no bias terms:

```
gate = w1 @ x          // gate_proj: (5632,) = (5632, 2048) @ (2048,)
up   = w3 @ x          // up_proj:   (5632,) = (5632, 2048) @ (2048,)

// SwiGLU activation: elementwise silu(gate) * up
for i in 0..5632:
    gate[i] = silu(gate[i]) * up[i]

out = w2 @ gate         // down_proj: (2048,) = (2048, 5632) @ (5632,)
```

Where SiLU (Sigmoid Linear Unit, also called Swish):

```
silu(x) = x * sigmoid(x) = x / (1 + exp(-x))
```

**Full formula:**

```
FFN(x) = W_down @ (silu(W_gate @ x) * (W_up @ x))
```

Weight names:
- `model.layers.{l}.mlp.gate_proj.weight` (w1) — shape `(5632, 2048)`
- `model.layers.{l}.mlp.up_proj.weight` (w3) — shape `(5632, 2048)`
- `model.layers.{l}.mlp.down_proj.weight` (w2) — shape `(2048, 5632)`

### Output Head

After all 22 transformer layers:

**Final RMSNorm:**

```
x = rmsnorm(x, final_norm_weight)
```

Weight name: `model.norm.weight` — shape `(2048,)`

**LM Head (Linear Projection):**

```
logits = W_cls @ x      // (32000,) = (32000, 2048) @ (2048,)
```

Weight name: `lm_head.weight` — shape `(32000, 2048)`

In TinyLlama, `tie_word_embeddings = false`, so the LM head is a separate weight matrix from the embedding table.

The output `logits` is a vector of 32,000 raw (unnormalized) log-probabilities, one per vocabulary token.

## Inference Pipeline

A complete forward pass for a single token at position `pos`:

1. **Embedding lookup:** Copy row `token_id` from `model.embed_tokens.weight` into activation vector `x` of size `(2048,)`.

2. **For each layer `l` in 0..21:**

   a. **Pre-attention RMSNorm:** `xb = rmsnorm(x, input_layernorm[l])`

   b. **Q/K/V projections:** Compute `q = Wq[l] @ xb`, `k = Wk[l] @ xb`, `v = Wv[l] @ xb`. Write K and V into `key_cache[l][pos]` and `value_cache[l][pos]`.

   c. **RoPE:** Apply rotary embeddings to Q (all 2048 dims) and K (first 256 dims) using position `pos` and base theta 10000.0.

   d. **Multi-head attention with GQA:** For each of 32 query heads, compute scaled dot-product attention against cached keys at positions `0..pos`, using the corresponding KV head (8 query heads share 1 KV head). Apply softmax. Compute weighted sum of cached values. Concatenate all head outputs.

   e. **Output projection + residual:** `x = x + Wo[l] @ attention_output`

   f. **Pre-FFN RMSNorm:** `xb = rmsnorm(x, post_attention_layernorm[l])`

   g. **SwiGLU FFN:** `x = x + W_down[l] @ (silu(W_gate[l] @ xb) * (W_up[l] @ xb))`

3. **Final RMSNorm:** `x = rmsnorm(x, model.norm.weight)`

4. **LM head projection:** `logits = lm_head.weight @ x` producing `(32000,)` logits.

5. **Sampling:** Select next token from logits using greedy (argmax), temperature scaling, or top-p sampling.

### Softmax (Numerically Stable)

Used in both attention scores and sampling:

```
max_val = max(x[i] for all i)
x[i] = exp(x[i] - max_val)       // subtract max for numerical stability
sum_val = sum(x[i] for all i)
x[i] = x[i] / sum_val
```

### Sampling Strategies

**Greedy (temperature = 0):**
```
next_token = argmax(logits)
```

**Temperature sampling:**
```
logits[i] /= temperature
probs = softmax(logits)
next_token = sample_from_distribution(probs)
```

**Top-p (nucleus) sampling:**
```
1. Apply temperature, then softmax to get probs
2. Sort tokens by probability (descending)
3. Find smallest set where cumulative probability >= top_p
4. Re-normalize probabilities within this set
5. Sample from the truncated distribution
```

### Generation Loop

```
1. Tokenize input prompt -> token_ids[]
2. token = token_ids[0]
3. For pos = 0, 1, 2, ...:
   a. logits = forward(token, pos)
   b. If pos < len(token_ids) - 1:
        next = token_ids[pos + 1]          // prefill: force next prompt token
      Else:
        next = sample(logits)              // generation: sample new token
   c. If next == 2 (EOS): break
   d. Decode and output next token
   e. token = next
```

During **prefill**, the forward pass runs for each prompt token to populate the KV-cache, but the output logits are ignored (the next token is forced). During **generation**, tokens are sampled from the logits autoregressively.

## Weight File Format (Safetensors)

### Binary Layout

A `.safetensors` file has exactly three contiguous sections:

```
[8 bytes: header_size (u64 LE)][header_size bytes: JSON header][remaining bytes: tensor data]
```

| Section | Offset | Size | Content |
|---|---|---|---|
| Header size | 0 | 8 bytes | Little-endian unsigned 64-bit integer |
| JSON header | 8 | header_size bytes | UTF-8 JSON string with tensor metadata |
| Tensor data | 8 + header_size | file_size - 8 - header_size | Raw tensor bytes, contiguous |

### JSON Header

The JSON header maps tensor names to metadata:

```json
{
  "__metadata__": {"format": "pt"},
  "model.embed_tokens.weight": {
    "dtype": "F32",
    "shape": [32000, 2048],
    "data_offsets": [0, 262144000]
  }
}
```

Each tensor entry has:
- `dtype` — data type string (e.g., `"F32"`, `"F16"`, `"BF16"`)
- `shape` — array of dimension sizes
- `data_offsets` — `[start, end)` byte offsets relative to the **start of the data section** (not the file start)

The special key `"__metadata__"` contains arbitrary string key-value pairs and is not a tensor.

### Data Type Reference

| Dtype | Bits | Bytes | Description |
|---|---|---|---|
| `F32` | 32 | 4 | IEEE 754 single-precision float |
| `F16` | 16 | 2 | IEEE 754 half-precision float |
| `BF16` | 16 | 2 | Brain float (8-bit exponent, 7-bit mantissa) |
| `I32` | 32 | 4 | Signed 32-bit integer |
| `I64` | 64 | 8 | Signed 64-bit integer |

### Data Layout Rules

- **Byte order:** Little-endian for all numeric types
- **Memory order:** Row-major (C-order)
- **No alignment padding:** Tensors are packed contiguously
- **Validation:** `data_section_end + 8 + header_size == total_file_size`

### Parsing Pseudocode (C#)

```csharp
// 1. Read header size
byte[] sizeBytes = new byte[8];
stream.Read(sizeBytes, 0, 8);
ulong headerSize = BitConverter.ToUInt64(sizeBytes, 0);

// 2. Read and parse JSON header
byte[] headerBytes = new byte[headerSize];
stream.Read(headerBytes, 0, (int)headerSize);
string json = Encoding.UTF8.GetString(headerBytes);
var header = JsonSerializer.Deserialize<Dictionary<string, TensorInfo>>(json);

// 3. For each tensor (skip "__metadata__"):
long dataStart = 8 + (long)headerSize;
foreach (var (name, info) in header)
{
    if (name == "__metadata__") continue;
    long start = dataStart + info.DataOffsets[0];
    long end   = dataStart + info.DataOffsets[1];
    // Read bytes from start to end, interpret as info.Dtype in info.Shape
}
```

### Type Conversion

**F16 to F32:** Read 2 bytes as `ushort`, convert using `System.Half` (or `BitConverter.Int16BitsToHalf` in .NET 6+), then cast to `float`.

**BF16 to F32:** Read 2 bytes as `ushort`, shift left by 16 bits, reinterpret as `float`:
```csharp
ushort bf16 = BitConverter.ToUInt16(bytes, offset);
uint f32bits = ((uint)bf16) << 16;
float value = BitConverter.Int32BitsToSingle((int)f32bits);
```

### Weight Name Mapping

Safetensors tensor names map to model components:

| Tensor Name | Shape | Role |
|---|---|---|
| `model.embed_tokens.weight` | (32000, 2048) | Token embedding table |
| `model.layers.{l}.input_layernorm.weight` | (2048,) | Pre-attention RMSNorm |
| `model.layers.{l}.self_attn.q_proj.weight` | (2048, 2048) | Query projection |
| `model.layers.{l}.self_attn.k_proj.weight` | (256, 2048) | Key projection |
| `model.layers.{l}.self_attn.v_proj.weight` | (256, 2048) | Value projection |
| `model.layers.{l}.self_attn.o_proj.weight` | (2048, 2048) | Output projection |
| `model.layers.{l}.post_attention_layernorm.weight` | (2048,) | Pre-FFN RMSNorm |
| `model.layers.{l}.mlp.gate_proj.weight` | (5632, 2048) | FFN gate (w1) |
| `model.layers.{l}.mlp.up_proj.weight` | (5632, 2048) | FFN up (w3) |
| `model.layers.{l}.mlp.down_proj.weight` | (2048, 5632) | FFN down (w2) |
| `model.norm.weight` | (2048,) | Final RMSNorm |
| `lm_head.weight` | (32000, 2048) | Output classifier |

Where `{l}` ranges from 0 to 21 (22 layers).

### Sharded Models

Large models split across multiple `.safetensors` files use an index file `model.safetensors.index.json`:
```json
{
  "weight_map": {
    "model.embed_tokens.weight": "model-00001-of-00002.safetensors",
    "lm_head.weight": "model-00002-of-00002.safetensors"
  }
}
```
TinyLlama v1.1 fits in a single file.

## Tokenizer

### Overview

| Property | Value |
|---|---|
| Tokenizer class | LlamaTokenizer |
| Algorithm | BPE (Byte-Pair Encoding) with byte fallback |
| Vocab size | 32,000 tokens |
| Merge rules | 61,249 |
| Format files | `tokenizer.json` (HuggingFace), `tokenizer.model` (SentencePiece) |

### Special Tokens

| Token | String | ID | Auto-added |
|---|---|---|---|
| UNK | `<unk>` | 0 | N/A |
| BOS | `<s>` | 1 | Yes (prepended to every input) |
| EOS | `</s>` | 2 | No |
| PAD | (none) | N/A | Not defined |

### Vocabulary Structure

| ID Range | Content |
|---|---|
| 0 | `<unk>` (unknown token) |
| 1 | `<s>` (beginning of sequence) |
| 2 | `</s>` (end of sequence) |
| 3-258 | Byte tokens `<0x00>` through `<0xFF>` (256 byte fallback tokens) |
| 259-31999 | BPE merge tokens (subwords, words, word pieces) |

Tokens use the SentencePiece convention where `▁` (Unicode U+2581, LOWER ONE EIGHTH BLOCK) represents a word-initial space. For example, `▁the` encodes `" the"` (with leading space).

### Encoding Algorithm

**1. Normalization:**
- Prepend `▁` to the input string
- Replace all spaces with `▁`

**2. Pre-tokenization:** None — the entire normalized string is processed as one piece.

**3. BPE Merge Loop:**
- Start with individual characters (or byte fallback tokens for unknown characters)
- Iteratively merge the highest-priority adjacent pair according to the merge list
- `byte_fallback: true` — unknown characters are encoded as byte tokens `<0x00>`-`<0xFF>` using their UTF-8 byte values
- `fuse_unk: true` — consecutive unknown tokens are fused into one
- Merge priority is defined by index in the merge list (index 0 = highest priority)

**4. Post-processing:**
- Prepend BOS token (ID 1) to the token sequence
- Single sequence: `[<s>] [tokens]`
- Pair sequence: `[<s>] [A tokens] [<s>] [B tokens]`

### Decoding Algorithm

Four steps in order:

1. **Replace:** `▁` -> ` ` (restore spaces)
2. **ByteFallback:** Decode byte tokens like `<0x41>` back to their actual byte values
3. **Fuse:** Join all token strings into a single string
4. **Strip:** Remove 1 leading space (reverses the normalization prepend)

### Merge Format

Merges in `tokenizer.json` are stored as an array of strings, each containing two space-separated tokens:
```json
["▁ t", "e r", "i n", "▁ a", ...]
```
Array index defines priority (0 = highest).

### C# Implementation Notes

1. Parse `tokenizer.json` to extract `model.vocab` (token string -> ID mapping) and `model.merges` (ordered merge list)
2. For encoding: normalize input, split to characters, apply BPE merges in priority order
3. For byte fallback: encode any character not in vocab as its UTF-8 bytes, map each to `<0xNN>` tokens (IDs 3-258)
4. Prepend BOS token ID 1
5. For decoding: map IDs to strings, apply the 4-step decoder pipeline

## Memory Requirements

### Weight Memory

| Precision | Bytes per Param | Total Weight Memory |
|---|---|---|
| FP32 | 4 | ~4.10 GB |
| FP16 / BF16 | 2 | ~2.05 GB |

### KV-Cache Memory

Per token per layer: `2 * kv_dim * sizeof(float)` = `2 * 256 * 4` = 2,048 bytes

| Context Length | KV-Cache (fp32) | KV-Cache (fp16) |
|---|---|---|
| 128 tokens | 5.5 MB | 2.75 MB |
| 512 tokens | 22 MB | 11 MB |
| 2048 tokens (max) | 88 MB | 44 MB |

Formula: `context_length * n_layers * 2 * kv_dim * bytes_per_float`
= `2048 * 22 * 2 * 256 * 4` = 92,274,688 bytes = ~88 MB (fp32)

### Runtime Buffers

| Buffer | Shape | Size (fp32) |
|---|---|---|
| `x` (activation) | (2048,) | 8 KB |
| `xb`, `xb2` (scratch) | (2048,) each | 16 KB |
| `hb`, `hb2` (FFN scratch) | (5632,) each | 44 KB |
| `q` (query) | (2048,) | 8 KB |
| `att` (attention scores) | (32, 2048) | 256 KB |
| `logits` | (32000,) | 125 KB |
| **Total runtime buffers** | | **~457 KB** |

### Total Memory (FP32, 2048 context)

| Component | Size |
|---|---|
| Weights | ~4.10 GB |
| KV-cache | ~88 MB |
| Runtime buffers | ~0.5 MB |
| **Total** | **~4.19 GB** |

## Implementation Notes for C#

### No External Dependencies

The entire inference pipeline can be implemented with basic array operations:
- Matrix-vector multiplication (the critical hot path)
- Element-wise operations (add, multiply, SiLU)
- RMSNorm (reduction + scale)
- Softmax (reduction + exp + normalize)
- RoPE (sin/cos on pairs)

No BLAS, no LAPACK, no ML framework required.

### BFloat16 Handling

C# (.NET 6+) does not natively support BF16. Convert on load:

```csharp
static float BF16ToFloat(ushort bf16)
{
    uint f32bits = ((uint)bf16) << 16;
    return BitConverter.Int32BitsToSingle((int)f32bits);
}
```

For F16, .NET 6+ provides `System.Half`:
```csharp
Half h = BitConverter.ToHalf(bytes, offset);
float f = (float)h;
```

### Memory Layout

All weight matrices are row-major. For matrix-vector multiply `W @ x` where W is `(rows, cols)`:

```csharp
for (int i = 0; i < rows; i++)
{
    float sum = 0;
    int offset = i * cols;
    for (int j = 0; j < cols; j++)
        sum += W[offset + j] * x[j];
    output[i] = sum;
}
```

This is the hottest loop in the entire model — it accounts for the vast majority of compute time. Optimization opportunities:
- SIMD intrinsics (`System.Runtime.Intrinsics`) for vectorized dot products
- `Span<float>` and `Memory<float>` to avoid array bounds checks
- `Parallel.For` across output rows for multi-threaded matmul
- Memory-mapped files (`MemoryMappedFile`) to avoid loading all weights into managed memory

### KV-Cache Pre-allocation

Allocate the full KV-cache upfront as contiguous arrays:

```csharp
float[] keyCache   = new float[n_layers * seq_len * kv_dim];
float[] valueCache = new float[n_layers * seq_len * kv_dim];
```

Index calculation: `cache[layer * seq_len * kv_dim + pos * kv_dim + d]`

### Key Design Constraints

1. **No bias terms anywhere.** LLaMA has no bias in linear layers or norms — only weight matrices.
2. **Pre-norm architecture.** Normalize *before* each sub-block, not after.
3. **Untied embeddings.** TinyLlama uses separate matrices for the embedding table and LM head.
4. **Causal attention is implicit.** Only iterate over positions `0..pos` — no attention mask matrix needed.
5. **GQA head mapping.** Integer division `query_head / kv_mul` maps each query head to its shared KV head.
6. **RoPE on Q and K only.** Values are not rotated. Q is rotated over all dims; K only over `kv_dim` dims.
7. **SwiGLU needs three matrices.** The FFN has gate_proj, up_proj, and down_proj — not the usual two.

### Performance Tips

- **Matmul dominates:** ~99% of compute is matrix-vector multiplication. Optimize this first.
- **Precompute RoPE tables:** `sin(pos * freq)` and `cos(pos * freq)` can be precomputed for all positions and frequencies.
- **Quantization:** Storing weights in 8-bit or 4-bit with dequantization during matmul reduces memory bandwidth (the actual bottleneck on CPU).
- **Memory mapping:** Use `MemoryMappedFile` to map the safetensors file directly, avoiding a full copy into managed memory.
- **Streaming output:** Decode and print tokens as they are generated, not after the full sequence is complete.
