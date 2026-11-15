# TypeScript source scope counterexamples

## Delivery state

The production delivery goal remains active for every applicable Codex and Claude requirement. Use OpenSpec apply on resilient-agent-blackboard-bun. Ten of 261 tasks remain closed. Keep no live vendor calls or Titan skill operation, stubbed vendor E2E, normal hooks, capped lazy concurrency and bounded asynchronous I/O. Preserve original untracked harness directories, frozen configuration work and both retained stashes.

Main 48ff372 was pushed and independently cleared by CI 42479516103: 2382 tests, 189 sources and zero gaps. See graph-execution-cpu.md. Flat-test repair b35a4b203fd6c68b7a8f11db5e534bb4dc60aeb9 passed its corrected normal staged gate: 2465 tests across 130 files in 224.10 seconds, with 192 product sources and zero gaps. The staged gate took 239.32 seconds and message policy 0.48 seconds. Normal outgoing verification passed 2465 tests in 229.419 seconds, with 192 product sources and zero gaps; the gate took 243.66 seconds. The push succeeded and remote main was confirmed at this revision. Independent CI 42481413279 passed 2465 tests across 130 files in 296.49 seconds, with 192 sources and zero gaps. [CI proof](https://github.com/thecharge/titan-nano/actions/runs/42481413279).

This next worktree is titan-nano-typescript-source-scope on codex/typescript-source-scope, based on b35a4b2. Frozen dependency installation passed. The source repair and its verification are described below. Do not edit a checkout during its verification.

## Confirmed scope gaps

An isolated temporary workspace used an exact copy of the current root tsconfig, a dependency link to the installed workspace, one valid included TS file and one file containing a string variable initialized with a number. The pinned actual compiler returned zero with no diagnostic for TSX, MTS and CTS suffixes. The identical source under TS returned exit two and TS2322. The root include patterns end in .ts. These are reproduced false negatives, not a claim that an existing product module currently has that suffix.

A direct call of validPackageTypeScriptPolicy accepted include lists containing only no-source/**/*.ts and only README.md, as well as the intended src/**/*.ts. The strict flags remain protected, but the admitted include can hide the source. ProductSourceGlob also ends in .ts, so independent product coverage inventory omits the other TypeScript source suffixes.

Primary reference: [TypeScript include](https://www.typescriptlang.org/tsconfig/#include) defines directory patterns and supported source discovery. [TypeScript 4.7 file extensions](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-7.html#new-file-extensions) documents MTS and CTS. A first top-level include.html link instead described type acquisition; do not use it as compiler-scope evidence. Exact pinned compiler results above establish current behavior.

## Next implementation

Inspect current policy constants, schemas, actual workspace layouts, compilation factories and coverage inventory before changing them. Broaden actual root and package compiler includes to all supported TypeScript source suffixes. Require the exact declared package source scope, with the testing-root layout represented explicitly. Close the independent product coverage inventory omission. Add passing and deliberately invalid compiler cases for TS, TSX, MTS and CTS at root and package scope; prove actual scope rejection and missing coverage with shared factories and flat tables. Preserve strict flags and existing assertions.

Update OpenSpec dev-standards requirements and acceptance owners under the still-open engineering tasks. Task 2.5's original strict-flag scenarios remain distinct; this does not close wider guardrail or coverage ownership. Typecheck must pass before dependent tests. Falsify the new scope and inventory guards, restore and run final proving cases, review the diff, use normal staged and outgoing gates and inspect CI. Publish only after its baseline is independently cleared. Continue remaining production delivery afterward.

## Implementation and focused proof

Canonical directory includes now cover supported TypeScript suffixes at root and workspace scope. The testing root has an explicit complete-tree counterpart. The strict package schema refuses arbitrary or duplicate includes, and workspace inspection binds the allowed pattern to the actual layout. Coverage and boundary inventories include TS, TSX, MTS and CTS. The exact unused-code configuration also covers these suffixes and supported test discovery names. Existing limits, strictness and thresholds remain unchanged. Ownership plugins already inspect these suffixes; no plugin scope was widened unnecessarily.

The pinned compiler cases require both the expected diagnostic and file name for invalid assignments. Each root/package and suffix combination has two valid and two invalid inputs. Real coverage-command cases require exact source and gap counts, names and exit codes. Boundary cases count loaded sources and prove byte-limit failures. Actual unused-code cases accept imported and reject unreferenced files while checking unchanged content.

Typecheck passed before the focused selections. The first selection passed 143 cases across five files in 23.79 seconds. The expanded selection passed 171 cases across six files in 28.41 seconds. Both focused commands exited one because the global coverage check correctly rejects omitted product modules; neither is a complete coverage pass.

Six deliberate mutations each passed typecheck and were detected: removing layout comparison caused one failed assertion; permitting duplicate package patterns caused one; restoring TS-only coverage inventory caused nine; TS-only boundary inventory caused six; TS-only unused-code policy caused three; narrowing actual root app scope made the configuration command fail. Mutations were restored individually. Restored typecheck passed. The final restored selection passed 171 cases across six files in 28.12 seconds. Focused global coverage remained incomplete. Lint, strict OpenSpec validation, specifications, documentation, spelling, schema ownership, flat tests, boundaries, unused-code and TypeScript policy checks passed. Policy inspected the root and 24 workspace configurations. Normal staged/outgoing gates and independent CI for this increment remain pending. These scenarios do not close tasks 27.10 or 32.1.

## First normal staged gate

The hook blocked the commit because Biome interpreted unquoted glob patterns in the development guide as emphasis and preferred different formatting from dprint. All 2534 tests passed across 131 files in 247.51 seconds. The independent product inventory found 192 sources and zero gaps, and the test command exited zero. The complete gate took 262.78 seconds and exited one because of the documentation formatting error. No commit or push occurred. The repair marks the patterns as inline code and retains both formatters. Rerun normal verification before committing.
