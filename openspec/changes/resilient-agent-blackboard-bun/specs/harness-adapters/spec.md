## ADDED Requirements

### Requirement: Codex developer instructions belong to each session

The default Codex adapter MUST bind the invocation's role to config.developer_instructions in its session client. Starts and resumes MUST retain that role without changing another session's configuration. Quotes and newlines MUST remain literal string content. The existing isolation options MUST remain active. A caller-supplied client owns its configuration; the role MUST still appear in the prompt. Argument mapping through the pinned SDK does not establish live vendor compliance or complete persona tool enforcement.

#### Scenario: New and resumed Codex roles reach native configuration

- **WHEN** independent new and resumed sessions have different roles
- **THEN** each native invocation receives its exact developer instructions and the existing isolation arguments

#### Scenario: Codex role characters cannot become configuration

- **WHEN** a role includes quotes, backslashes, newlines and text resembling another setting
- **THEN** those characters remain inside its single developer-instruction string

#### Scenario: Codex peer cancellation retains its own role

- **WHEN** one of two sessions is cancelled
- **THEN** the other completes with its own role and native session, and both owned transports stop

#### Scenario: Reversed Codex roles retain their bindings

- **WHEN** the role order is reversed for completion and cancellation cases
- **THEN** neither client receives the other role's developer instructions

### Requirement: One interface for every agent tool

Every adapter SHALL fill the same port, `AgentBackend`, from the package `@titan/core`. An adapter is the package that connects `titan` to one vendor's SDK or API. The port MUST have a `specificationVersion`, an `id`, `capabilities`, `start(spec)` and `resume(sessionId, spec)`. The spec MUST hold the role text, model, tools, skills, tool servers, working folder and an optional JSON schema. A session MUST have `send(prompt)`, which returns the agent's final text, the parsed JSON when a schema was given, the session id and the usage numbers that the SDK reports. No package except the adapter itself SHALL import a vendor's SDK. Sessions MUST expose ordered typed events for messages, tool intents, tool results, usage and classified execution errors. Events MUST identify their session, execution and sequence. A checkpoint operation MUST stop at a consistent boundary and return its resumable state reference. An adapter MUST NOT claim checkpoint support from final-answer events alone. The runner MUST own durable manifest publication before acknowledging a checkpoint. Unsupported hooks or restoration guarantees MUST appear in capability evidence before admission.

#### Scenario: Same call, any adapter

- **WHEN** the fake adapter, the Claude adapter, the Codex adapter, the Antigravity adapter and the model API adapter each get the persona "You answer with one word", the task "Say yes" and the schema `{answer: string}`
- **THEN** each returns an object with the fields `text`, `json`, `sessionId` and `usage`
- **AND** `json.answer` is a string

#### Scenario: Adapter for another version of the port

- **WHEN** an adapter has `specificationVersion: "titan-backend-v0"` and `titan` has `titan-backend-v1`
- **THEN** `titan` does not use it
- **AND** `titan backends` shows it as `not ready` with both versions

### Requirement: Each adapter states what it can do

Each adapter SHALL set the capability flags `systemPrompt`, `builtinTools`, `skills`, `toolServers`, `resume` and `structuredOutput` to true or false. `titan check` MUST use these flags to decide whether a persona's fields can be applied. The bundled hub server MUST be added to the effective tool list before these checks. A backend without tool-server support MUST be not ready for this product.

#### Scenario: Codex adapter flags

- **WHEN** `titan backends --json` runs
- **THEN** `codex-sdk` has `skills: false` and `toolServers: true`

### Requirement: Sessions can be cancelled and closed

Each session SHALL provide `cancel(reason)` and `close()`. Cancellation MUST stop local calls and child processes owned by that session. `close()` MUST release its tool clients, streams and process resources, and MUST be safe to call twice. The runner MUST call these methods on timeout or run cancellation. A remote cancellation without acknowledgement MUST return an unknown remote state, as in spec runpod-backends. A backend without cancellation MUST NOT be ready for a run with a time limit.

