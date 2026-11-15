# @titan/store

## Responsibilities

Owns finite in-memory storage and keyed asynchronous serialization. Runtime owners choose rejection or least-recently-used eviction according to whether live state can be discarded.

## Public contract

`BoundedStore` supports expiry, access ordering and atomic synchronous update callbacks. A clock port enables deterministic expiry. Failed updater callbacks preserve existing values and ordering. `KeyedQueue.use` serializes one key, permits independent keys to overlap and releases capacity after rejection. `KeyedQueue.drain(key)` waits for the operations already admitted for that key without consuming queue capacity. An owner must stop admission before draining if it needs a shutdown barrier.

## Verification

Run `bun run test testing/unit/store.test.ts`. Tables cover eviction, exact expiry deadlines, update creation and deletion, failed update preservation, schema validation, keyed overlap and queue saturation.

## Limits

The store is process-local and provides no durable transaction or multi-process lock. Update callbacks are synchronous so an operation cannot interleave with another update. Queue capacity failures are operational failures, never quality verdicts.
