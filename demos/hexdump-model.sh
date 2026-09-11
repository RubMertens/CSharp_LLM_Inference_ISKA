#!/usr/bin/env bash
# Walk through a .safetensors file byte by byte, for demo purposes.
# Usage: ./hexdump-model.sh [path-to-model-dir]
set -euo pipefail

MODEL_DIR="${1:-$(dirname "$0")/model}"
FILE="$MODEL_DIR/model.safetensors"

[ -f "$FILE" ] || { echo "No model at $FILE"; exit 1; }

if command -v hexyl >/dev/null; then
  dump() { hexyl --skip "$1" --length "$2" "$FILE"; }
else
  dump() { xxd -s "$1" -l "$2" "$FILE"; }
  echo "(tip: brew install hexyl for colored output)" >&2
fi

# Header length: first 8 bytes, little-endian u64.
HLEN=$(python3 -c "import struct;print(struct.unpack('<Q',open('$FILE','rb').read(8))[0])")

pause() { read -rsn1 -p $'\n  [enter] ' _ </dev/tty; echo; }

echo "### 1. The whole model is one $(du -h "$FILE" | cut -f1) file."
pause

echo "### 2. First 8 bytes: how long the header is. -> $HLEN bytes"
dump 0 8
pause

echo "### 3. The header is JSON. Plain, readable English."
dump 8 384
pause

echo "### 4. It names every tensor in the network:"
python3 - "$FILE" <<'PY'
import json, struct, sys
with open(sys.argv[1], 'rb') as f:
    h = json.loads(f.read(struct.unpack('<Q', f.read(8))[0]))
t = {k: v for k, v in h.items() if k != '__metadata__'}
print(f"    {len(t)} tensors")
for k in list(t)[:8]:
    print(f"    {k:<45} {t[k]['dtype']:>5} {t[k]['shape']}")
print("    ...")
PY
pause

echo "### 5. Here the header ends and the weights begin. Watch the middle line."
dump $((HLEN - 68)) 160
pause

echo "### 6. And then it's this. For two gigabytes."
dump $((HLEN + 131072000)) 256
echo
echo "### That's it. That's the model."