#### Scenario: Cancel a running fake session

- **WHEN** a run times out while a fake session and its tool server are active
- **THEN** `cancel` receives the timeout reason and `close` releases both resources
- **AND** calling `close` again starts no work and raises no error

### Requirement: Every agent starts with a fresh context

Each adapter MUST start a new SDK session for each agent. An agent SHALL NOT see the messages of another agent, except for the text that `titan` puts in its task.

#### Scenario: Falsifier does not see the worker's session

- **WHEN** a step's worker agent and its falsifier agent both run through the Claude adapter
- **THEN** the run record shows two different SDK session ids for them

### Requirement: A persona's tools and skills reach its agent

Each adapter MUST give the agent exactly the tools, skills and tool servers that the persona lists, and its model when one is set. When an adapter cannot apply a field that the persona sets, `titan check` MUST fail and name the persona and the field. An adapter MUST NOT drop a field without saying so.

#### Scenario: Claude persona with two tools

- **WHEN** a persona has `tools: [Read, Grep]` and `skills: [plain-language-specs]` and runs through the Claude adapter
- **THEN** the adapter passes `tools: ["Read","Grep"]` and `skills: ["plain-language-specs"]` to `query()`
- **AND** the run record shows both lists for that agent

#### Scenario: Claude invocation keeps an exact tool list

- **WHEN** a Claude invocation lists no tools or a supported subset of Read, Glob, Grep, Write, Edit and Bash
- **THEN** the SDK receives exactly that list, including an empty list
- **AND** both mandatory tool checks deny every unlisted tool
- **AND** changing the caller's list after session creation cannot grant another tool

#### Scenario: Claude invocation refuses an unsupported permission

- **WHEN** a Claude invocation requests an unknown native tool, or Write, Edit or Bash in a read-only phase
- **THEN** the adapter refuses the session before starting the SDK query
- **AND** the failure is operational and names the unsupported permission policy

#### Scenario: Claude builder runs shell commands

- **WHEN** a writable Claude persona lists Bash and asks to run a command that names no protected folder and none of the blocked programs
- **THEN** both mandatory tool checks allow the command
- **AND** the command runs in the working folder of the run
- **AND** the run record shows Bash in the tools of that agent

#### Scenario: Shell command that reaches a protected place is denied

- **WHEN** a Bash command names a protected folder, a blocked program, a parent folder, or an absolute path outside the working folder
- **THEN** both mandatory tool checks deny the command before it runs
- **AND** the agent receives the workspace policy as the reason

#### Scenario: A denied request does not stop the turn

- **WHEN** a Claude agent asks for a tool request that the workspace policy denies and then finishes its turn
- **THEN** the agent receives the denial as the answer to that request and the turn completes
- **AND** the denial stays in the durable events of the run
- **AND** a turn that ends with an error still fails

#### Scenario: Claude permissions are checked before workflow execution

- **WHEN** an action selects Claude and requests Bash in a read-only phase, or a checker requests Write, Edit or Bash
- **THEN** CLI validation, explicit-backend MCP validation and engine preflight reject the request
- **AND** HTTP submission rejects it before recording or starting the run
- **AND** the diagnostic names the persona, tools field and unsupported tools

#### Scenario: Effective backend governs Claude tool admission

- **WHEN** a workflow is checked with a resolved backend fallback
- **THEN** an explicit persona backend takes precedence over that fallback
- **AND** the resolved fallback takes precedence over the workflow default
- **AND** the workflow default is used when no resolved fallback is supplied

#### Scenario: CLI binds settings and plan to one workflow document

- **WHEN** CLI check or dry run loads a workflow and its settings
- **THEN** both come from the same document read
- **AND** a later document cannot hide an invalid workflow or unsupported tool request

#### Scenario: MCP check resolves the selected configuration context

- **WHEN** MCP check receives a workflow, project and optional backend fallback
- **THEN** it resolves home, project, workflow and explicit backend settings before checking permissions and limits
- **AND** project settings cannot change home-owner settings
- **AND** its resolved group depth and step count limits apply before a success response

