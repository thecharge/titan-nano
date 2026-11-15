# Multi-agent framework probe

Run on 2026-11-05 on Linux x86-64 with Bun 1.3.10. Package versions are in `versions.txt`. The probe was built in a scratch folder, and only its source files and outputs are kept here. To run it again, copy this folder, run `bun install`, then `bun test` and `bunx tsc -p .`.

No test here calls a real model or a real API. `bunfig.toml` loads `test/guard.ts` before every test file. It is the guard from `probes/dev-standards/`, which removes key variables and blocks the network.

- `test/openai-agents.test.ts`: `@openai/agents` 0.21.0 with a fake model that answers from a script and counts its calls. It tests a handoff, an agent as a tool, an input guardrail with `runInParallel` false and true, and `maxTurns`. Output: `out/openai-agents-output.txt`. 5 pass.
- `test/langgraph.test.ts`: `@langchain/langgraph` 1.5.2 with plain functions as nodes. It tests a crash and resume with the in-memory checkpoint and with the SQLite checkpoint, and an interrupt. Output: `out/langgraph-output.txt`. 2 pass, 1 fail: `@langchain/langgraph-checkpoint-sqlite` 1.1.0 does not load under Bun, because Bun cannot load `better-sqlite3`. The failure is kept as evidence.
- `test/titan-toys.test.ts`: two small models written for `titan`, with no package. One is a stall count with a limit of 2. The other is a majority vote of 5 samples with errors that are shared some of the time, with seed 42.
- `test/otel.test.ts`: a fake run record turned into OpenTelemetry spans with `@opentelemetry/sdk-trace-base` 2.12.0, kept in memory.
- `test/a2a.test.ts`: an agent card for `titan serve`, built with the types of `@a2a-js/sdk` 1.3.0, written as JSON and read back.
- `out/all-output.txt`: the whole run. 12 pass, 1 fail, in 596 ms.
- `out/tsc-output.txt`: TypeScript 7.0.2 in strict mode on all test files. Exit code 0.
