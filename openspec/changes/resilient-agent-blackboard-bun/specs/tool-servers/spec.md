## ADDED Requirements

### Requirement: Every agent gets titan's own tool server

`titan` SHALL start its own tool server, `titan tool-server`, for every agent on every backend. Remote workers MUST start the bundled server in their container against a snapshot, as in spec runpod-backends. A tool server is a program that offers tools over the Model Context Protocol (MCP) through standard input and output. `titan`'s tool server MUST offer the tools `kb_search`, `kb_get`, `kb_add`, `kb_update` and `kb_delete`. `titan` MUST pass the run folder, step id, candidate id and attempt id to it in environment variables.

#### Scenario: Agent searches the hub during its turn

- **WHEN** the fake adapter's `investigator` calls the tool `kb_search` with `{"question":"time zones"}` in its first turn
- **THEN** the tool result holds the lesson "Check time zones first when tests fail at midnight"
- **AND** the agent's answer in the same turn can use it

#### Scenario: Tool server knows the step

- **WHEN** an agent in step `cause` calls `kb_add`
- **THEN** the new entry is marked `pending` with the step `cause`

### Requirement: A persona can list more tool servers

A persona SHALL be able to list tool servers in its `tool_servers` field. Each tool server MUST have a `name` and a `command`, and MAY have `args` and `env`. The adapter MUST pass each one to the agent's SDK, next to `titan`'s own tool server. `titan check` MUST fail when two tool servers of one persona have the same name, or when one is named `titan`. Environment entries MUST name references to environment variables, not hold credential values. Logs MUST record variable names only.

#### Scenario: Same tool server on two backends

- **WHEN** the persona `fixer` lists the tool server `orders-db`, and runs once on `claude-sdk` and once on `openai-api`
- **THEN** both agents can call the tools of `orders-db`
- **AND** the run record lists `orders-db` and `titan` as the tool servers of both agents

#### Scenario: Name already used

- **WHEN** a persona lists a tool server named `titan`
- **THEN** `titan check` fails with the text `tool server name "titan" is used by titan`

### Requirement: Calls to titan's tool server are logged on the board

`titan` SHALL write one line on the board for each call to its own tool server, with the persona, the tool name and the entry ids it returned or changed. `titan` MUST NOT write the full tool result to the board.

#### Scenario: Search logged

- **WHEN** `investigator` calls `kb_search` and gets two entries
- **THEN** `board.jsonl` has a line with `"from":"investigator"`, `"kind":"tool"`, `"tool":"kb_search"` and the two entry ids

### Requirement: A tool server that does not start stops the step

When a tool server of a persona does not start, `titan` SHALL fail that agent's step before the agent gets its task. The error MUST name the persona, the tool server and its command.

#### Scenario: Command not found

- **WHEN** a persona lists a tool server named `orders-db` with `command: no-such-program`
- **THEN** the step fails with the persona name, `orders-db` and `no-such-program` in the error
- **AND** no agent starts for that step

### Requirement: Tool authority comes from the session scope

The bundled hub server SHALL use a session capability bound to run, role, step, part, candidate and attempt. The host MUST validate that binding instead of trusting supplied ids. Worker writes MUST stay in that attempt's pending set. Falsifiers, judges and helpers MUST have read-only hub access. Improver writes MUST return as proposed changes for its supervised evaluation. A session capability MUST NOT authorize main-agent answers, another candidate's pending entries or another run.

#### Scenario: Candidate forges another attempt id

- **WHEN** candidate A calls a hub tool with candidate B's attempt id
- **THEN** the host refuses the call and B's pending entries stay unchanged

#### Scenario: Judge tries to change the hub

- **WHEN** a judge calls `kb_update`
- **THEN** the tool refuses the write and no pending or final entry changes

### Requirement: Main-agent tools keep multiple run handles

The MCP client SHALL expose submission ids and origin filters consistently with HTTP. Run-specific tools MUST take an explicit run id. One connection MUST allow multiple outstanding submissions and subscriptions. Starting a second workflow MUST NOT replace the first handle, cursor or pending request set. Worker tool capabilities MUST remain bound to their own execution.

#### Scenario: One connection manages three runs