#### Scenario: Field an agent tool cannot apply

- **WHEN** the workflow runs in an agent tool whose adapter cannot set `skills`, and a persona sets `skills`
- **THEN** `titan check` fails with the persona name and the text `skills cannot be set in this agent tool`

#### Scenario: Claude uses tool-specific paths and safe relative patterns

- **WHEN** Read, Write, Edit, Glob or Grep requests workspace access
- **THEN** both permission callbacks use that tool's declared path field, reject malformed inputs and escaping glob patterns, and refuse outside symlink parents
- **AND** a conflicting unrelated path field cannot conceal the effective search path

#### Scenario: Claude refuses linked and normalized escape paths

- **WHEN** a native file tool names a linked invocation root, an inside or outside symlink, a dangling link, or a path with a parent component
- **THEN** both callbacks refuse the request before the tool acts
- **AND** normalization cannot hide a symlink followed by a parent component

#### Scenario: Claude distinguishes a new file from invalid filesystem evidence

- **WHEN** a native file tool names a new file beneath ordinary directories
- **THEN** the path policy allows the request if its other permissions pass
- **AND** a file used as a directory is refused, while unexpected filesystem errors remain operational failures

#### Scenario: Claude cannot directly target reserved workspace files

- **WHEN** a supported file tool names runtime metadata, Git metadata, harness state, dependencies or environment credentials at any path depth
- **THEN** both mandatory permission callbacks deny the request before the file tool runs
- **AND** ordinary hidden code configuration and similarly named noncredential files remain available

#### Scenario: Snapshot and artifact paths share reserved-name validation

- **WHEN** a snapshot encounters reserved workspace entries or an artifact manifest names one
- **THEN** the snapshot omits them and artifact admission rejects them using the same central component schema
- **AND** null bytes, empty components and traversal cannot enter an artifact path

### Requirement: An agent's session can continue

Each released adapter SHALL support session continuation with a new message. It MUST advertise `resume: true` only after its continuation contract passes. `titan` uses this to give an agent the answer to its request.

#### Scenario: Answer reaches the same session

- **WHEN** an agent asks another persona a question and gets the answer
- **THEN** the run record shows the same session id or thread id before and after the answer

#### Scenario: A native resume cannot silently replace the agent

- **WHEN** Codex or Claude emits a different native identifier after the invocation has learned or resumed its original identifier
- **THEN** the adapter blocks with session_unavailable before publishing the replacement event or accepting its result
- **AND** a later retry uses the original identifier; completed work, the checkpoint, the quality attempt and refutation count remain unchanged

### Requirement: Claude adapter uses the Claude Agent SDK

The Claude adapter SHALL start each agent with `query()` from the npm package `@anthropic-ai/claude-agent-sdk`. It MUST pass the role text as `systemPrompt`, the tools as `tools`, the skills as `skills` and the tool servers as `mcpServers`. It MUST pass the model as `model`, the working folder as `cwd`, and the schema as `outputFormat`. It MUST continue a session with the `resume` option.

#### Scenario: Live Claude agent

- **WHEN** the live test runs with `TITAN_LIVE_CLAUDE=1` inside Claude Code
- **THEN** one agent answers the task "Say yes" with JSON that matches the schema
- **AND** the run record holds the SDK's session id and usage

### Requirement: Codex adapter uses the Codex SDK

The Codex adapter SHALL start each agent with `startThread()` and `run()` from the npm package `@openai/codex-sdk`. It MUST pass the working folder as `workingDirectory` and the schema as `outputSchema`. It MUST set `skipGitRepoCheck: true` only when the workflow file sets `skip_git_check: true`. It MUST pass the tool servers in the `config` option as `mcp_servers`. It MUST put the role text at the start of the first prompt, until a task shows a Codex option for role text.

#### Scenario: Codex persona with a tool server

