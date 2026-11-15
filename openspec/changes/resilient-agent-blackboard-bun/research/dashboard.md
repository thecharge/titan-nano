# Research: a self-hosted dashboard for runs, with telemetry

**Reader:** a developer new to `titan`. **Purpose:** know how a person sees past and running workflows in a browser, which trace viewers `titan` can send its telemetry to, and why. Each pick has a source quote or a test.

On 2026-11-06 the user asked for a self-hosted dashboard. In it, a person sees the workflows that ran and the ones that are running, and what happens in them. Telemetry is shown next to them. The user asked for research with real evidence, in plain language, and in OpenSpec.

All tests ran on 2026-11-06 on Linux x86-64 with Bun 1.3.10 and Docker 29.9.2. The probe is in `probes/dashboard/`, with its versions in `versions.txt`. No test called a real model. Each Bun test ran behind the guard file of spec test-strategy, which blocks the network except 127.0.0.1. Every trace viewer ran in a container on 127.0.0.1. Every quote below is copied from the fetched page. The page text is in `dashboard-sources/<id>.txt`, and the links are in `dashboard-sources/urls.tsv`. 38 of the 40 pages returned HTTP 200. W32 and W38 returned 404, so nothing is quoted from them. To check the quotes, run this from the `research/` folder:

```bash
python3 -I check-quotes.py dashboard.md dashboard-sources probes
```

## Words used here

- A _dashboard_ is a web page that shows runs and their numbers while they happen.
- _Telemetry_ is data that a program sends about its own work: times, counts, tokens and costs.
- A _trace viewer_ is a program that receives spans and shows them in a browser. Jaeger, Phoenix, Langfuse and the Aspire dashboard are trace viewers.
- _OTLP_ (OpenTelemetry Protocol) is the open format in which programs send spans to a trace viewer. _OTLP/HTTP_ sends it over HTTP, by default to port 4318.
- A _span_ is one timed piece of work in a trace, such as one agent's turn. The GenAI rules of OpenTelemetry name the spans of AI agents, for example `invoke_agent`.
- _SSE_ (server-sent events) is a way for a server to keep sending new events to a web page over one open HTTP answer.
- An _HTML import_ is a Bun feature: a server file imports `index.html`, and Bun bundles the page and its scripts.
- An _HttpOnly_ cookie cannot be read by scripts on the page. A _SameSite=Strict_ cookie is not sent when another site starts the request.
- The _Origin_ header names the web site that started a request.

## 1. The trace viewers, side by side

The table lists what each project says about itself, from its own README, license file or docs page. "Tested here" means that the export test in `probes/dashboard/` sent a run to it and read the run back.

| Viewer                                 | License                       | What it needs to run                                          | Memory, measured     | Keeps data after a restart  | Tested here       |
| -------------------------------------- | ----------------------------- | ------------------------------------------------------------- | -------------------- | --------------------------- | ----------------- |
| Jaeger 2.22.0 (W1, W2)                 | Apache-2.0                    | 1 container                                                   | 13.93 MiB            | no, in the all-in-one setup | yes, 4 of 4 spans |
| Phoenix 20.23.0 (W3, W4, W35)          | Elastic License 2.0           | 1 container                                                   | 415.9 MiB            | not read                    | yes, 4 of 4 spans |
| Langfuse 4.66.0 (W5–W7, W31, W34, W36) | MIT, except the `ee/` folders | 6 containers: web, worker, Postgres, ClickHouse, Redis, MinIO | 1826.6 MiB for all 6 | yes                         | yes, 4 of 4 spans |
| Aspire dashboard 13.6.1 (W8, W33, W40) | MIT                           | 1 container                                                   | 64.36 MiB            | no, by default              | yes, 4 of 4 spans |
| otel-desktop-viewer (W9, W27)          | Apache-2.0                    | 1 program                                                     | not measured         | no, by default              | no                |
| otel-tui (W10, W28)                    | Apache-2.0                    | 1 program in a terminal                                       | not measured         | not read                    | no                |
| SigNoz (W11, W12, W37)                 | MIT, except the `ee/` folders | ClickHouse and more                                           | not measured         | yes                         | no                |
| Grafana Tempo (W13, W14)               | AGPL-3.0                      | object storage, and Grafana to view                           | not measured         | yes                         | no                |
| Opik (W15, W16)                        | Apache-2.0                    | several containers                                            | not measured         | not read                    | no                |
| OpenLIT (W17, W18)                     | Apache-2.0                    | `docker compose`                                              | not measured         | not read                    | no                |

The memory numbers come from `probes/dashboard/out/memory.txt`, taken with `docker stats` after the export test. They are one sample on an idle machine, not a peak.

