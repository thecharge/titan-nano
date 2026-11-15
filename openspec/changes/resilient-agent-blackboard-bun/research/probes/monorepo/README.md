# Monorepo probe

Run on 2026-11-05 on Linux x86-64 with Bun 1.3.10.

- A Bun workspace: `apps/cli` uses `@titan/core` and `@titan/knowledge` through `workspace:*`. `@titan/knowledge` loads FTS5 and `sqlite-vec` 0.1.9.
- `run-output.txt`: run from source, then built with `bun build --compile` (103922452 bytes) and run with `vec0.so` next to the file. Both print `v0.1.9`.
- `compile-without-vec0-output.txt`: the built file without `vec0.so` next to it. `sqlite-vec` does not load.
- `packages/knowledge/src/only-package.ts` and `compile-sqlite-vec-package-output.txt`: loading `sqlite-vec` from its package works from source and fails in the built file.
- `compile-embed.ts` and `compile-embed-output.txt`: the embedder from `probes/knowledge-hub/embed.ts`, built as one file. It fails because `sharp` does not load.