- **WHEN** a persona on `codex-sdk` has `tool_servers: [{ name: orders-db, command: bun, args: [tools/orders-db-server.ts] }]`
- **THEN** the adapter passes `config.mcp_servers.orders-db` with that command and those arguments to `new Codex()`
- **AND** it also passes `config.mcp_servers.titan` for `titan`'s own tool server

#### Scenario: Live Codex agent

- **WHEN** the live test runs with `TITAN_LIVE_CODEX=1` inside Codex
- **THEN** one agent answers the task "Say yes" with JSON that matches the schema
- **AND** the run record holds the thread id and usage

#### Scenario: Folder is not a Git repository

- **WHEN** a step's working folder is not a Git repository and the workflow file does not set `skip_git_check: true`
- **THEN** the step fails with a message that names the folder and the `skip_git_check` field

### Requirement: Antigravity adapter uses the Antigravity SDK through a Python helper

The Antigravity adapter SHALL start a Python helper script that ships with `titan`. The helper MUST use `Agent` and `LocalAgentConfig` from the Python package `google-antigravity`. It MUST pass the role text as `system_instructions` and the tool servers as `mcp_servers` with `McpStdioServer`. The adapter and the helper MUST exchange one JSON object per line on standard input and standard output.

#### Scenario: Live Antigravity agent

- **WHEN** the live test runs with `TITAN_LIVE_ANTIGRAVITY=1` inside Antigravity
- **THEN** one agent answers the task "Say yes" with JSON that matches the schema

#### Scenario: Python package missing

- **WHEN** the Antigravity adapter starts and Python cannot import `google.antigravity`
- **THEN** `titan` stops before the first step with the message that names `pip install google-antigravity`

### Requirement: Answers that break the schema are not used

An adapter MUST check the agent's JSON against the schema. When it does not match, the adapter SHALL ask the same agent once more and add the schema error to the request. When the second answer does not match either, the call MUST fail with the schema error.

#### Scenario: Agent answers with the wrong shape twice

- **WHEN** the fake adapter is scripted to answer `{"verdict":"maybe"}` twice to a falsifier schema that allows only `refuted` or `survived`
- **THEN** the call fails
- **AND** the run record holds both answers and the schema error

### Requirement: The fake adapter makes tests repeatable

The fake adapter SHALL return answers from a script file, matched by persona and task. It MUST NOT start a real agent or use the network.

#### Scenario: Scripted answers

- **WHEN** a test runs `titan run examples/code-fix.yaml --harness fake --fake-script tests/code-fix.answers.yaml` twice
- **THEN** both run records have the same steps, verdicts and result

### Requirement: SDK bindings are verified against pinned primary sources

Before an adapter is ready, its implementation SHALL record its pinned SDK version, primary documentation and live contract evidence. Option names in this specification describe the researched binding, not proof of current compatibility. If a binding differs, the adapter MUST record the corrected mapping in the design before release and pass the same behavior contract. Unsupported tools, skills or permissions MUST NOT be silently dropped.

#### Scenario: Researched SDK option is unavailable

- **WHEN** the pinned SDK does not accept a researched option for a persona capability
- **THEN** the backend stays not ready for that capability until a documented binding passes its contract

### Requirement: Sessions remain independent across runs

An adapter SHALL keep session handles, callbacks, tool capabilities and cancellation scoped to their full execution identity. It MUST support overlapping sessions from multiple runs, including runs using the same backend and persona. It MUST NOT use one mutable current-session field. The port MUST declare `maxConcurrentSessions` as a positive integer or null for no declared backend cap. A finite cap MUST apply across all runs using that backend instance. Backend-capacity waits MUST queue only that backend's sessions. Unrelated ready backends MUST continue.

#### Scenario: Same adapter runs two conversations

- **WHEN** two runs use the same persona and fake adapter concurrently and return different markers
- **THEN** each result and continuation receives only its own marker

#### Scenario: Cancel one of two adapter sessions

- **WHEN** run A is cancelled while run B uses the same adapter
- **THEN** A stops and B continues without losing its session or tools

#### Scenario: One backend is saturated

- **WHEN** A fills backend X's declared cap while B has ready work on backend Y
- **THEN** B starts on Y and no extra session starts on X