What the sources say, in their own words:

> [W1] "# Run Jaeger all-in-one (includes UI, collector, query, and in-memory storage)"

> [W1] "# Send traces via OTLP: gRPC on port 4317, HTTP on port 4318"

> [W2] ""license":"Apache-2.0""

> [W35] "Elastic License 2.0 (ELv2)"

> [W35] "You may not provide the software to third parties as a hosted or managed service, where the service provides users with access to any substantial set of the features or functionality of the software."

> [W7] "Langfuse is open source and can be self-hosted using Docker on your own infrastructure. Some add-on features require a license key."

> [W7] "Clickhouse: High-performance OLAP database which stores traces, observations, and scores."

> [W36] "Content outside of the above mentioned directories or restrictions above is available under the "MIT Expat" license as defined below."

> [W8] "The dashboard is secured with a browser token by default. A login URL with the token is displayed in the terminal output."

> [W8] "The standalone dashboard defaults to no persistence and telemetry is lost when the dashboard shuts down."

> [W40] ""license":"MIT""

> [W9] "Telemetry is stored in memory by default. Use `--db` to persist to a file."

> [W10] "A terminal OpenTelemetry viewer inspired by [otel-desktop-viewer](https://github.com/CtrlSpice/otel-desktop-viewer/tree/main)."

> [W37] "Content outside of the above mentioned directories or restrictions above is available under the "MIT Expat" license as defined below."

> [W14] ""license":"AGPL-3.0""

> [W15] "Opik is Apache-2.0 licensed and free to self-host: the full platform, backend included, not just a client SDK."

> [W17] "Self-host free (Apache 2.0)"

Temporal has its own web page for workflows (W26), but that page works only with a Temporal server. `titan` does not use Temporal, so the page was not tested.

> [W26] "Temporal UI requires [Temporal v1.16.0](https://github.com/temporalio/temporal/releases/tag/v1.16.0) or later."

## 2. What a trace viewer cannot show

A trace viewer shows spans after they end. It does not know `titan`'s own words: a step, a falsify verdict, a proof result, a stall or a request that waits for a person. It also does not show a step that has not started yet. Those facts live on the board.

So the dashboard that the user asked for has two parts:

1. A page that `titan serve` serves itself. It reads the board and the run records, so it shows past runs, running runs, steps that wait, verdicts and proofs.
2. An optional export of the same run as OTLP spans to a trace viewer that the person already runs. This gives the deep timing view and keeps history in that viewer.

The page is the main view. The export is for people who already run a trace viewer, or want one.

## 3. Test: send one run to four trace viewers and read it back

`test/spans.ts` turns a fake `titan` run into 4 spans. It uses the GenAI span names: `invoke_workflow`, two `invoke_agent` spans and one `execute_tool`. It adds `titan.*` attributes for the run id, the step, the falsify verdict and the proof verdict. It sends them with `@opentelemetry/exporter-trace-otlp-proto` 0.223.0 over OTLP/HTTP. `test/otlp-backends.test.ts` then asks each viewer's own HTTP API for the spans.

> [probe:dashboard/out/otlp-backends.out] "jaeger: sent 4 spans, read back 4: execute_tool lean_check | invoke_agent lean-prover | invoke_agent skeptic | invoke_workflow prove-sum-formula"

> [probe:dashboard/out/otlp-backends.out] "phoenix: sent 4 spans, read back 4: execute_tool lean_check | invoke_agent lean-prover | invoke_agent skeptic | invoke_workflow prove-sum-formula"

> [probe:dashboard/out/otlp-backends.out] "aspire: sent 4 spans, read back 4: execute_tool lean_check | invoke_agent lean-prover | invoke_agent skeptic | invoke_workflow prove-sum-formula"

> [probe:dashboard/out/otlp-backends.out] "langfuse: sent 4 spans, read back 4: AGENT:invoke_agent lean-prover | AGENT:invoke_agent skeptic | SPAN:invoke_workflow prove-sum-formula | TOOL:lean_check"

> [probe:dashboard/out/otlp-backends.out] "4 pass"

What this shows:

- One exporter and one span format work with all four viewers. `titan` needs no code that is special to one viewer.
- Langfuse reads the GenAI names. It gave the agent spans the type AGENT and the tool span the type TOOL, and it renamed `execute_tool lean_check` to `lean_check`.
- The exporter runs under Bun 1.3.10 with no error.

The test failed 4 times before it passed. The failures are kept as evidence in `out/`:

