# @titan/core

## Responsibilities

Owns small shared utilities: identifiers, hashes, usage defaults, run-state predicates and bounded asynchronous work and pure bounded JSON admission.

## Public contract

Import utilities from the root export. `all` accepts lazy tasks, caps active work and drains started work on failure before rejecting. It retains tuple result types and input order. `settle` uses the same cap, runs all queued tasks and returns ordered fulfilled or rejected outcomes. Neither helper starts all supplied actions at once. Identifier validation rejects path-like or partial identifiers. `requireProgram` checks file kind and read or execute access asynchronously before an SDK spawn. Missing files, directories and inaccessible files return a typed operational error. `retainSessionId` binds a new native identifier or accepts the existing one, and rejects replacements with session_unavailable before the caller publishes them. Product orchestration belongs to runner and runtime.

`jsonByteLength` counts strict JSON bytes in bounded string segments without retaining the encoded document. `jsonStringChunks`, `ownJsonValue` and `invalidJson` share encoding and validation primitives with the streams package. `validateByteLimit` rejects invalid allowances before work starts. These helpers use foundation dependencies and perform no filesystem or network I/O.

## Verification

File claim helpers compare bounded read and write scopes. Overlapping readers share admission. Writes conflict with both write paths and additional read dependencies, including parent paths in either arrival order. Path coverage respects directory separators and the filesystem root.

Run `bun run test testing/unit/concurrency.test.ts` and the complete offline suite. Cases cover serial and parallel execution, invalid limits and rejection values including undefined, bounded settlement and continued admission after a settled rejection.

## Limits

Core may depend on foundation contracts but must not import product services. Hash compatibility matters for stored plans and snapshots; changing encodings requires recovery tests.