- **WHEN** one MCP connection starts A, B and C, watches each and cancels B
- **THEN** A and C continue, B alone is cancelled, and all tool responses identify their run

### Requirement: The local owner bounds and revokes native tool authority

The local owner SHALL keep a bounded registry of opaque native credentials. A registration MUST bind a host-validated execution and its private knowledge scope. Request arguments MUST NOT replace that scope. Worker registrations SHALL offer private knowledge operations. Checker registrations SHALL offer only committed knowledge reads. Neither role may receive operator publication or human decision tools. Closing a registration SHALL refuse new work, drain admitted calls and refuse queued calls that have not begun. Each queued request MUST recheck whether its execution remains current. Unexpected internal failures MUST return a bounded generic error without filesystem paths or private exception text. This owner contract does not replace the bundled stdio bridge, native SDK startup checks or board audit requirements.

#### Scenario: A worker tries to replace its bound scope

- **WHEN** a worker sends another run id with a knowledge operation
- **THEN** the tool refuses the unexpected field
- **AND** the other run's private entries stay unreadable and unchanged

#### Scenario: A checker reaches a missing final file

- **WHEN** a committed entry is indexed but its file cannot be read
- **THEN** the checker receives an error result without the internal filesystem path
- **AND** its tool inventory still excludes worker writes and human decisions

#### Scenario: Revocation drains one admitted call

- **WHEN** an admitted knowledge call waits behind a final publication and the host closes its registration
- **THEN** new calls are refused immediately
- **AND** closing waits for the admitted call to settle before releasing registry capacity

#### Scenario: Queued authority becomes obsolete

- **WHEN** a request waits behind another native call and its execution becomes obsolete
- **THEN** the owner rechecks the binding before executing that request
- **AND** refuses it without running the requested tool

### Requirement: The bundled bridge verifies its owner before serving

The bundled stdio bridge SHALL load strict connection settings through the central configuration package. The owner endpoint MUST use the loopback HTTP route. Credentials MUST travel through the environment and MUST NOT be accepted as command arguments. Before serving an agent, the bridge MUST compare every expected scope field, the readiness policy and the actual listed tools with its host-issued role. Invalid settings, substituted scope, malformed readiness, extra or missing tools and transport startup failure MUST stop the bridge. Standard output MUST contain only MCP messages. EOF MUST close the bridge and release input listeners and the owner client. This contract does not complete automatic SDK configuration, pre-task startup enforcement or board audit.

#### Scenario: A source CLI process serves scoped tools

- **WHEN** the host starts the bundled command with a valid worker or checker registration
- **THEN** an MCP stdio client can list the exact role tools and read a committed entry
- **AND** diagnostics do not appear on standard output

#### Scenario: A bridge receives a substituted execution

- **WHEN** the environment names an execution different from the credential's host registration
- **THEN** the bridge exits before accepting agent tool requests
- **AND** its diagnostic does not disclose the credential or private filesystem paths

#### Scenario: A readiness inventory changes

- **WHEN** readiness or the actual tool list does not match the bound role policy
- **THEN** bridge startup fails and closes the owner client

#### Scenario: Standard input ends during bridge use

- **WHEN** the agent closes the bridge's standard input
- **THEN** the bridge closes its stdio transport and owner client
- **AND** removes its input listeners, including when input ended before transport startup

### Requirement: Native bridge messages and body reads stay bounded

The native bridge SHALL apply the shared response byte ceiling while collecting an owner response and before outgoing stdio serialization. The outgoing limit MUST include JSON escaping, UTF-8 encoding and the framing newline. An oversized message MUST NOT be partially written to standard output. The configured owner timeout and caller cancellation MUST cover body collection. The bridge MUST refuse redirects before forwarding an execution credential. These limits do not establish a total process memory budget.

#### Scenario: An owner sends an oversized body

- **WHEN** the owner response exceeds the shared response byte ceiling
- **THEN** collection stops before SDK JSON parsing
- **AND** the bridge returns a generic connection failure without response contents

#### Scenario: An owner stalls after sending headers

- **WHEN** the owner begins a response but does not finish its body before the configured timeout
- **THEN** body collection is cancelled within that timeout
- **AND** caller cancellation can also stop collection