- `otlp-backends-v1.out`: Jaeger 2.22.0 answered 404 on the old route `/api/traces`. Only `/api/v3/traces` works. The Jaeger changelog (W39) says that release v2.21.0 removed the old routes.
- `otlp-backends-v2.out` and `otlp-backends-v3.out`: Phoenix and then Jaeger still held spans from an earlier run, so the test read 8 spans. The test now uses a new service name for each run.
- `otlp-langfuse-v1.out`: Langfuse 4.66.0 answered 404 on `/api/public/observations`. The v2 route `/api/public/v2/observations` works (W34).

> [probe:dashboard/out/otlp-backends-v1.out] "SyntaxError: Failed to parse JSON"

> [probe:dashboard/out/otlp-backends.out] "jaeger old /api/traces status 404"

> [W39] "Feat(query)!: remove v1 http endpoints the ui no longer calls"

> [probe:dashboard/out/otlp-langfuse-v1.out] "This endpoint is not available on deployments running in Langfuse v4 events_only mode."

> [W34] "GET /api/public/v2/observations"

> [W33] "The API section configures the dashboard’s Telemetry HTTP API (/api/telemetry/*) endpoints."

The screenshots are in `out/shots/`. `jaeger-search.png` shows the trace with 4 spans and a time of 4.1 s. `phoenix.png` shows the projects with one trace each. The Aspire screenshot is blank: the Aspire page did not connect to its server in headless Chrome 156. So for Aspire, the API answer is the only proof.

Two facts about outside contact were seen:

- The Phoenix page showed "Update available: Phoenix v21.0.0". So the Phoenix page or server reached a service outside the machine. This probe did not find which one made the call.
- The Langfuse compose file sets `TELEMETRY_ENABLED` to `true` by default. The probe set it to `false`.

## 4. Test: the built-in dashboard page

`probes/dashboard/dashboard/server.ts` is a small model of the page that `titan serve` would serve. It uses `Bun.serve` with an HTML import, so Bun bundles the page and no script comes from another host (W23). It reads `runs/<id>/events.jsonl` and never writes to it.

> [W23] "To get started, import HTML files and pass them to the routes option in Bun.serve()."

The login works like the login of Jupyter and the Aspire dashboard (W24, W8). The server makes a one-time code. A person opens the URL with the code. The server answers with an HttpOnly, SameSite=Strict cookie, and the code stops working.

> [W24] "For this reason, Jupyter Server uses a token-based authentication that is on by default."

> [W25] "Set-Cookie: <cookie-name>=<cookie-value>; SameSite=Strict"

> [W25] "Note that a cookie that has been created with HttpOnly will still be sent with JavaScript-initiated requests, for example, when calling XMLHttpRequest.send() or fetch()."

The last quote matters. A cookie alone does not stop another web site from making the browser send a request. So the server also refuses any request whose Origin is not its own, as spec titan-server already does for the token.

`test/dashboard.test.ts` checks the page:

> [probe:dashboard/out/dashboard.out] "login status 303 set-cookie flags: titan_session=<id>; HttpOnly; SameSite=Strict; Path=/"

> [probe:dashboard/out/dashboard.out] "new event arrived after 201 ms"

> [probe:dashboard/out/dashboard.out] "after Last-Event-ID 3 the first message is: id: 4"

> [probe:dashboard/out/dashboard.out] "page script sources: /../chunk-kj1w61y8.js"

> [probe:dashboard/out/dashboard.out] "6 pass"

The 6 tests check these facts:

1. Data routes answer 401 before login.
2. A wrong code gets 403. The right code gets a cookie once, and the same code again gets 403.
3. A request with the cookie but with a foreign Origin gets 403.
4. The run list shows one past run and one running run. For each it shows elapsed time, attempts, agents at once, input and output tokens, cost, falsify verdicts and proof results.
5. A new event reaches an open stream in 201 ms. The server checks the file every 200 ms, so this number mostly measures that check. After a reconnect with `Last-Event-ID: 3`, the stream starts at event 4.
6. The page loads its script from its own server only.

`test/screenshot.sh` then opened the page in headless Chrome 156 through the one-time URL. `titan-dashboard.png` shows both runs with their telemetry. For `titan-dashboard-live.png`, the script kept one tab open, added events 5 and 6 to the running run, and took the screenshot through the Chrome DevTools Protocol. The tab showed the new events and the new numbers without a reload.

> [probe:dashboard/out/screenshot.out] "page shows ""id":6": true"

> [probe:dashboard/out/screenshot.out] "reusing or guessing a code: 403"

> [probe:dashboard/out/screenshot.out] "second browser without the cookie: 401 on /api/runs"

TypeScript 7.0.2 in strict mode passed on all probe files:

