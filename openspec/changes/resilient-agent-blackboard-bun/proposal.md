## Why

A person needs an answer with evidence about how it was checked. Titan lets their existing agent organize work and challenge each result before using it.

## What Changes

- Add `titan`, a local command-line tool built with Bun and TypeScript. The first intended users are developers who already use an agent tool.
- The person describes the problem. Their main agent searches saved lessons and roles, writes a workflow, checks it, starts it and reports the evidence.
- A _persona_ is a saved role with inputs, outputs and allowed tools. A _backend_ is the service or agent library that runs that role.
- Support Claude Code, Codex and Antigravity, plus Anthropic, OpenAI and Gemini model APIs. Each adapter must prove its advertised capabilities before release.
- Every step needs a challenge: another role, a script or a proof check. Failed attempts receive the evidence and retry within limits.
- Keep attempts separate. Only the selected surviving result supplies later inputs and publishes knowledge changes. Preserve evidence from failures and losing candidates.
- Coordinate roles through a durable message board. Run several workflows at once across different agent tools or within one tool. Keep their sessions, files, answers and approvals separate. Share bounded capacity fairly.
- Keep reusable knowledge in readable files with word and meaning search. Save immutable persona versions and their measured history.
- Require scoped approvals for protected operations. Tokens distinguish clients; human-only enforcement depends on tested agent permissions and has a documented trusted-agent limit.
- Add optional improvement rounds and an experimental learning policy. They share execution limits and cannot weaken checks or grant themselves permissions.
- Run approved remote jobs through RunPod. The local deadline does not guarantee that remote billing has stopped.
- Serve a local HTTP API and a read-only dashboard showing all concurrent workflows, their origins, capacity and waits. Filter by project, agent tool or session. Other programs can retain independent run handles.
- Check formal claims with Lean or a numerical solver, and other outcomes with fixed scripts. A proof establishes only the approved statement. Surviving agent challenges does not establish truth.
- Preserve workflow and agent checkpoints through rate limits, session loss and process interruption. Keep operational recovery separate from completed result verdicts.
- Support mixed sequential and parallel dependency graphs, with configurable finite limits and no fixed few-step shape.
- Centralize settings, validation, file formats, override rules and protected limits in `@titan/config`.
- Specify complete CLI targeting, lifecycle controls, artifact inspection, safe application, distribution and installation evidence.
- Cover code, documents, research, external operations and shared live self-development with checked examples and an immutable installed controller.
- Keep local commit and push checks small. Run complete offline verification locally, with stubbed vendor responses. GitHub Actions requires explicit user authorization. Check documentation separately from end-to-end tests.
- Deliver in evidence-gated stages. Start with a local path using a fake backend, then one verified real adapter. Preserve every capability below for the full release.
- Define success through passing acceptance scenarios, clean installation and recorded platform support. Claims of better outcomes also need the fixed comparison in spec dev-standards.

## Capabilities

### New Capabilities

- `main-agent-guide`: guide, schema, examples and installation into each agent tool.
- `harness-detection`: detect the surrounding agent tool, with explicit overrides.
- `harness-adapters`: one session interface for the Claude, Codex and Antigravity adapters.
- `tool-servers`: knowledge tools and persona tools over Model Context Protocol (MCP).
- `backend-plugins`: named packages that add backends or text-search embedders.
- `workflow-file`: checked file format for roles, steps, dependencies and checks.
- `workflow-run`: bounded execution, isolated attempts, recovery and result records.
- `persona-registry`: immutable role versions, search, reuse and history.
- `persona-board`: typed messages, help requests, answers and continuation.
- `knowledge-hub`: readable files, word search, meaning search and checked publication.
- `backend-selection`: backend choice, readiness, JSON output and program access.
- `step-falsification`: independent challenges, evidence, retries and candidate selection.
- `self-improving-loop`: bounded workflow evaluation and retained lessons.
- `hive-collaboration`: added work, open role calls, ordered splits and finite allowances.
- `approvals`: scoped decisions by Titan, the main agent or the person.
- `persona-lifecycle`: role measures, states, updates, retirement and approved deletion.
- `titan-server`: local HTTP API, durable events, tokens and agent-tool access.
- `self-training-orchestration`: experimental policies, rewards and explainable choices.
- `runpod-backends`: approved remote model calls and worker jobs with deadlines.
- `test-strategy`: fakes, contracts, isolated tests and complete scenario coverage.
- `run-dashboard`: local read-only run pages, live updates and trace-viewer guidance.
- `verified-checks`: locked claims, Lean, numerical and script checks, and rechecking.
- `dev-standards`: build gates, release evidence, versions and recorded decisions.
- `configuration`: shared setting definitions, files, overrides, schemas and frozen run settings.
- `cli-control`: identifiers, arguments, lifecycle, machine output and artifact delivery.
- `distribution`: installable packages, environments, first use and checked deliverable examples.

### Modified Capabilities

None. There are no published base specs yet.

## Impact

- Add Bun workspaces in `apps/*` and `packages/*`, using `bun:sqlite` and `bun test`.
- Add vendor adapters, MCP libraries, schema validation, local embeddings, SQLite search and OpenTelemetry tracing. Dependency evidence and alternatives are in `design.md`.
- Optional proof checks need external Lean or Z3 programs. Lean support starts on Linux and needs an isolation test on an ordinary host.
- Write run records under the project and shared state under `TITAN_HOME`, defaulting to `~/.titan`.
- Listen on 127.0.0.1 only. Dashboard login uses a one-time code; its cookie cannot authorize product changes.
- Require user-provided credentials for paid services. Model calls, agent sessions and RunPod can cost money.
- Named plug-ins execute with the user's rights. Approval, cancellation and test-isolation evidence must match the claimed platform and backend.
- This checkout contains an experimental local runtime, CLI, transports and Codex and Claude Code adapters. Product delivery remains incomplete. Current evidence is recorded in `research/implementation-state.md`; delivery requirements and remaining tasks are in `design.md` and `tasks.md`.