### Requirement: Session restoration capabilities are explicit and tested

Each adapter SHALL declare native resume, transcript export, file restoration and reconstruction capabilities with tested version evidence. A resumed session MUST retain its pinned model provider, persona, permissions, tools and logical working snapshot. Native restoration MUST preserve a backend-required absolute working path. Reusing that path MUST require confirmed termination of every earlier writer; otherwise recovery MUST block. Reconstruction MUST create a new session from saved messages, tool outcomes, files and pending work. It MUST be labeled `reconstructed`, with its source checkpoint and lost context disclosed. The default `native_only` recovery mode MUST block when native restoration is unavailable. `allow_reconstruction` MUST require explicit workflow or person authorization before use. For a stateless model API, a fully serialized adapter-owned conversation MAY provide exact continuation when its contract proves all required state is saved. Missing opaque vendor state MUST NOT be described as exact continuation. A backend switch MUST require a recorded approval and compatible capabilities. Neither reconstruction nor a backend switch MUST replay uncertain external effects.

#### Scenario: Native session has disappeared

- **WHEN** a vendor cannot find a session and recovery mode is native_only
- **THEN** the run blocks with session_unavailable and instructions to authorize reconstruction

#### Scenario: Authorized reconstructed agent

- **WHEN** a person enables reconstruction for a saved checkpoint with reconciled actions
- **THEN** a new session receives the saved context and files; history retains its old identity and reconstruction label

#### Scenario: Old writer still owns required path

- **WHEN** native restoration needs the original absolute working path and its earlier process has not confirmed termination
- **THEN** recovery blocks without restoring over that writer or starting a replacement in the same folder

### Requirement: Default Codex turns disable inherited integrations

The default Codex SDK client SHALL explicitly disable apps, plugins, the remote plugin catalog and native lifecycle hooks on each start and resume. Tests MUST use the production client constructor with only the executable substituted and require all four native configuration arguments. Injected custom clients retain responsibility for their own configuration. These overrides MUST NOT be described as disabling inherited MCP servers or proving complete persona tool enforcement.

#### Scenario: Started Codex turn disables integrations

- **WHEN** the default adapter starts a turn through the pinned SDK
- **THEN** its native arguments disable all four integration features and the strict executable fixture can complete

#### Scenario: Resumed Codex turn keeps integrations disabled

- **WHEN** the default adapter resumes a retained native session through the pinned SDK
- **THEN** the same four disabled settings accompany the resume without replacing the session

#### Scenario: Enabled integration fails the transport contract

- **WHEN** any one of the four disabled settings is replaced with true
- **THEN** the strict executable fixture refuses the invocation and successful transport assertions fail

### Requirement: Default Codex turns skip inherited user configuration

Default Codex clients SHALL pass --ignore-user-config on start and resume through a pinned SDK launch option. Titan MUST retain CODEX_HOME for native authentication and sessions and supply its invocation policy explicitly. Native home and project config.toml preferences SHALL be skipped. A separate offline native probe SHALL use only synthetic credentials and a loopback refusal, checking home and trusted-project MCP startup markers and file-based authentication. These checks do not establish complete persona tool enforcement or OS credential-store behavior.

Preview bundles SHALL embed the patched SDK and declare the exact native CLI dependency from that SDK's prepared manifest. Manifest reads MUST be bounded and asynchronous. Missing, malformed or ranged native dependencies MUST fail before archive publication. A fresh installation MUST retain the launch flag in its strict executable contracts. Injected custom clients remain responsible for their configuration.

#### Scenario: Native user configuration is skipped without losing synthetic authentication

- **WHEN** the native offline control supplies home and trusted-project MCP commands with a synthetic home credential
- **THEN** both commands start without the isolation flag and neither starts with it
- **AND** both controls authenticate to the loopback refusal without using a vendor service

#### Scenario: Fresh and resumed installed turns retain isolation

