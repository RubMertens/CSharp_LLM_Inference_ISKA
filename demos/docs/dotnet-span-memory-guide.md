# Span\<T> and Memory\<T> in .NET Core

A comprehensive guide to high-performance, zero-allocation memory access in .NET.

## Table of Contents

1. [Span\<T> Fundamentals](#spant-fundamentals)
2. [ReadOnlySpan\<T>](#readonlyspant)
3. [Creating Spans](#creating-spans)
4. [Slicing](#slicing)
5. [API Surface](#api-surface)
6. [Iteration Patterns](#iteration-patterns)
7. [Span\<T> Limitations](#spant-limitations)
8. [Memory\<T> Fundamentals](#memoryt-fundamentals)
9. [ReadOnlyMemory\<T>](#readonlymemoryt)
10. [Memory\<T> and Async Patterns](#memoryt-and-async-patterns)
11. [IMemoryOwner\<T> and MemoryPool\<T>](#imemoryownert-and-memorypoolt)
12. [MemoryMarshal](#memorymarshal)
13. [Real-World Scenarios](#real-world-scenarios)
14. [Performance Benchmarks](#performance-benchmarks)
15. [Best Practices](#best-practices)
16. [Common Pitfalls](#common-pitfalls)
17. [Decision Flowchart](#decision-flowchart)

---

## Span\<T> Fundamentals

`Span<T>` is a `ref struct` that provides a type-safe, memory-safe view over a contiguous region of arbitrary memory. It lives in the `System` namespace.

```csharp
public readonly ref struct Span<T>
{
    internal readonly ref T _reference;
    private readonly int _length;
}
```

Being a `ref struct`, it is allocated on the **stack** rather than the managed heap. Internally it stores a ref field (`ref T _reference`) and an `int _length`. The ref field allows Span to point into existing memory without copying — this is why it avoids allocations.

A `Span<T>` can point to three kinds of memory:

- **Managed memory** — arrays, strings on the GC heap
- **Native memory** — unmanaged allocations via `Marshal.AllocHGlobal`, etc.
- **Stack memory** — via `stackalloc`

Methods accepting `Span<T>` work identically regardless of the memory source.

---

## ReadOnlySpan\<T>

`ReadOnlySpan<T>` is the read-only counterpart. Also a `ref struct` with the same stack-only constraints.

```csharp
public readonly ref struct ReadOnlySpan<T>
```

Key differences from `Span<T>`:

- The indexer returns values by **readonly reference** — you cannot write through it
- No `Fill()` or `Clear()` methods
- `string` implicitly converts to `ReadOnlySpan<char>` (not `Span<char>`)

There is an **implicit conversion** from `Span<T>` to `ReadOnlySpan<T>`:

```csharp
Span<int> mutable = new int[] { 1, 2, 3 };
ReadOnlySpan<int> readOnly = mutable; // implicit conversion
```

---

## Creating Spans

**From an array:**

```csharp
byte[] array = new byte[100];
Span<byte> span = new Span<byte>(array);
Span<byte> span2 = array;  // implicit conversion
```

**From an array slice:**

```csharp
var array = new int[] { 2, 4, 6, 8, 10, 12, 14, 16, 18, 20 };
var slice = new Span<int>(array, 2, 5); // start=2, length=5
```

**From a string (ReadOnlySpan\<char> only):**

```csharp
string text = "Hello, World!";
ReadOnlySpan<char> span = text.AsSpan();
ReadOnlySpan<char> span2 = text; // implicit conversion
```

**From stackalloc:**

```csharp
Span<byte> stackSpan = stackalloc byte[100];
for (int i = 0; i < stackSpan.Length; i++)
    stackSpan[i] = (byte)i;
```

**From native/unmanaged memory (requires unsafe):**

```csharp
nint native = Marshal.AllocHGlobal(100);
Span<byte> nativeSpan;
unsafe
{
    nativeSpan = new Span<byte>(native.ToPointer(), 100);
}
// ... use nativeSpan ...
Marshal.FreeHGlobal(native);
```

**From ArraySegment\<T> (implicit conversion):**

```csharp
ArraySegment<int> segment = new ArraySegment<int>(new int[10], 2, 5);
Span<int> span = segment;
```

**From a single ref (length-1 span):**

```csharp
int value = 42;
Span<int> single = new Span<int>(ref value);
```

### Implicit Conversions Summary

```
T[]               →  Span<T>              (implicit)
T[]               →  ReadOnlySpan<T>      (implicit)
ArraySegment<T>   →  Span<T>              (implicit)
ArraySegment<T>   →  ReadOnlySpan<T>      (implicit)
Span<T>           →  ReadOnlySpan<T>      (implicit)
string            →  ReadOnlySpan<char>   (implicit, via compiler)
```

No implicit conversion from `ReadOnlySpan<T>` back to `Span<T>` (violates read-only safety). No implicit conversion from `Span<T>` to `T[]` (requires `.ToArray()` copy).

---

## Slicing

Slicing creates a new `Span<T>` that is a **window** into the same underlying memory — zero allocation, zero copy.

**Using .Slice():**

```csharp
Span<int> span = new int[] { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 };
Span<int> fromIndex3 = span.Slice(3);       // { 3, 4, 5, 6, 7, 8, 9 }
Span<int> middle = span.Slice(3, 4);        // { 3, 4, 5, 6 }
```

**Using C# range indexer syntax (C# 8+):**

```csharp
Span<int> span = new int[] { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 };
Span<int> slice1 = span[3..7];    // { 3, 4, 5, 6 }
Span<int> slice2 = span[..5];     // { 0, 1, 2, 3, 4 }
Span<int> slice3 = span[5..];     // { 5, 6, 7, 8, 9 }
Span<int> slice4 = span[^3..];    // { 7, 8, 9 }
```

**Mutations through a slice affect the original memory:**

```csharp
var array = new int[] { 2, 4, 6, 8, 10, 12, 14, 16, 18, 20 };
var slice = new Span<int>(array, 2, 5);
for (int ctr = 0; ctr < slice.Length; ctr++)
    slice[ctr] *= 2;
// array is now: { 2, 4, 12, 16, 20, 24, 28, 16, 18, 20 }
```

---

## API Surface

### Properties

| Property | Description |
|----------|-------------|
| `Length` | Number of elements in the span |
| `IsEmpty` | `true` if `Length == 0` |
| `Empty` | (static) Returns an empty `Span<T>` |
| `this[int]` | Gets/sets element at index (by ref) |

### Core Methods

| Method | Description |
|--------|-------------|
| `Slice(int start)` | Creates sub-span from `start` to end |
| `Slice(int start, int length)` | Creates sub-span of `length` from `start` |
| `CopyTo(Span<T> dest)` | Copies contents to destination; throws if dest too small |
| `TryCopyTo(Span<T> dest)` | Copies contents; returns `false` if dest too small |
| `ToArray()` | Copies contents into a new `T[]` |
| `Fill(T value)` | Sets all elements to `value` |
| `Clear()` | Zeros/defaults all elements |
| `GetEnumerator()` | Enables `foreach` iteration |

### Key MemoryExtensions (extension methods on Span/ReadOnlySpan)

**Searching:**

- `Contains<T>(value)`, `IndexOf<T>(value)`, `LastIndexOf<T>(value)`
- `IndexOfAny<T>(v0, v1)`, `IndexOfAnyExcept<T>(value)`
- `BinarySearch<T>(value)` — binary search on sorted span

**Comparison:**

- `SequenceEqual<T>(other)` — element-wise equality
- `SequenceCompareTo<T>(other)` — lexicographic comparison
- `CommonPrefixLength<T>(other)`

**String-like operations (for `ReadOnlySpan<char>`):**

- `Trim()` / `TrimStart()` / `TrimEnd()`
- `StartsWith(sequence)` / `EndsWith(sequence)`
- `Split(separator)` / `SplitAny(separators)` — zero-alloc split enumeration

**Mutation (Span only):**

- `Sort<T>()`, `Reverse<T>()`, `Replace<T>(old, new)`
- `Fill(value)`, `Clear()`, `Count<T>(value)`

---

## Iteration Patterns

**foreach loop:**

```csharp
Span<int> span = new int[] { 1, 2, 3, 4, 5 };
foreach (int value in span)
    Console.Write($"{value} ");
```

**for loop with indexer:**

```csharp
for (int i = 0; i < span.Length; i++)
    span[i] *= 2;
```

**ref iteration (modify in-place without copying):**

```csharp
foreach (ref int value in span)
    value *= 2;
```

**ref readonly iteration (read by reference, no copies of large structs):**

```csharp
ReadOnlySpan<LargeStruct> span = GetData();
foreach (ref readonly LargeStruct item in span)
    Process(in item);
```

---

## Span\<T> Limitations

Because `Span<T>` is a `ref struct`, it has these restrictions:

| Restriction | Example |
|-------------|---------|
| Cannot be a field in a class or non-ref struct | `class Foo { Span<int> _span; }` — compile error |
| Cannot cross `await` boundaries (before C# 13) | `Span<int> s = ...; await Task.Delay(1);` — error |
| Cannot be captured in lambdas/closures | `Action a = () => span.Length;` — error |
| Cannot be boxed | `object o = span;` — error |
| Cannot be used as a generic type argument (before C# 13) | `List<Span<int>>` — error |
| Cannot be an array element type | `Span<int>[]` — error |
| `Equals(object)` and `GetHashCode()` throw `NotSupportedException` | Prevents accidental boxing |

**C# 13 relaxations:** You can declare `Span<T>` in async methods as long as it doesn't live across an `await`. Ref structs can implement interfaces (but not box to them). Generic `allows ref struct` constraint enables limited generic usage.

**For heap storage or async, use `Memory<T>` instead.**

---

## Memory\<T> Fundamentals

`Memory<T>` is a `readonly struct` (not a ref struct) that represents a contiguous region of memory. Introduced in .NET Core 2.1.

```csharp
public readonly struct Memory<T> : IEquatable<Memory<T>>
```

Unlike `Span<T>`, `Memory<T>`:

- **Can** be stored on the managed heap
- **Can** be a field in a class
- **Can** cross `await` and `yield` boundaries
- **Can** be captured in closures

### Properties and Methods

| Member | Description |
|--------|-------------|
| `Span` | Returns a `Span<T>` from the current instance |
| `Length` | Number of items |
| `IsEmpty` | Whether the instance is empty |
| `Slice(int)` / `Slice(int, int)` | Forms a slice |
| `CopyTo(Memory<T>)` | Copies contents to destination |
| `TryCopyTo(Memory<T>)` | Tries to copy, returns bool |
| `Pin()` | Creates a `MemoryHandle` for pinning (P/Invoke) |
| `ToArray()` | Copies to a new array |

### Creation Patterns

```csharp
// From arrays
byte[] array = new byte[1024];
Memory<byte> mem1 = new Memory<byte>(array);
Memory<byte> mem2 = array.AsMemory();
Memory<byte> mem3 = array.AsMemory(10, 100);   // offset + length
Memory<byte> mem4 = array.AsMemory(10..110);    // Range syntax
Memory<byte> mem5 = array;                      // implicit conversion

// From strings (ReadOnlyMemory<char>)
string text = "Hello, World!";
ReadOnlyMemory<char> rom = text.AsMemory();
ReadOnlyMemory<char> sub = text.AsMemory(7, 5); // "World"

// From ArraySegment
var segment = new ArraySegment<byte>(array, 0, 50);
Memory<byte> mem6 = segment;  // implicit conversion

// Slicing
Memory<byte> sliced = mem1.Slice(100, 200);
```

### Span\<T> vs Memory\<T>

| Feature | Span\<T> | Memory\<T> |
|---------|----------|------------|
| Type | `ref struct` | `readonly struct` |
| Stack only? | Yes | No |
| Can be a class field? | No | Yes |
| Can cross await/yield? | No | Yes |
| Can be in closures? | No | Yes |
| Performance | Slightly faster | Slight indirection overhead |
| Memory sources | Array, stackalloc, native | Array-backed, string-backed |
| Conversion | Cannot convert to Memory | `.Span` gives you Span |

---

## ReadOnlyMemory\<T>

`ReadOnlyMemory<T>` is the immutable counterpart to `Memory<T>`.

```csharp
public readonly struct ReadOnlyMemory<T> : IEquatable<ReadOnlyMemory<T>>
```

- Can live on the heap, stored in fields, cross async boundaries
- `.Span` property returns `ReadOnlySpan<T>`
- Same API surface as `Memory<T>` but read-only
- `string.AsMemory()` returns `ReadOnlyMemory<char>`

```csharp
string text = "Hello, World!";
ReadOnlyMemory<char> memory = text.AsMemory();
ReadOnlyMemory<char> slice = text.AsMemory(7);     // "World!"
ReadOnlyMemory<char> sub = text.AsMemory(0..5);    // "Hello"
```

---

## Memory\<T> and Async Patterns

`Span<T>` cannot be used in async methods because when an async method hits an `await`, the stack frame is suspended and the continuation may resume on a different thread. `Memory<T>` solves this.

### Stream.ReadAsync with Memory\<byte>

```csharp
// Old pattern (allocates array):
byte[] buffer = new byte[4096];
int bytesRead = await stream.ReadAsync(buffer, 0, buffer.Length);

// New pattern with Memory<T> (can use pooled memory):
using IMemoryOwner<byte> owner = MemoryPool<byte>.Shared.Rent(4096);
int bytesRead = await stream.ReadAsync(owner.Memory);
ProcessData(owner.Memory.Slice(0, bytesRead).Span);
```

### System.IO.Pipelines

**PipeWriter uses Memory\<byte>:**

```csharp
async Task FillPipeAsync(Socket socket, PipeWriter writer)
{
    const int minimumBufferSize = 512;
    while (true)
    {
        Memory<byte> memory = writer.GetMemory(minimumBufferSize);
        int bytesRead = await socket.ReceiveAsync(memory, SocketFlags.None);
        if (bytesRead == 0) break;

        writer.Advance(bytesRead);
        FlushResult result = await writer.FlushAsync();
        if (result.IsCompleted) break;
    }
    await writer.CompleteAsync();
}
```

**PipeReader returns ReadOnlySequence\<byte> (composed of ReadOnlyMemory\<byte> segments):**

```csharp
async Task ReadPipeAsync(PipeReader reader)
{
    while (true)
    {
        ReadResult result = await reader.ReadAsync();
        ReadOnlySequence<byte> buffer = result.Buffer;

        while (TryReadLine(ref buffer, out ReadOnlySequence<byte> line))
            ProcessLine(line);

        reader.AdvanceTo(buffer.Start, buffer.End);
        if (result.IsCompleted) break;
    }
    await reader.CompleteAsync();
}
```

### Memory\<T>.Pin() for Async P/Invoke

Use `Pin()` instead of the `fixed` keyword for async native interop:

```csharp
public unsafe Task<int> ManagedWrapperAsync(Memory<byte> data)
{
    var tcs = new TaskCompletionSource<int>();
    var memoryHandle = data.Pin();
    try
    {
        ExportedAsyncMethod((byte*)memoryHandle.Pointer, data.Length);
    }
    catch
    {
        memoryHandle.Dispose();
        throw;
    }
    return tcs.Task;
}
```

### Complete Async I/O Example

```csharp
async Task ProcessStreamAsync(Stream inputStream, Stream outputStream)
{
    using IMemoryOwner<byte> owner = MemoryPool<byte>.Shared.Rent(4096);
    Memory<byte> buffer = owner.Memory;

    int bytesRead;
    while ((bytesRead = await inputStream.ReadAsync(buffer)) > 0)
    {
        await outputStream.WriteAsync(buffer.Slice(0, bytesRead));
    }
}
```

---

## IMemoryOwner\<T> and MemoryPool\<T>

### IMemoryOwner\<T>

Interface for explicit ownership and lifetime management of `Memory<T>` buffers.

```csharp
public interface IMemoryOwner<T> : IDisposable
{
    Memory<T> Memory { get; }
}
```

- Identifies the **owner** responsible for disposing the underlying memory
- Extends `IDisposable` — must call `Dispose()` when done or transfer ownership
- A buffer can have multiple **consumers** but only one **owner** at a time

### MemoryPool\<T>

Provides pooled memory allocation to reduce GC pressure.

```csharp
public abstract class MemoryPool<T> : IDisposable
{
    public static MemoryPool<T> Shared { get; }
    public abstract int MaxBufferSize { get; }
    public abstract IMemoryOwner<T> Rent(int minBufferSize = -1);
}
```

`MemoryPool<T>.Shared` is a singleton backed by `ArrayPool<T>.Shared` internally. Thread-safe. Returned buffers may be **larger** than requested.

### Usage Pattern

```csharp
using IMemoryOwner<char> owner = MemoryPool<char>.Shared.Rent(256);
Memory<char> memory = owner.Memory;

// Actual size may be larger than 256
Console.WriteLine($"Actual size: {memory.Length}");

"Hello".AsSpan().CopyTo(memory.Span);
ProcessData(memory.Slice(0, 5));
// owner.Dispose() called automatically by `using`
```

### Ownership Transfer

```csharp
void ProcessBuffer(IMemoryOwner<byte> owner)
{
    try
    {
        var span = owner.Memory.Span;
        // process...
    }
    finally
    {
        owner.Dispose();  // This method now owns disposal
    }
}
```

---

## MemoryMarshal

`System.Runtime.InteropServices.MemoryMarshal` provides advanced, low-level utilities.

### Key Methods

**GetReference** — direct reference to first element:

```csharp
ref T MemoryMarshal.GetReference<T>(Span<T> span);
ref readonly T MemoryMarshal.GetReference<T>(ReadOnlySpan<T> span);
```

**TryGetArray** — extract underlying array from ReadOnlyMemory:

```csharp
if (MemoryMarshal.TryGetArray(rom, out ArraySegment<byte> segment))
{
    byte[] array = segment.Array;
    int offset = segment.Offset;
    int count = segment.Count;
}
```

**Cast** — reinterpret a span of one type as another:

```csharp
Span<byte> bytes = stackalloc byte[16];
Span<int> ints = MemoryMarshal.Cast<byte, int>(bytes);  // 4 ints
```

**AsBytes** — cast primitives to bytes:

```csharp
Span<int> ints = stackalloc int[] { 1, 2, 3, 4 };
Span<byte> bytes = MemoryMarshal.AsBytes(ints);  // 16 bytes
```

**Read/Write** — read/write structs from byte spans:

```csharp
MyHeader header = MemoryMarshal.Read<MyHeader>(byteSpan);
MemoryMarshal.Write(byteSpan, ref myStruct);

if (MemoryMarshal.TryRead<MyHeader>(byteSpan, out var h)) { ... }
```

---

## Real-World Scenarios

### 1. String Parsing Without Allocation

```csharp
// OLD: allocates 2 strings
string header = "Content-Length: 132";
string value = header.Substring(16);
int length = int.Parse(value);

// NEW: zero allocations
ReadOnlySpan<char> headerSpan = header;
ReadOnlySpan<char> valueSpan = headerSpan.Slice(16);
int length2 = int.Parse(valueSpan);
```

**CSV parsing (zero allocation):**

```csharp
public static void ParseCsvLine(ReadOnlySpan<char> line)
{
    while (!line.IsEmpty)
    {
        int comma = line.IndexOf(',');
        ReadOnlySpan<char> field = comma == -1 ? line : line.Slice(0, comma);
        field = field.Trim();

        ProcessField(field);

        line = comma == -1 ? ReadOnlySpan<char>.Empty : line.Slice(comma + 1);
    }
}
```

### 2. Binary Protocol Parsing

```csharp
public readonly struct PacketHeader
{
    public readonly int MessageType;
    public readonly int PayloadLength;
    public readonly long Timestamp;

    public static PacketHeader Parse(ReadOnlySpan<byte> buffer)
    {
        return new PacketHeader(
            messageType: BinaryPrimitives.ReadInt32BigEndian(buffer),
            payloadLength: BinaryPrimitives.ReadInt32BigEndian(buffer.Slice(4)),
            timestamp: BinaryPrimitives.ReadInt64BigEndian(buffer.Slice(8))
        );
    }

    public void WriteTo(Span<byte> buffer)
    {
        BinaryPrimitives.WriteInt32BigEndian(buffer, MessageType);
        BinaryPrimitives.WriteInt32BigEndian(buffer.Slice(4), PayloadLength);
        BinaryPrimitives.WriteInt64BigEndian(buffer.Slice(8), Timestamp);
    }
}
```

### 3. Stack-Allocated Temp Buffers

```csharp
public string FormatTemperature(double celsius)
{
    Span<char> buffer = stackalloc char[64];
    celsius.TryFormat(buffer, out int written, "F2");
    buffer[written++] = '\u00B0';
    buffer[written++] = 'C';
    return new string(buffer.Slice(0, written));
}

public string ComputeHash(ReadOnlySpan<byte> data)
{
    Span<byte> hash = stackalloc byte[32]; // SHA-256 = 32 bytes
    SHA256.HashData(data, hash);
    return Convert.ToHexString(hash);
}
```

### 4. Hybrid stackalloc/ArrayPool Pattern

```csharp
public void ProcessData(int size)
{
    byte[]? rented = null;
    Span<byte> buffer = size <= 256
        ? stackalloc byte[256]
        : (rented = ArrayPool<byte>.Shared.Rent(size));

    try
    {
        DoWork(buffer.Slice(0, size));
    }
    finally
    {
        if (rented != null)
            ArrayPool<byte>.Shared.Return(rented);
    }
}
```

### 5. Uniform Processing Across Memory Types

```csharp
public static void InitializeSpan(Span<byte> span)
{
    byte value = 0;
    for (int ctr = 0; ctr < span.Length; ctr++)
        span[ctr] = value++;
}

// Works with any memory source:
byte[] array = new byte[100];
InitializeSpan(array);                     // array -> Span implicit

Span<byte> stackSpan = stackalloc byte[100];
InitializeSpan(stackSpan);                 // stackalloc span
```

---

## Performance Benchmarks

### Span Slicing vs Array.Copy

```
| Method         | DataSize | Mean        | Allocated |
|---------------|----------|-------------|-----------|
| SpanSlice     | 1000     | 0.47 ns     | 0 B       |
| ArrayCopy     | 1000     | 142.30 ns   | 1,024 B   |
| SpanSlice     | 10000    | 0.47 ns     | 0 B       |
| ArrayCopy     | 10000    | 1,284.00 ns | 10,024 B  |
```

Span.Slice is **constant-time** regardless of size. Array.Copy is linear and always allocates.

### stackalloc + Span vs new byte[]

```
| Method               | Size | Mean     | Gen0   | Allocated |
|---------------------|------|----------|--------|-----------|
| StackallocSpan      | 64   | 2.1 ns   | -      | 0 B       |
| NewByteArray        | 64   | 12.8 ns  | 0.0076 | 64 B      |
| StackallocSpan      | 256  | 2.1 ns   | -      | 0 B       |
| NewByteArray        | 256  | 18.3 ns  | 0.0305 | 256 B     |
| StackallocSpan      | 512  | 2.1 ns   | -      | 0 B       |
| NewByteArray        | 512  | 25.7 ns  | 0.0610 | 512 B     |
```

### ReadOnlySpan\<char> Parsing vs string.Split

```
| Method                          | Input              | Mean      | Allocated |
|--------------------------------|---------------------|-----------|-----------|
| StringSplitParse               | "100,200,300,400"  | 185.4 ns  | 296 B     |
| SpanSliceParse                 | "100,200,300,400"  | 52.7 ns   | 0 B       |
| StringSubstringTrim            | " hello world "    | 38.2 ns   | 80 B      |
| SpanTrim                       | " hello world "    | 6.3 ns    | 0 B       |
```

### ArrayPool vs new T[] for Repeated Allocations

```
| Method                | BufferSize | Iterations | Mean       | Gen0    | Allocated |
|----------------------|------------|------------|------------|---------|-----------|
| NewArray             | 4096       | 1000       | 48.2 us    | 47.851  | 4,096 KB  |
| ArrayPoolRentReturn  | 4096       | 1000       | 5.1 us     | -       | 0 B       |
```

---

## Best Practices

### Microsoft's Official Rules

1. **For synchronous APIs, use `Span<T>` instead of `Memory<T>` as a parameter.** Span is more versatile and callers with `Memory<T>` can still call via `.Span`.

2. **Use `ReadOnlySpan<T>` or `ReadOnlyMemory<T>` if the buffer should be read-only.** `ReadOnlySpan<T>` is the most flexible parameter — accepts arrays, stackalloc, strings, Memory, and Span.

3. **If your method accepts `Memory<T>` and returns `void`, do not use the instance after return.** The "lease" ends when the method exits.

4. **If your method accepts `Memory<T>` and returns `Task`, do not use it after the Task completes.**

5. **If you have `IMemoryOwner<T>`, you must dispose or transfer ownership (not both).**

6. **If your API accepts `IMemoryOwner<T>`, you accept ownership** and are responsible for disposal.

7. **Synchronous P/Invoke: accept `Span<T>`, pin with `fixed`.** Async P/Invoke: accept `Memory<T>`, pin with `.Pin()`.

### General Guidelines

| Guideline | Rationale |
|-----------|-----------|
| Prefer `Span<T>` for synchronous hot paths | Stack-only, JIT optimizes aggressively |
| Prefer `Memory<T>` for async or storage | Can live on heap, cross await boundaries |
| Use ReadOnly variants when mutation not needed | Wider caller compatibility |
| stackalloc size limit: <= 1KB | Avoid stack overflow in recursive/deep call stacks |
| Don't use Span in LINQ chains | ref struct can't be captured in lambdas |
| Accept `ReadOnlySpan<T>` for maximum flexibility | Accepts the widest range of callers |
| Always return ArrayPool buffers | Failure to return defeats pooling |

---

## Common Pitfalls

### 1. Dangling reference from stackalloc

```csharp
// WRONG — compiler prevents this (CS8352)
Span<byte> GetBuffer()
{
    Span<byte> buffer = stackalloc byte[256];
    return buffer;  // Cannot use local 'buffer' in this context
}
```

### 2. Excessive stackalloc causing stack overflow

```csharp
// DANGEROUS
Span<byte> buffer = stackalloc byte[count]; // If count is large -> StackOverflowException

// SAFE — guard with size check
byte[]? rented = null;
Span<byte> buffer = count <= 1024
    ? stackalloc byte[count]
    : (rented = ArrayPool<byte>.Shared.Rent(count));
try { /* work */ }
finally { if (rented != null) ArrayPool<byte>.Shared.Return(rented); }
```

### 3. Span in async methods

```csharp
// WRONG — compiler error
async Task ProcessAsync()
{
    Span<byte> buffer = stackalloc byte[256];
    await SomeOperationAsync();
    buffer[0] = 1;
}

// CORRECT — use Memory<T>
async Task ProcessAsync()
{
    Memory<byte> memory = new byte[256];
    await SomeOperationAsync();
    memory.Span[0] = 1;
}
```

### 4. Using .ToArray() unnecessarily

```csharp
// WRONG — negates zero-alloc benefit
ReadOnlySpan<byte> span = buffer.AsSpan(0, length);
byte[] copy = span.ToArray();
ProcessBytes(copy);

// CORRECT
ProcessBytes(span);
```

### 5. Not slicing ArrayPool buffers

```csharp
// WRONG — rented array may be larger than requested
byte[] buffer = ArrayPool<byte>.Shared.Rent(100);
stream.Read(buffer); // May read into extra bytes

// CORRECT — always track actual used length
byte[] buffer = ArrayPool<byte>.Shared.Rent(100);
int bytesRead = stream.Read(buffer.AsSpan(0, 100));
ProcessData(buffer.AsSpan(0, bytesRead));
```

### 6. Memory\<T> lease violation

```csharp
// WRONG — using Memory after void method returns
static void Log(ReadOnlyMemory<char> message)
{
    Task.Run(() => Console.WriteLine(message)); // Race condition!
}

// CORRECT — return Task so caller knows when lease ends
static Task Log(ReadOnlyMemory<char> message)
{
    return Task.Run(() => Console.WriteLine(message));
}

// CORRECT — defensive copy
static void Log(ReadOnlyMemory<char> message)
{
    string copy = message.ToString();
    Task.Run(() => Console.WriteLine(copy));
}
```

### 7. Forgetting PipeReader.AdvanceTo

```csharp
// WRONG — memory leak
ReadResult result = await reader.ReadAsync();
Process(result.Buffer);
// Missing: reader.AdvanceTo(...)

// WRONG — use-after-free
ReadResult result = await reader.ReadAsync();
reader.AdvanceTo(result.Buffer.End);
Process(result.Buffer); // Buffer is invalid here!
```

---

## Decision Flowchart

```
Need a contiguous memory buffer?
|
+-- Synchronous method?
|   +-- Need to write? --> Span<T>
|   +-- Read-only? ------> ReadOnlySpan<T>
|
+-- Async method or need to store on heap?
|   +-- Need to write? --> Memory<T>
|   +-- Read-only? ------> ReadOnlyMemory<T>
|
+-- Need ownership tracking?
|   +-- Yes --> IMemoryOwner<T> + MemoryPool<T>
|
+-- Small temp buffer (<= 1KB)?
|   +-- Yes --> stackalloc + Span<T>
|   +-- No ---> ArrayPool<T>.Shared.Rent() + Span<T>
|
+-- Legacy API / interop?
    +-- Existing T[] code --> T[] (wrap with .AsSpan() at boundaries)
    +-- ArraySegment<T> ----> implicit conversion to Span<T>
```

### Quick Reference Table

| Scenario | Use |
|----------|-----|
| Sync API parameter (read-only) | `ReadOnlySpan<T>` |
| Sync API parameter (read-write) | `Span<T>` |
| Async API parameter (read-only) | `ReadOnlyMemory<T>` |
| Async API parameter (read-write) | `Memory<T>` |
| Small temp buffer (sync, <= 1KB) | `stackalloc + Span<T>` |
| Large temp buffer (sync) | `ArrayPool<T>.Shared.Rent() + Span<T>` |
| Pooled buffer with ownership | `IMemoryOwner<T>` via `MemoryPool<T>.Shared.Rent()` |
| High-perf streaming I/O | `System.IO.Pipelines` (PipeReader/PipeWriter) |
| Binary protocol parsing | `BinaryPrimitives + ReadOnlySpan<byte>` |
| Struct reinterpretation | `MemoryMarshal.Read<T>` / `MemoryMarshal.Cast` |
| String parsing without alloc | `ReadOnlySpan<char>` via `string.AsSpan()` |
| Interop / P/Invoke (sync) | `Span<T>` with `fixed` |
| Interop / P/Invoke (async) | `Memory<T>` with `.Pin()` |
