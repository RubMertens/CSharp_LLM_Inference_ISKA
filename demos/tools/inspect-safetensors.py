#!/usr/bin/env python3
"""Inspect the demo model's safetensors file without loading it into memory.

Safetensors layout:

    [8-byte little-endian uint64: header length N][N bytes of JSON header][raw tensor bytes]

The JSON header names every tensor and gives its dtype, shape, and byte range
relative to the start of the raw region. So the whole file is navigable by
reading its first few kilobytes -- no need to touch the multi-gigabyte tail.

Usage:
    inspect-safetensors.py                      # list every tensor with dtype, shape, size
    inspect-safetensors.py --list self_attn     # list only tensors matching a substring
    inspect-safetensors.py --header             # dump the raw JSON header
    inspect-safetensors.py --bytes              # annotated hexdump of the format boundary
    inspect-safetensors.py TENSOR [COUNT]       # decode the first COUNT values of one tensor
    inspect-safetensors.py --file OTHER.safetensors ...

Examples:
    inspect-safetensors.py model.norm.weight
    inspect-safetensors.py model.layers.0.self_attn.q_proj.weight 16

Stdlib only. No dependencies, no dotnet build.
"""

import argparse
import json
import struct
import sys
from pathlib import Path

# demos/tools/inspect-safetensors.py -> demos/model/model.safetensors
DEFAULT_MODEL = Path(__file__).resolve().parent.parent / "model" / "model.safetensors"

# Bytes per element for the float dtypes this script can decode.
DTYPES = {
    "BF16": 2,
    "F16": 2,
    "F32": 4,
    "F64": 8,
}


def read_header(path):
    """Return (tensors, metadata, header length, offset where tensor data starts)."""
    with open(path, "rb") as f:
        raw_length = f.read(8)
        if len(raw_length) < 8:
            sys.exit(f"{path}: too short to be a safetensors file.")
        header_length = struct.unpack("<Q", raw_length)[0]

        file_size = path.stat().st_size
        if header_length <= 0 or 8 + header_length > file_size:
            sys.exit(f"{path}: invalid header length {header_length}.")

        header = json.loads(f.read(header_length))

    metadata = header.pop("__metadata__", None)
    return header, metadata, header_length, 8 + header_length


def decode(raw, dtype):
    """Decode raw little-endian bytes of `dtype` into a list of floats."""
    if dtype == "BF16":
        # bfloat16 is the top 16 bits of a float32: pad the low bits back on.
        return [
            struct.unpack("<f", b"\x00\x00" + raw[i:i + 2])[0]
            for i in range(0, len(raw) - 1, 2)
        ]
    code = {"F16": "e", "F32": "f", "F64": "d"}[dtype]
    count = len(raw) // DTYPES[dtype]
    return list(struct.unpack(f"<{count}{code}", raw[:count * DTYPES[dtype]]))


def elements(shape):
    total = 1
    for dim in shape:
        total *= dim
    return total


def human(byte_count):
    """Size in the unit that keeps it readable -- layernorm vectors are KB, not 0.00 MB."""
    if byte_count >= 1e9:
        return f"{byte_count / 1e9:.2f} GB"
    if byte_count >= 1e6:
        return f"{byte_count / 1e6:.2f} MB"
    return f"{byte_count / 1e3:.2f} KB"


def cmd_list(header, metadata, header_length, pattern):
    names = [n for n in header if pattern is None or pattern in n]
    if not names:
        sys.exit(f"No tensor name contains {pattern!r}. Run without --list to see all.")

    width = max(len(n) for n in names)
    shown_bytes = 0
    shown_params = 0
    for name in names:
        entry = header[name]
        begin, end = entry["data_offsets"]
        shown_bytes += end - begin
        shown_params += elements(entry["shape"])
        print(f"{name:<{width}}  {entry['dtype']:<5}  "
              f"{str(entry['shape']):<16}  {human(end - begin):>9}")

    total_bytes = sum(e["data_offsets"][1] - e["data_offsets"][0] for e in header.values())
    print()
    print(f"{len(names)} of {len(header)} tensors, "
          f"{shown_params / 1e6:.1f}M params, {shown_bytes / 1e9:.2f} GB shown")
    if pattern is not None:
        print(f"file total: {total_bytes / 1e9:.2f} GB of tensor data")
    print(f"header: {header_length} bytes of JSON, metadata {metadata}")