- **WHEN** default-client turns start and resume through the pinned SDK in the checkout and a fresh archive installation
- **THEN** strict executable fixtures require --ignore-user-config with the existing explicit invocation policy
- **AND** omitting the flag fails those contracts

#### Scenario: Native distribution versions come from the pinned SDK

- **WHEN** packaging reads a valid SDK manifest with an exact native version
- **THEN** it declares that exact version, including a pinned prerelease
- **AND** missing, malformed or ranged native dependencies fail before archive publication

### Requirement: Structured Claude retries use the frozen recovery allowance

The pinned Claude adapter SHALL validate system/api_retry fields before classification. A rate_limit cause with HTTP 429 and overloaded or server_error causes with a server-error status SHALL use Titan operational recovery. The adapter MUST retain the native retry delay, refuse negative, fractional, nonnumeric or greater-than-2,147,483,647-millisecond delays and preserve the raw event. Titan MUST enforce the frozen recovery allowance rather than accepting the SDK retry count as new capacity. Continuation MUST retain the same phase, native session, working files and logical quality attempt without a refutation. Completed peers MUST remain complete. Missing final usage MUST remain explicitly unreported. Unknown causes, billing failures and contradictory statuses MUST block without automatic retry. Ordinary rate_limit_event notices MUST NOT replace a successful final result. These rules do not classify Codex errors from message text or establish live vendor transcript recovery.

#### Scenario: Rate-limited worker continues the final quality attempt

- **WHEN** a worker receives a structured rate-limit retry with one allowed continuation on its only quality attempt
- **THEN** the same native session completes with two physical executions and no extra quality attempt or refutation

#### Scenario: Service retry preserves a completed worker

- **WHEN** a checker receives a validated service retry through the SDK and agent host
- **THEN** only its native session continues and the delivered candidate and completed worker remain intact

#### Scenario: Daemon death cannot refill native retries

- **WHEN** a repeated rate limit exhausts its allowance or the allowance is zero and the daemon is killed and restarted
- **THEN** explicit resume remains blocked without another native invocation or a new quality attempt

#### Scenario: Unclassified or invalid retries stay blocked

- **WHEN** a native retry has an unknown cause, billing error, contradictory status or invalid delay
- **THEN** no automatic continuation starts and malformed fields are a protocol failure

#### Scenario: Usage notices retain successful results

- **WHEN** a native turn emits a usage warning or limit notice and then a valid successful result
- **THEN** the result completes without a retry or substituted failure

### Requirement: Managed HTTP readiness waits for daemon acknowledgment

Managed native hosts SHALL request HTTP readiness over the bounded host protocol. The daemon MUST check the original execution-scoped connection before acknowledging that request. The host MUST wait for acknowledgment before SDK work. A second readiness request, missing HTTP binding or early event or answer MUST fail. Refusal MUST retain operational recovery metadata and reap the managed process. Cancellation MUST stop the host and settle the readiness check. Standalone adapters MUST retain their HTTP readiness check. Stdio transport keeps its existing startup contract.

#### Scenario: Managed SDK work follows scoped readiness

- **WHEN** a managed Codex or Claude turn requests HTTP native tools
- **THEN** the daemon checks its original execution binding and acknowledges readiness before SDK work starts

#### Scenario: Refused readiness preserves operational recovery

- **WHEN** readiness fails, is rate limited or is cancelled
- **THEN** the managed process is reaped and operational classification and retry timing are preserved

#### Scenario: Unrequested or repeated readiness is refused

- **WHEN** a managed host requests readiness without its HTTP binding or repeats a completed readiness request
- **THEN** the turn fails with a protocol error before accepting an answer

#### Scenario: HTTP output cannot overtake readiness

- **WHEN** a managed HTTP host emits an event or answer before readiness or while its readiness check is pending
- **THEN** the turn fails with a protocol error and no early event is committed

#### Scenario: Standalone adapters retain HTTP readiness

- **WHEN** a standalone Codex or Claude adapter uses an HTTP native binding
- **THEN** it performs the existing scoped readiness check and refuses a substituted execution before vendor work