#### Scenario: JSON expansion exceeds the stdio budget

- **WHEN** a result's UTF-8 encoding or escaped JSON would exceed the outgoing frame byte ceiling
- **THEN** the bridge refuses the send before writing any part of that frame

#### Scenario: An owner redirects a credentialed request

- **WHEN** the owner responds with a redirect
- **THEN** the bridge refuses it
- **AND** the redirect target receives no credentialed request

### Requirement: Output failure cannot retain a native bridge send

The stdio bridge SHALL wait for the writable callback before completing a send. A write failure, closed pipe, transport cancellation or configured connection deadline MUST reject pending sends with a generic diagnostic. Closing MUST release transport listeners, preserve the caller's output stream and notify closure once. These rules do not establish a total concurrency or process memory budget and cannot force a caller's blocked output buffer to drain.

#### Scenario: A frame completes under backpressure

- **WHEN** a writable accepts a frame after applying backpressure
- **THEN** the send waits for its write callback and preserves the complete JSON frame

#### Scenario: An output pipe fails or closes

- **WHEN** a pending output write fails or its pipe closes
- **THEN** the send rejects without exposing the pipe's private diagnostic
- **AND** the transport releases its listeners

#### Scenario: An output write stops making progress

- **WHEN** an output write does not complete before the configured connection deadline
- **THEN** the send rejects and the transport closes while preserving the caller's output stream

#### Scenario: A bridge closes with an output write pending

- **WHEN** the bridge closes before the write callback completes
- **THEN** the pending send rejects and repeated closure notifies the peer only once

### Requirement: Native adapters receive volatile execution bindings

Codex and Claude adapters SHALL accept a host-issued native binding separately from durable agent specifications. The strict binding MUST match the invocation's run and execution and use an absolute bundled executable with bounded arguments. A credential MUST NOT enter command arguments. The isolated host MUST forward the binding on starts and resumes. Configuration MUST compose the environment; adapters MUST refuse native setup without that factory. An injected Codex client that cannot prove required server configuration MUST be refused for bound execution. This adapter contract does not complete runner registration, checkpoint guarding, audit or installed acceptance.

#### Scenario: Both SDKs use native tools across resume

- **WHEN** either pinned SDK starts and resumes a worker or checker with a valid host binding
- **THEN** its actual local MCP process serves the exact role inventory and supports search and read
- **AND** direct and isolated-host invocations retain their native session identity

#### Scenario: A native binding substitutes execution scope

- **WHEN** the binding disagrees with the invocation or the credential's host registration
- **THEN** execution fails without a completed task or native search
- **AND** diagnostics do not contain the credential

#### Scenario: Claude startup never reaches its role inventory

- **WHEN** initialization fails, the server is missing or failed, its inventory differs, the deadline expires or the caller cancels
- **THEN** Claude's task remains behind the readiness barrier and the query closes
- **AND** the error contains only the generic startup diagnostic

#### Scenario: Native credentials would enter launch arguments

- **WHEN** a host binding puts its credential into the executable or arguments
- **THEN** strict binding validation refuses it before native process startup

### Requirement: Native execution guards last through checkpoint capture

The runner SHALL mint an optional native binding only after its execution reservation is committed. It MUST commit uncertain delivery before calling backend start or resume. It MUST pass that binding to start and resume without placing it in durable agent specifications. Its current-execution predicate MUST bind the logical attempt, phase object, physical execution, running state and cancellation. The lease MUST remain open through worker checkpoint reads and copies, then close before phase completion or knowledge publication. Raw events, complete answers and backend or cleanup diagnostics MUST pass the execution value guard before durable admission. Events arriving after lease closure MUST be ignored. Operational failures MUST retain the logical attempt and MUST NOT count as refutations. This runner contract does not complete server composition, metadata audit or installed acceptance.

#### Scenario: A native worker resumes on the same attempt

- **WHEN** a bound worker is interrupted and explicitly resumed
- **THEN** the original logical attempt and native session continue with a fresh physical binding
- **AND** every opened worker or checker lease closes before successful publication

#### Scenario: A credential reaches the checkpoint boundary

