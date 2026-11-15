# Test strategy and code standards probe

Run on 2026-11-05 on Linux x86-64 with Bun 1.3.10. Package versions are in `versions.txt`. The probe was built in a scratch folder, and only its source files and outputs are kept here. To run it again, copy this folder, run `bun install`, then the commands at the top of each output file.

No test here calls a real API. The values `fake-not-real` in the commands are made-up keys, used to check that the guard removes them.

- `test/no-network.ts`: the guard that `bunfig.toml` loads before every test file. It removes key variables, and blocks `fetch`, `node:net`, `node:tls`, `node:http`, `node:https`, `Bun.connect` and child processes, except for 127.0.0.1 and allowed programs. It does nothing when a `TITAN_LIVE_*` variable is `1`.
  - `out/no-network-v1.ts` and `out/no-network-v1-output.txt`: the first version, which did not guard `node:http` and `node:https`. Its test "node:https request is blocked" failed, because the request reached example.com.
  - `out/child-process-output.txt`: before the process guard, `curl` in a child process reached example.com with HTTP 200. After it, 11 tests pass.
- `src/port.ts`, `src/fake-backend.ts`, `src/api-backend.ts`, `test/backend-contract.ts`, `test/contract.test.ts`: one contract test. It runs against the fake backend and against the model-API adapter with the AI SDK's mock model. Only with `TITAN_LIVE_API=1` does it run against the live API. The live part was skipped, and the package `@ai-sdk/anthropic` is not installed here.
- `test/mcp-in-memory.test.ts`: a tool server and a client linked in memory, with no process and no network.
- `src/wilson.ts`, `test/wilson.test.ts`: the Wilson bound, with the 4 numbers from spec persona-lifecycle and 2 property tests with fast-check.
- `out/unit-output.txt`: the whole run. 21 pass, 2 skip, 0 fail, in 189 ms.
- `out/coverage-output.txt`: `bun test --coverage` with `coverageThreshold = 0.9`. Exit code 0, then exit code 1 after an untested function is added.
- `stryker.config.json`, `out/stryker-output.txt`: StrykerJS with its command runner on `bun test`. 39 mutants, 34 killed, 5 survived, score 87.18 %, in 3 s, on files that had 100 % line coverage.
- `tsconfig.json`, `out/tsc-output.txt`: TypeScript in strict mode found one error in the fake agent file, then exit code 0 after the fix.
- `biome.json`, `out/biome-output.txt`, `out/biome-rules.txt`: Biome's check on `src` and `test`. 19 errors and 22 warnings at first. The safe fixes removed the format errors, and 22 warnings stayed. Later, `biome ci` on `test/no-network.ts` alone, with 20 warnings, gave exit code 0, and exit code 1 with `--error-on-warnings`.
- `lintcase-src/`, `out/biome-project-rules.txt`: Biome found an import cycle with its project rules. It found a promise with no `await` only after `noFloatingPromises` was turned on by name.
- `src/commit-check.ts`, `out/commit-check-output.txt`: a check of commit subjects against Conventional Commits. All 9 commits in this repo fail it. Two example subjects pass.
- `src/scenario-map.ts`, `out/scenario-map-output.txt`, `out/scenario-sample.test.ts.txt`: a check that every scenario in the specs has a test with the name `<spec> > <scenario>`. It found 186 scenarios, and it reports a test that names a scenario that does not exist.