def cmd_bytes(path, header_length, data_start):
    """Show the format boundary: length prefix, start of JSON, where data begins."""
    with open(path, "rb") as f:
        prefix = f.read(8)
        json_head = f.read(72)

    print(f"file: {path}")
    print(f"file size: {path.stat().st_size:,} bytes\n")
    print(f"[0:8]   header length  {prefix.hex(' ', 8)}  ->  {header_length:,} "
          f"(little-endian uint64)")
    print(f"[8:80]  JSON header    {json_head[:32].hex(' ', 2)}")
    print(f"                       {json_head.decode('utf-8', 'replace')!r}")
    print(f"\ntensor data starts at byte {data_start:,} (8 + {header_length:,})")


def cmd_tensor(path, header, data_start, name, count):
    if name not in header:
        near = [n for n in header if name in n][:5]
        hint = "\nDid you mean:\n  " + "\n  ".join(near) if near else ""
        sys.exit(f"Tensor {name!r} not in file. Run without arguments to list all.{hint}")

    entry = header[name]
    dtype = entry["dtype"]
    if dtype not in DTYPES:
        sys.exit(f"{name}: dtype {dtype} not supported by this script "
                 f"(handles {', '.join(DTYPES)}).")

    begin, end = entry["data_offsets"]
    size = DTYPES[dtype]
    available = (end - begin) // size
    count = max(1, min(count, available))

    with open(path, "rb") as f:
        f.seek(data_start + begin)
        raw = f.read(count * size)

    print(f"{name}")
    print(f"  dtype       {dtype}")
    print(f"  shape       {entry['shape']}  ({elements(entry['shape']):,} values)")
    print(f"  bytes       {end - begin:,}  (offsets {begin:,}..{end:,} in data region)")
    print(f"  file offset {data_start + begin:,}")
    print(f"\nfirst {count} values")
    print(f"  hex    {raw.hex(' ', size)}")
    print(f"  float  {[round(v, 6) for v in decode(raw, dtype)]}")


def main():
    parser = argparse.ArgumentParser(
        description="Inspect a safetensors model file.",
        epilog="With no arguments, lists every tensor in demos/model/model.safetensors.",
    )
    parser.add_argument("tensor", nargs="?", help="tensor name to decode")
    parser.add_argument("count", nargs="?", type=int, default=8,
                        help="how many values to decode (default 8)")
    parser.add_argument("--file", type=Path, default=DEFAULT_MODEL,
                        help="safetensors file (default: demos/model/model.safetensors)")
    parser.add_argument("--list", metavar="PATTERN",
                        help="list only tensors whose name contains PATTERN")
    parser.add_argument("--header", action="store_true",
                        help="dump the raw JSON header")
    parser.add_argument("--bytes", action="store_true",
                        help="annotated hexdump of the format boundary")
    args = parser.parse_args()

    path = args.file
    if not path.exists():
        sys.exit(
            f"{path} not found.\n"
            "Model weights are gitignored. Download 'model.safetensors' for "
            "TinyLlama-1.1B-Chat-v1.0 from HuggingFace into demos/model/, or pass "
            "--file with another safetensors path."
        )

    header, metadata, header_length, data_start = read_header(path)

    if args.bytes:
        cmd_bytes(path, header_length, data_start)
    elif args.header:
        json.dump(header, sys.stdout, indent=2)
        print()
    elif args.tensor:
        cmd_tensor(path, header, data_start, args.tensor, args.count)
    else:
        cmd_list(header, metadata, header_length, args.list)


if __name__ == "__main__":
    main()