- **WHEN** worker contents, a filename or bytes across file chunks contain the execution credential
- **THEN** checkpoint capture refuses the candidate while the lease remains active
- **AND** no artifact is published and no refutation is charged

#### Scenario: A native result or diagnostic contains its credential

- **WHEN** an event, answer, session identity, backend failure or cleanup failure contains the execution credential
- **THEN** a safe failure is recorded without that credential
- **AND** the lease closes even when backend start or resume fails

#### Scenario: A closed execution sends a late event

- **WHEN** a backend invokes its event sink after lease closure has begun
- **THEN** the runner ignores the event before journal admission
- **AND** ordinary completion can still publish the guarded candidate

### Requirement: The local service composes automatic native tools

Local service startup SHALL supply the bundled native command to the server and compose execution authority with the runner. The source command MUST resolve the native helper source, and an installed command MUST resolve its separate bundle beside the runtime. The native route MUST authenticate its execution credential before ordinary actor routing; operator credentials MUST NOT grant a native role. Home-owner server.native_tools settings MUST bound registrations, pending operations and startup timeout. Lower configuration layers MUST NOT override those owner settings. Connection scope and absolute run directory MUST validate before registration consumes capacity. Scanners MUST cover scoped credentials and inherited secret values. Shutdown MUST pause active work before stopping the listener, draining authority and closing knowledge. This composition does not complete metadata-only board audit or live vendor compatibility.

#### Scenario: Both native backends use automatic scoped tools

- **WHEN** a local Codex or Claude workflow explicitly searches and reads a committed entry in its worker and checker
- **THEN** both pinned SDKs receive the role inventory and actual tool result through automatically configured bundled servers
- **AND** only a survived checker permits artifact publication

#### Scenario: A scripted native result has no source entry

- **WHEN** a vendor fixture requires a particular native search result but that committed entry is absent
- **THEN** the real tool call returns no such entry and the scripted task blocks
- **AND** no invented answer, artifact or refutation is recorded

#### Scenario: A registration rejects invalid connection data

- **WHEN** the host supplies an invalid run directory before registration
- **THEN** admission fails without consuming registry capacity
- **AND** closing a valid registration releases its capacity and refuses its previous credential

#### Scenario: An installed workflow uses the bundled native command

- **WHEN** a clean installed preview runs the same positive and negative native workflow table through Codex and Claude vendor stubs
- **THEN** the installed bundle configures and starts its own native tool command without workspace imports
- **AND** seeded search/read succeeds while an absent required entry blocks publication

#### Scenario: An operator tries the native execution route

- **WHEN** an ordinary agent or person credential requests the native execution endpoint
- **THEN** the endpoint refuses that credential before ordinary actor routing
- **AND** the same credential retains access to ordinary health inspection

### Requirement: Native HTTP startup preserves execution proof

Local Codex and Claude composition SHALL support a direct loopback HTTP native transport to avoid a helper process for each execution. The home owner MUST select the transport through central configuration. Explicit stdio bindings MUST retain their existing bridge contract. HTTP credentials MUST enter the vendor environment only; command arguments may contain the credential variable name or an environment reference, never its value. Adapters MUST require a runtime-injected readiness port for HTTP bindings and await it before vendor work. The readiness implementation MUST validate the host ready scope and exact reported and listed role inventories with bounded responses, cancellation and the configured timeout. Missing readiness, substituted scope, absent credentials or invalid transport MUST fail before vendor task execution. Both transports MUST retain role policy, recovery accounting, revocation and checkpoint guards. Direct HTTP acceptance requires unchanged mixed parallel workflow assertions and deadlines plus clean installed-package verification against vendor stubs.

#### Scenario: HTTP native bindings retain both backend roles

- **GIVEN** Codex and Claude workers and checkers with host-issued HTTP bindings
- **WHEN** each starts and resumes with runtime readiness enabled
- **THEN** exact role inventories, seeded searches, reads and session identity checks pass without an extra stdio helper

#### Scenario: HTTP native binding lacks its readiness port

- **GIVEN** a native HTTP binding with a valid structure
- **WHEN** either adapter has no runtime readiness implementation
- **THEN** it refuses the execution before launching vendor task work

#### Scenario: HTTP native scope differs from its credential

