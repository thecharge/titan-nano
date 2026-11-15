# @titan/streams

## Responsibilities

Owns byte-limited stream collection and asynchronous file reads for bounded parsing. It also encodes JSON data within an explicit byte budget. It has no vendor or orchestration dependency.

## Public contract

`readBytes(source, maximum)` consumes byte chunks and returns a Buffer. It copies chunks before retaining them, rejects invalid limits and fails immediately when the next chunk exceeds the byte budget. Async iterator cleanup runs on failure. `readFileBytes(path, maximum)` uses a file stream with a fixed chunk size and the same byte budget.

`jsonBytes(value, maximum)` returns JSON bytes in a Buffer. It visits plain or null-prototype objects and arrays, finite numbers, strings, booleans and null. It escapes bounded string segments without splitting surrogate pairs. It rejects unsupported values, accessors, sparse arrays, custom prototypes, cycles and more than 128 nested containers. Shared references are allowed. The collector refuses expanded output above the supplied byte limit before retaining it.

`jsonByteLength(value, maximum)` checks the same data and expanded byte allowance without retaining the encoded document. It counts bounded segments synchronously so a protocol callback can admit a frame without changing message ordering. It is a compatibility export of the shared core counter and performs no filesystem or network I/O. The counter visits containers directly and escapes bounded string segments. All encoding paths enforce the same strict data contract and share byte-limit validation.

`jsonStream(value, maximum)` yields independent byte pages of at most 64 KiB. It applies the same strict JSON rules and complete expanded byte budget without retaining the encoded document. Consumers must handle a late failure after earlier pages have been yielded. `validateByteLimit` lets a writer reject an invalid allowance before opening files or pulling its source.

## Verification

The offline suites cover empty and binary input, reused input buffers, exact boundaries, invalid limits, oversized input, interrupted streams and missing files. File readers never use whole-file reads before checking their limit. JSON cases compare exact native JSON bytes for supported data and reject byte expansion, invalid values, cycles, accessors and excessive depth. A repeated-reference case stops at a small budget without serializing its full expanded value.

## Limits

Structured parsers still need a complete bounded document. The final Buffer can coexist briefly with its collected chunks. These helpers bound retained bytes; they do not promise that upstream code cannot allocate an oversized chunk. A caller must set a suitable maximum and use cancellation at its transport boundary.

`fileHandleChunks` streams bounded buffers from an already open file handle. The caller owns and closes the handle. Each yielded buffer has its own storage. Workspace and journal readers retain one file owner and close it in `finally`; they do not create a second stream owner for the same descriptor.

atomicWrite and atomicWriteStream own generic durable file publication. They sync a temporary file, rename it and sync its parent. The streamed form enforces the complete byte allowance, closes its source and removes temporary bytes on failure. Publication may have happened if directory sync fails after rename; the owning journal must reconcile that outcome. Board retains compatibility exports for these helpers.
