# Dashboard and telemetry probe

Run on 2026-11-06 on Linux x86-64 with Bun 1.3.10, Docker 29.9.2 and Chrome 156. Versions and image digests are in `versions.txt`. The probe was built in a scratch folder, and only its source files and outputs are kept here. The results are explained in `research/dashboard.md`. To run it again, copy this folder, run `bun install`, then `bun test` and `bunx tsc -p .`.

No test here calls a real model or a real API. `bunfig.toml` loads `test/guard.ts` before every test file. It is the guard from `probes/dev-standards/`, which removes key variables and blocks the network except 127.0.0.1. Every trace viewer ran in a container on 127.0.0.1.

- `test/fake-run.ts`: a fake run record with 8 events. Two personas take part, and one step has a Lean check with the answer `proven`.
- `test/spans.ts`: turns one run into 4 OTLP spans (`invoke_workflow`, two `invoke_agent`, one `execute_tool`) and sends them over OTLP/HTTP with protobuf.
- `test/otlp-backends.test.ts`: sends the run to Jaeger 2.22.0, Phoenix 20.23.0, the Aspire dashboard 13.6.1 and Langfuse 4.66.0. Then it reads the run back from each one's API. The variable `BACKENDS` picks the viewers. Output: `out/otlp-backends.out`. 4 pass.
- `out/otlp-backends-v1.out`, `-v2.out`, `-v3.out` and `out/otlp-langfuse-v1.out`: earlier runs that failed. Jaeger 2.22.0 answered 404 on the old `/api/traces` route. Phoenix and Jaeger returned 8 spans instead of 4, because spans from an earlier run were still there. Langfuse 4.66.0 answered 404 on `/api/public/observations`. They are kept as evidence.
- `dashboard/server.ts`, `index.html`, `app.ts` and `style.css`: a small built-in page with `Bun.serve` and an HTML import. It reads `runs/<id>/events.jsonl` and never writes. Run it with `bun dashboard/server.ts <folder> <port>`.
- `test/dashboard.test.ts`: tests the login with a one-time code, the cookie flags and the Origin check. It also tests the run list with its numbers, live events over SSE with `Last-Event-ID`, and the page script from the same server. Output: `out/dashboard.out`. 6 pass.
- `test/screenshot.sh` and `test/cdp-shot.ts`: open the page in headless Chrome, add events while it is open, and take a screenshot of the same tab. Output: `out/screenshot.out` and `out/shots/titan-dashboard.png`, `out/shots/titan-dashboard-live.png`.
- `out/shots/jaeger-search.png` and `out/shots/phoenix.png`: the run in the viewers' own pages.
- `out/shots/aspire-trace.png` and `out/shots/aspire-traces.png`: blank. The Aspire page did not load in headless Chrome. The Aspire API read-back in `out/otlp-backends.out` is the proof for Aspire.
- `out/memory.txt`, `out/langfuse-memory.txt`: memory of each viewer from `docker stats` after the test.
- `out/langfuse-images.txt`: the image digests of the 6 Langfuse containers.
- `out/typecheck.out`: TypeScript in strict mode on all files. Exit code 0.