- **GIVEN** a valid native credential and an altered execution scope
- **WHEN** the runtime checks readiness for either backend
- **THEN** it refuses the execution before a native search, completed task or quality refutation

### Requirement: Native tool audit acknowledgement is durable

The native authority SHALL commit metadata for every admitted tool call before returning its response. Metadata SHALL contain the trusted run, step, attempt, execution, role and persona, a declared tool name, the outcome and only the entry ids returned or changed. It MUST NOT contain arguments, queries, entry bodies, credentials or exception text. Unknown tool names SHALL use a fixed safe marker. Refused calls SHALL have no returned entry ids. Readiness calls SHALL also be recorded. The existing board event envelope MAY hold this metadata in its data field.

If metadata cannot be committed, the authority MUST return a safe operational failure, refuse further calls on that lease and prevent successful phase completion or knowledge publication. Closing the lease MUST drain admitted calls and free its slot even after an audit failure. An admitted call MAY finish its audit while its lease is closing; queued calls MUST still recheck authority before running. The runner MUST reject metadata for another attempt, role, obsolete execution or completed phase.

#### Scenario: Tool response waits for audit

- **WHEN** a worker or checker search returns two entries while its audit write is waiting
- **THEN** the response is not acknowledged until the metadata write completes
- **AND** the record contains the two ids without entry bodies or credentials

#### Scenario: Audit write refuses completion

- **WHEN** the audit write fails for a worker or checker call
- **THEN** its response contains no private audit error details
- **AND** further calls and phase completion are refused while lease cleanup still frees its slot

#### Scenario: Refused calls retain safe metadata

- **WHEN** an admitted call requests an absent entry or an unknown tool
- **THEN** its audit records refusal with no entry ids
- **AND** an unknown name is replaced by the fixed safe marker

#### Scenario: Metadata belongs to its execution

- **WHEN** metadata claims another attempt, role or physical execution, a completed phase or an extra private result field
- **THEN** the runner refuses the record without advancing the durable board

#### Scenario: Installed native audit

- **WHEN** an installed Codex or Claude workflow searches and reads through either supported native transport
- **THEN** its event pages contain the matching worker and checker metadata, execution ids and returned entry ids
- **AND** a search without a matching entry remains recorded without inventing an id

### Requirement: Native vendor events contain only bounded tool metadata

For executions with native tools, the runner SHALL scan the original vendor event for scoped credentials before projecting it into durable board data. Codex native tool events SHALL retain only bounded call identity, a declared tool name, status and activity. Claude native tool-use messages SHALL retain only bounded call identity, a declared tool name and activity. Arguments, entry bodies, full results, vendor errors and arbitrary extra fields MUST NOT enter these records. Unknown names SHALL use a fixed safe marker. Invalid metadata or excessive tool blocks MUST fail operationally and prevent phase completion.

Claude tool-result messages do not always identify their originating server after recovery. The runner SHALL therefore project all Claude tool-result messages and partial messages while native tools are enabled. Unassociated results SHALL use the unknown tool marker without inventing identity. Ordinary messages and unrelated Codex tool events SHALL retain their existing behavior. Executions without native tools SHALL retain their existing event behavior. The authoritative tool outcome and returned entry ids SHALL remain in the separately committed native audit.

#### Scenario: Vendor events repeat private tool content

- **WHEN** a native Codex or Claude event repeats arguments, a knowledge entry body or a vendor error
- **THEN** the durable event contains only validated tool metadata
- **AND** the authoritative native audit retains its own trusted scope and entry ids

#### Scenario: Projection cannot conceal a credential

- **WHEN** either vendor puts a scoped credential inside a raw native tool result
- **THEN** the original event scan blocks execution before projection
- **AND** no phase checkpoint or artifact is published

#### Scenario: Invalid vendor metadata fails safely

- **WHEN** a native event omits its required call identity, has an unsupported status or exceeds the bounded tool-block count
- **THEN** execution fails with a safe operational message
- **AND** no private parsing input enters that message

#### Scenario: Installed vendor event projection

- **WHEN** an installed preview receives native tool-use and tool-result events from both pinned SDK stubs
- **THEN** board inspection returns only the bounded projection
- **AND** seeded native searches, reads and checked artifact publication still pass
