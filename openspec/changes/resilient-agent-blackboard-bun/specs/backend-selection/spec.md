## ADDED Requirements

### Requirement: Six backends

`titan` SHALL run agents on six built-in backends: `claude-sdk`, `codex-sdk`, `antigravity-sdk`, `anthropic-api`, `openai-api` and `gemini-api`, and on the backends that plug-ins add, as in spec backend-plugins. The RunPod backends come as such a plug-in, as in spec runpod-backends. The three SDK backends MUST use the adapters in spec harness-adapters. The three model API backends MUST share one adapter that uses the Vercel AI SDK (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai` and `@ai-sdk/google`). That adapter MUST call the model API with the persona's role text, the output schema and the tools of the agent's tool servers.

#### Scenario: Same step on a model API

- **WHEN** a persona has `backend: gemini-api` and the Gemini key variable is set
- **THEN** the run record shows that agent with `"backend":"gemini-api"`
- **AND** its answer is checked against the same output schema as any other agent

### Requirement: Each persona can have its own backend

`titan` SHALL pick the backend for each persona in this order, the first that is set wins:

1. the flag `--backend <persona>=<backend>`;
2. the persona's `backend` field;
3. the file's `defaults.backend` field;
4. the flag `--backend-default <backend>`;
5. project configuration defaults;
6. user configuration defaults;
7. the SDK of the detected agent tool.

`--backend-default` MUST remain a fallback below persona and workflow selections. It MUST NOT be presented as the general explicit override; `--backend` supplies that override.

#### Scenario: Mixed backends in one run

- **WHEN** a file has `defaults.backend: codex-sdk` and the persona `judge` has `backend: anthropic-api`
- **AND** `titan run` runs inside Claude Code
- **THEN** `judge` runs on `anthropic-api` and every other persona runs on `codex-sdk`

#### Scenario: Flag overrides the file

- **WHEN** the persona `judge` has `backend: anthropic-api`
- **AND** `titan run file.yaml --backend judge=claude-sdk` runs
- **THEN** `judge` runs on `claude-sdk`
- **AND** the run record says the backend came from the flag

### Requirement: List the backends that are ready

`titan backends` SHALL print each of the six built-in backends and each plug-in backend with `ready` or `not ready`. Readiness MUST require installed dependencies, authentication, verified capabilities and release evidence for the platform. An experimental backend MUST be `not ready` by default. An explicit experimental opt-in MAY allow a limited run. It MUST NOT waive required permission, cancellation or capability checks. Reasons MUST distinguish missing setup from missing evidence.

#### Scenario: Only the Claude SDK and one key

- **WHEN** only the Claude SDK is installed, only the Anthropic key is set, and release evidence verifies those backends on this platform
- **THEN** `claude-sdk` and `anthropic-api` are `ready`
- **AND** each of the other four is `not ready`, with its reason

#### Scenario: Run with a backend that is not ready

- **WHEN** a persona has `backend: openai-api` and no OpenAI key is set
- **THEN** `titan run` exits with code 2 before it starts any agent, and names the persona and the missing variable

### Requirement: API keys are never stored

`titan` SHALL read API keys only from allowlisted environment variables or their ephemeral per-run bindings from an authenticated submitting client. The variable names MUST be the ones recorded in the repository by the task that checks each vendor's package. `titan` MUST NOT write a key to any file, the board or the run record.

#### Scenario: Key not in the record

- **WHEN** a run uses `anthropic-api` with the Anthropic key variable set
- **THEN** no file in the run record or in `~/.titan` contains the key's value

### Requirement: A persona on a model API gets tool servers only

A persona on a model API backend SHALL get only the tools of tool servers. These are `titan`'s own tool server and the tool servers that the persona lists, as in spec tool-servers. `titan check` MUST fail when such a persona lists a built-in file or shell tool.

#### Scenario: Model API persona uses the hub

- **WHEN** a persona on `anthropic-api` calls the tool `kb_search` in its turn
- **THEN** the run record shows the tool call and its result for that agent

#### Scenario: Model API persona with Bash

- **WHEN** a persona has `backend: openai-api` and `tools: [Bash]`
- **THEN** `titan check` fails with the text `backend "openai-api" has no tool "Bash"`

### Requirement: Other programs can control titan

Every ordinary `titan` command SHALL take `--json` and then print one JSON object after it finishes or pauses. For run commands, the object MUST include an ordered `events` array and the state. Diagnostic logs MUST go to standard error. `mcp`, `tool-server` and `worker` MUST keep their protocol streams and reject `--json` with exit code 2. `serve --json` MUST print one readiness object and keep serving until stopped. Programs MAY also use the HTTP API of the `titan` server, as in spec titan-server. The exit codes MUST follow spec cli-control: 0 for success or detached acceptance, 1 for terminal negative outcomes, 2 for wrong input and 3 for nonterminal waits. Transport and authentication errors MUST use 4; observer Ctrl-C MUST use 130. Neither MUST change the run status. The package `@titan/runner` MUST export `runWorkflow()`, `resumeRun()` and `answerRequest()`, which do the same as `titan run`, `titan resume` and `titan answer`, and give the run's events as an async iterator.

#### Scenario: JSON run output has one object

- **WHEN** a workflow finishes with `titan run example.yaml --json`
- **THEN** standard output parses as one object with its state and ordered `events` array
- **AND** progress logs appear only on standard error

#### Scenario: A program runs a workflow

- **WHEN** a TypeScript program calls `runWorkflow("example.yaml", { backend: { judge: "anthropic-api" } })` with the fake adapter
- **THEN** it gets the same events, in the same order, as the `events` array from `titan run example.yaml --backend judge=anthropic-api --json`
- **AND** the run record is the same apart from ids and times

#### Scenario: A program uses the HTTP API

- **WHEN** a program starts a run with `POST /runs` and reads `GET /runs/<run id>/events` until the run ends
- **THEN** it gets the same events, in the same order, as all event pages referenced by `titan run --json` for the same file

### Requirement: A task that holds a key is never sent

Before `titan` sends any task text to an agent, it SHALL check the text for key values. A key value is a current environment or ephemeral binding value whose variable name matches the key rule of spec test-strategy. When the text holds such a value, `titan` MUST NOT start the agent. It MUST mark the step `failed` with the text `task holds the value of <variable name>`. `titan` MUST NOT print, log or store the value. This check MUST finish before the agent starts. In the test in `research/swarm.md`, a check that ran at the same time as the agent let the model answer once before it stopped.

#### Scenario: Key value in a task

- **WHEN** `TITAN_TEST_API_KEY` is set to a made-up value, and a step's task text holds that value
- **THEN** the step is `failed` with the text `task holds the value of TITAN_TEST_API_KEY`
- **AND** the fake backend got 0 calls
- **AND** no file in the run record contains the value

### Requirement: Secrets are checked before records are persisted

Before saving a workflow, task, answer, tool result or trace, `titan` SHALL check key values from environment variables and ephemeral bindings. Variable names MUST follow spec test-strategy. A matching input MUST fail before its text is copied to disk or sent to an agent. A matching backend answer MUST be discarded and logged only by variable name. The saved workflow MUST preserve the accepted source bytes; a rejected secret-bearing workflow MUST NOT get an unsafe copy.

#### Scenario: Key in the workflow source

- **WHEN** the workflow text holds the value of `TITAN_TEST_API_KEY`
- **THEN** the command fails before writing `workflow.yaml` and no backend receives the workflow

#### Scenario: Backend answer echoes a key

- **WHEN** a backend answer contains a set key value
- **THEN** the answer is discarded and the record names only the variable

### Requirement: Run and request lists support explicit origin filters

`titan requests` and `GET /requests` SHALL support `run_id`, `client_id`, `harness_session_id` and `project_path` filters. `GET /runs` MUST support those filters plus harness and state. Filters MUST combine by intersection and responses MUST retain full run and origin ids. The CLI MUST expose these request filters as `--run-id`, `--client-id`, `--harness-session-id` and `--project-path`. The read-only dashboard run API MUST support the same run filters. An unfiltered list MUST remain available across all clients. Origin filtering MUST be a navigation feature, not a security boundary. No mutating command MUST infer a target from the most recent run.

#### Scenario: Requests filtered to one harness session

- **WHEN** two sessions each have two runs waiting and one queries its session filter
- **THEN** the response lists exactly its two runs with explicit run and request ids

#### Scenario: Unfiltered list spans harnesses

- **WHEN** Claude and Codex each have a running workflow
- **THEN** the unfiltered run list includes both with their respective origins

### Requirement: Claude MCP configuration is explicit

The Claude adapter SHALL pass strictMcpConfig: true, an explicit empty mcpServers map and empty settingSources until persona MCP servers are implemented. It MUST NOT implicitly grant an inherited MCP tool through either permission callback. Pinned SDK process fixtures MUST require --strict-mcp-config on start and resume. These local contracts do not establish live vendor inheritance behavior or operating-system isolation.

#### Scenario: Claude SDK receives explicit MCP configuration

- **WHEN** a read-only or writable persona opens a Claude turn
- **THEN** its SDK options contain strict MCP selection and no inherited server map or settings sources
- **AND** the pinned SDK sends --strict-mcp-config to its executable on start and resume

#### Scenario: Inherited Claude MCP tools remain denied

- **WHEN** an inherited MCP read or write name is offered to the persona callbacks
- **THEN** both callbacks refuse it without adding it to the declared tool list