> [probe:dashboard/out/typecheck.out] "tsc exit 0"

## 5. Which telemetry names to use

The OpenTelemetry GenAI rules already name the numbers that the user wants to see. They are still marked "Development", so they can change.

> [W21] "**Span name** SHOULD be `{gen_ai.operation.name} {gen_ai.agent.name}` if `gen_ai.agent.name`"

> [W22] "| `gen_ai.client.operation.duration` | Histogram | `s` | GenAI operation duration. [1] | ![Development](https://img.shields.io/badge/-development-blue) | |"

> [W29] "**Status**: [Development][DocumentStatus]"

> [W30] "This attribute is likely to contain sensitive information including user/PII data."

> [W20] "When using OTEL_EXPORTER_OTLP_ENDPOINT, exporters MUST construct per-signal URLs as described below."

So `titan` uses these rules:

- It names spans and token counts with the GenAI names, and its own facts with `titan.*` names.
- It does not send prompt or answer text in a span unless the person turns it on, because the rules say that this text can be sensitive.
- It sends spans only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set, and it builds the trace URL as the exporter rules say.

## 6. Claims that were wrong or could not be checked

- The Opik README (W15) says, in a table, that one other tool is "Source-available (Elastic License 2.0, not OSI-approved)". The Phoenix license file (W35) is the Elastic License 2.0. So the claim is true for Phoenix. The GitHub API shows Phoenix's license as "NOASSERTION" (W4), so the license file is the source to trust.
- The GitHub API shows Langfuse and SigNoz as "NOASSERTION" (W6, W12). Their license files (W36, W37) say MIT outside the `ee/` folders.
- Jaeger 2.22.0 has no `/api/traces` route any more (section 3).
- Langfuse 4.66.0 has no `/api/public/observations` route any more (section 3).
- The Langfuse compose file pins only the Langfuse images. ClickHouse `25.12`, MinIO `latest`, Redis `7` and Postgres `17` are moving tags. The probe recorded their digests in `out/langfuse-images.txt`.

## 7. All picks in one table

| Idea                                                                                | Source                  | Pick                                                                        | Where in the specs            |
| ----------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------- | ----------------------------- |
| `titan serve` serves its own dashboard page, from the board and the run records     | user request, W23, test | kept                                                                        | spec run-dashboard            |
| One-time login code, then an HttpOnly, SameSite=Strict cookie, and the Origin check | W8, W24, W25, test      | kept                                                                        | spec run-dashboard            |
| Live events over SSE with `Last-Event-ID`                                           | test, spec titan-server | kept                                                                        | spec run-dashboard            |
| Telemetry per run: time, attempts, agents at once, tokens, cost, verdicts, proofs   | W21, W22, W29, test     | kept                                                                        | spec run-dashboard            |
| Optional OTLP/HTTP export when `OTEL_EXPORTER_OTLP_ENDPOINT` is set                 | W19, W20, test          | kept                                                                        | spec workflow-run             |
| No prompt or answer text in spans unless the person turns it on                     | W30                     | kept                                                                        | spec workflow-run             |
| Jaeger as the trace viewer in the docs example                                      | W1, W2, test            | kept: Apache-2.0, 1 container, 13.93 MiB                                    | spec run-dashboard            |
| Langfuse as a second example                                                        | W7, W36, test           | kept, as an example: it needs 6 containers                                  | design.md                     |
| Phoenix as the example                                                              | W35, test               | not kept: Elastic License 2.0, and it contacted an outside service          | —                             |
| Aspire dashboard as the example                                                     | W8, test                | not kept: no data after a restart, and the page did not render headless     | —                             |
| Build on Grafana Tempo or SigNoz                                                    | W13, W11                | not kept: they need more services, and they were not tested                 | —                             |
| Temporal's web page                                                                 | W26                     | not kept: it needs a Temporal server                                        | —                             |
| Buttons on the page that answer requests or stop runs                               | —                       | not kept in this change: the page is read-only, and answers stay in the CLI | an open question in design.md |

## 8. Not tested

- Phoenix, Langfuse and Aspire with no network at all. The containers had network access, and only the Phoenix update notice was seen.
- otel-desktop-viewer, otel-tui, SigNoz, Tempo, Opik and OpenLIT. Their pages were read, but their code was not run.
- OTLP over gRPC. Only OTLP/HTTP with protobuf was sent.
- OTLP metrics. Only spans were sent. The page computes its numbers from the events.
- A page with hundreds of runs, or a run with thousands of events.
- The page in a browser other than Chrome 156.
- The Aspire page in a normal, not headless, browser.
