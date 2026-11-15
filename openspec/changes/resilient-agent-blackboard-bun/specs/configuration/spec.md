## ADDED Requirements

### Requirement: Owner backend limits preserve independent admission

Home configuration MAY set server.backend_limits for codex-sdk, claude-sdk and fake. Each value MUST be a positive safe integer or null. An absent field or null MUST retain only the shared agent ceiling. Unknown backend names and invalid counts MUST fail validation. Lower configuration layers MUST NOT set these owner budgets. The daemon MUST pass them to the shared scheduler. The global active ceiling, a run's limits.max_parallel and its backend ceiling MUST all apply to worker and checker turns across concurrent runs. Waiting for one backend MUST NOT occupy an active run slot or prevent another ready backend from using a free slot. Workspace preparation and worker checkpoint copying MUST occur inside admission. Pending calls MUST share the bounded pending-agent queue. Cancellation and failure MUST release their reservations, and waiting MUST NOT advance an execution or result-attempt counter. These configured limits do not establish adapter-declared capacity, live updates or durable queue telemetry.

#### Scenario: Owner chooses independent native limits

- **WHEN** home configuration sets a positive Claude limit and a null Codex limit
- **THEN** the resolved configuration and generated schema retain those values and old snapshots without the optional field retain their shape

#### Scenario: Invalid or lower-layer backend limits are refused

- **WHEN** a count is zero, negative or fractional, a backend name is unknown, or a lower layer supplies a server limit
- **THEN** configuration fails before execution

#### Scenario: Busy backend leaves the other backend available

- **WHEN** a held Claude or Codex turn fills its backend limit while another run submits work for the other backend
- **THEN** the peer completes before the held turn is released and no second turn starts on the busy backend

#### Scenario: Waiting backend leaves a run slot available

- **WHEN** a run allows two active turns and has a held turn, a same-backend waiter and a ready other-backend branch
- **THEN** the other branch proceeds before release while the busy backend stays within its limit

#### Scenario: Cancellation and failure release backend reservations

- **WHEN** queued or active work is cancelled or an admitted turn fails
- **THEN** only its reservations are released, remaining work drains and no extra quality attempt or refutation is invented

#### Scenario: Full pending budget still permits a free backend

- **WHEN** the pending allowance is zero and work arrives for a saturated backend and an available backend
- **THEN** the first call is refused before execution and the second can start under the global and run ceilings

### Requirement: One package owns setting definitions and schemas

`packages/config` SHALL own every Titan setting definition, default, unit, type, bounds, permitted scope and override policy. It MUST export resolved types, the Zod schema, JSON Schema and documentation metadata. Workflow validation, CLI parsing, server admission and doctor MUST use those definitions. Runtime settings MUST NOT have competing defaults in other packages. `@titan/config` MAY depend on `@titan/core`; core MUST remain independent. Adapters MUST receive resolved values through core ports without importing config or reading Titan settings themselves. Vendor credential reads MUST follow explicit bindings.

#### Scenario: Changed setting reaches every surface

- **WHEN** a configured max_parallel value passes through a workflow, CLI, schema export and server request
- **THEN** all surfaces use the same type, bounds and default definition

#### Scenario: Conflicting local default

- **WHEN** a runtime package introduces its own Titan recovery default
- **THEN** the configuration contract check fails and names the duplicate definition

### Requirement: Files and overrides have a declared precedence

Configuration SHALL resolve built-in defaults, `TITAN_HOME/config.yaml`, project `.titan/config.yaml`, workflow fields and explicit CLI overrides in that order. `--config <file>` MUST replace only the project layer. `--home` MUST override `TITAN_HOME`; otherwise home MUST default to `~/.titan`. `--project-path` MUST resolve before project-file loading. Environment overrides MUST use a documented allowlist, with units and precedence listed per key. Unknown fields and incompatible versions MUST fail with their source path before work. Existing explicit persona backend rules MUST remain as documented in spec backend-selection. Empty, absent and null values MUST have distinct schema meanings.

#### Scenario: File and workflow override

- **WHEN** user configuration sets max_parallel 2, project sets 3, workflow sets 4 and CLI explicitly sets 5 within policy
- **THEN** the effective value is 5 and sources show each shadowed value

#### Scenario: Invalid config cannot start work

- **WHEN** project configuration has an unknown field or a string where a count is required
- **THEN** validation returns its file and field path without agents, scripts or plug-in imports

#### Scenario: Backend executable belongs to the home owner

- **WHEN** the home configuration selects an absolute Codex or Claude executable and an optional supported Claude interpreter
- **THEN** runtime composition passes those settings to the owning SDK adapter
- **AND** relative paths, unknown runtimes and executable overrides from project or workflow settings are rejected

### Requirement: Defaults and ownership of limits are published

The registry SHALL include run, server and backend capacity, step and nesting limits, result attempts, recovery, timeouts and retention. It MUST also include backend defaults, approvals, tool paths, tracing and experimental learning settings. Existing documented defaults MUST remain until deliberately versioned. The initial key table in `research/recovery-config-delivery-review.md` MUST define file shapes, types, defaults and scopes. Registry metadata MUST map vendor capability names to these canonical keys. Shared `defaults.max_attempts` and `defaults.candidates` MUST supply step defaults; an explicit step value MUST win within owner policy. Initial recovery defaults MUST be max_retries 5, base_delay_s 1, max_delay_s 60 and jitter_ratio 0.2. Session mode MUST default to native_only. Retry counters MUST apply per logical role invocation and execution phase, including its SDK retries. Run and server aggregate budgets MUST remain additional constraints. Group nesting depth MUST default to 32 and remain configurable up to a safety ceiling of 128. Graph dependency depth MUST depend on the configured node allowance rather than this group limit. These values MUST be labeled design choices pending measurements. Workflow overrides MUST NOT raise owner ceilings or weaken protected approval and tracing rules. Explicit owner changes MUST validate before use and leave an audit record. Finite ceilings MUST be reported, never presented as unlimited execution.

#### Scenario: Workflow cannot override owner ceiling

- **WHEN** server owner caps active sessions at 4 and a workflow requests 20
- **THEN** admission reports the effective cap of 4 without allocating 20 sessions

#### Scenario: Workflow cannot enable prompt tracing

- **WHEN** a workflow tries to enable trace content reserved for the person
- **THEN** validation rejects the field and names its owner policy

#### Scenario: Large plan has an explicit allowance

- **WHEN** a person raises max_steps from 50 to 200 within owner policy
- **THEN** a 120-node workflow validates and dry-run reports the new bound

### Requirement: Runs freeze their effective configuration

Each run SHALL save a secret-free effective configuration, schema version, source map and hash before execution. Resume MUST use that snapshot. Changing files MUST affect future submissions only. Current server capacity and owner revocations MUST remain live safety constraints, with their changes recorded separately. A run allowance change MUST require a scoped person decision naming the run, previous hash and new values. It MUST create a new revision without rewriting the original snapshot or erasing usage. Lowered ceilings MUST stop new admissions without claiming to cancel already incurred usage.

#### Scenario: Edited config during a pause

- **WHEN** a project timeout changes while a run is paused
- **THEN** resume retains the saved timeout; a new run uses the edited value

#### Scenario: Approved extra recovery allowance

- **WHEN** a person raises a blocked run recovery allowance from 5 to 8
- **THEN** the new revision records three available retries and retains all five prior retries

### Requirement: Configuration tools explain and safely change settings

`titan config init`, `show`, `validate`, `schema` and `set` SHALL support documented user and project scopes. Show MUST offer `--sources` and `--run-id <run id>` for frozen settings. Output MUST redact secrets and show environment variable names only. Set MUST validate the complete result, check an expected version and atomically replace the selected file. Concurrent edits MUST fail without losing either edit. Schema export MUST need no vendor credentials, plug-in execution or model downloads. Format upgrades MUST follow the existing migration and rollback contract.

#### Scenario: Concurrent config writers

- **WHEN** two clients set a field using the same expected version
- **THEN** one succeeds and one receives a conflict without a partial file

#### Scenario: Scoped config edits retain owner policy

- **WHEN** a person initializes a user or project file and sets one field using its current byte version
- **THEN** the selected file is replaced atomically with private permissions after complete settings validation
- **AND** a project edit retains inherited owner-only settings, request ceilings and approval floors

#### Scenario: Refused config edits preserve the file

- **WHEN** a writer supplies an old version, an invalid value or an unsafe field name
- **THEN** the existing configuration bytes remain unchanged
- **AND** a held or corrupt writer lease refuses admission within the fixed retry allowance

#### Scenario: Config schema export is offline

- **WHEN** a person calls titan config schema without vendor credentials
- **THEN** it returns the shared configuration input schema without starting a vendor process

#### Scenario: Exact frozen configuration survives file edits and restart

- **WHEN** a passed or blocked run is inspected through CLI, HTTP and MCP before and after home and project configuration edits and daemon restart
- **THEN** its saved values, hash, sources, workflow revision and journal position remain unchanged
- **AND** omitting the CLI sources option omits the source map without changing the run

#### Scenario: Frozen configuration refuses a different or malformed report

- **WHEN** a report names another run, changes effective values without updating the hash or supplies unsupported fields or a version
- **THEN** the client refuses it as an invalid response
- **AND** a missing selected run cannot expose a neighboring run through CLI, HTTP or MCP

#### Scenario: Scoped show inspects files without starting services

- **WHEN** a person inspects a populated or absent user or project file with config show and optional sources
- **THEN** the report identifies its scope, absolute path, byte version and effective settings with inherited owner policy
- **AND** sources identify the files that supplied values while missing optional files remain absent
- **AND** invalid documents and combined run and file selectors fail without replacing configuration or starting a daemon

#### Scenario: Inspect a blocked run config

- **WHEN** a person calls titan config show --run-id with --sources
- **THEN** the output identifies frozen values, owner ceilings and revision history without credential values

### Requirement: Native host overhead is owner controlled

Home-owner server settings SHALL expose agent_host.gc_markers, agent_host.worker_threads and agent_host.startup_timeout_ms through the central configuration schema. Defaults MUST use one GC marker, two worker threads and a 10000 ms ready deadline. Marker counts MUST be integers from 1 through 16, worker pools integers from 2 through 16 and deadlines integers from 1 through 60000 ms. Project files and workflow overrides MUST NOT change server host settings. Thread settings MUST apply before managed Bun processes and native helpers start; they MUST NOT raise workflow agent limits or the verification container's resource limits.

#### Scenario: Owner sets native host budgets

- **WHEN** the home owner leaves host settings empty or selects valid marker and startup budgets
- **THEN** the resolved configuration and exported schema expose those effective settings
- **AND** managed processes start with the selected marker budget

#### Scenario: Invalid or project host settings are refused

- **WHEN** a host budget is outside its schema range or a project attempts to set server host settings
- **THEN** configuration resolution rejects it before starting the managed process

### Requirement: Workspace snapshots have explicit bounded budgets

The system MUST publish validated entry, content-byte and path-depth limits in central configuration. Reads, copies, checkpoints and assembled results MUST use the run's frozen settings. Exceeding a snapshot budget MUST block operationally without spending a quality attempt. These limits do not replace live agent disk quotas.

#### Scenario: Exact snapshot boundary remains usable

- **WHEN** a project or candidate contains exactly the configured entries, bytes and depth
- **THEN** the snapshot and verified copy succeed, with directories counted once and excluded metadata skipped

#### Scenario: Snapshot excess is refused before delivery

- **WHEN** a candidate exceeds an entry, byte or depth budget, or parallel candidates exceed a budget when combined
- **THEN** delivery is blocked without a quality refutation, the original project is preserved, and a rejected copy does not create its target

#### Scenario: Snapshot settings use central configuration

- **WHEN** home, project or workflow configuration changes a workspace budget
- **THEN** the shared schema and ordinary precedence apply, invalid or excessive values are rejected, and the effective configuration exposes the selected limits

### Requirement: CLI setting assignments reuse the run schemas

The CLI SHALL accept repeated --set SECTION.KEY=VALUE on check, config and run. Registered defaults, limits and recovery fields SHALL use their central schemas. The registry SHALL exclude owner-only server settings. Values SHALL accept JSON scalars or plain enum text without coercing quoted numbers. Assignment input SHALL be limited to 64 entries and 1024 characters per entry. Unknown keys, invalid values, duplicate keys and collisions with companion flags SHALL fail before workflow loading or submission. Initial companion overrides SHALL use the same strict partial schema as workflow settings. Effective resolution SHALL retain combined constraints and CLI source history. Submitted overrides SHALL reach the server's validated frozen run configuration.

#### Scenario: Registered settings retain schema values and precedence

- **WHEN** config inspection or submission uses typed, nullable or enum assignments within the input allowances
- **THEN** shared schemas preserve their values, CLI precedence and source history
- **AND** every registered default can round-trip through an assignment without changing its value

#### Scenario: Invalid assignments cannot change owner or duplicate settings

- **WHEN** assignments or initial companion values contain unknown, owner-only, malformed, invalid, duplicate or excessive input
- **THEN** admission fails before workflow loading or submission
- **AND** invalid combined recovery delays still fail effective configuration validation

#### Scenario: Submitted assignments survive persisted inspection

- **WHEN** a valid CLI run uses general settings alone or with distinct companion settings
- **THEN** the server validates those overrides and stores the same effective settings and sources returned by subsequent inspection

### Requirement: Request counts use frozen configured allowances

New resolved configurations SHALL publish requests.max_per_run with default and fixed ceiling 256 and a positive integer minimum of 1. Home configuration MAY lower this allowance. Project, explicitly selected, workflow and CLI layers MUST keep or lower the inherited value. Generated schemas and repeated --set assignments SHALL use the same definition. Each run SHALL retain its allowance and hash across file edits and reload. Legacy snapshots without requests SHALL retain their original shape and hashes and use the original 256 allowance. Admission and replay SHALL use the smaller of the frozen run allowance and the ledger safety limit. Answered records still consume capacity; creation retries of an existing request SHALL remain available at capacity. A refused new record MUST leave the journal cursor and existing records unchanged.

#### Scenario: Request allowance crosses configuration layers

- **WHEN** the home, project, workflow and CLI supply successively lower request allowances
- **THEN** resolution retains the last value and records the sources
- **AND** invalid counts, unknown fields and attempts to raise an inherited allowance are refused

#### Scenario: Reload cannot enlarge request capacity

- **WHEN** a run reaches its frozen request allowance and configuration files are later raised
- **THEN** same-engine and reloaded admission refuse another request without changing existing records or journal cursor
- **AND** answering and retrying an existing request remain possible without releasing its capacity

#### Scenario: Legacy request capacity keeps original hashes

- **WHEN** a journal whose configuration has no requests section is loaded
- **THEN** its configuration shape and hash remain unchanged
- **AND** its request ledger uses the original default allowance

### Requirement: The home owner bounds outstanding request mutations

Home-owner server.max_pending_request_operations SHALL default to 256 and admit positive integers through 256 using the request ledger queue schema. Startup SHALL pass that setting to the shared engine ledger. Its count SHALL include active and queued mutations across runs. Project, selected-file, workflow and CLI layers MUST NOT change it. Saturation MUST refuse a mutation before append without changing the selected request, journal cursor or quality counters. Releasing active work MUST allow an explicit retry. A home edit SHALL apply after server restart. Stored configurations without this optional field MUST retain their original shape and hash.

#### Scenario: Owner request queue settings are validated

- **WHEN** the home owner supplies an empty setting or valid request operation allowance
- **THEN** configuration resolves its explicit default or selected value
- **AND** invalid counts, excess counts and lower-layer overrides fail

#### Scenario: Independent request operations fit the owner allowance

- **WHEN** one run has a held request opening and the allowance is two
- **THEN** another run can open or answer its own request before that opening completes
- **AND** both mutations commit exactly once without changing quality counters

#### Scenario: A saturated request queue recovers without losing a decision

- **WHEN** one request mutation is held and the owner allowance is one
- **THEN** another run’s opening or answer is refused without changing its request or journal cursor
- **AND** the same explicit operation succeeds after the held mutation completes

### Requirement: The home owner bounds run and submission operations separately

Home-owner server.max_pending_run_operations and server.max_pending_submissions SHALL each default to 4096 and accept integers from one through the central runtime ceiling of 4096. Each separate queue SHALL count its active and queued entries. Run operations SHALL serialize by run id; submissions SHALL serialize by client and submission identity. A submission MUST use only one run-operation entry while holding its separate submission entry. Lower configuration layers MUST NOT override these settings. Startup SHALL validate and apply them; a home edit SHALL apply after restart. Legacy stored configurations without these optional fields MUST retain their shape and hash. Queue saturation MUST refuse new admission without acknowledging a mutation. Explicit retry after release MUST retain submission identity and existing decisions. This contract does not promise durable scheduling or a combined budget for all HTTP traffic.

#### Scenario: Owner run and submission budgets are validated

- **WHEN** the home owner selects defaults or valid counts for either queue
- **THEN** configuration resolves those counts and refuses invalid counts or lower-layer changes

#### Scenario: Two run operations admit independent request work

- **WHEN** one run holds an operation and the run queue allowance is two
- **THEN** another run can open or answer a request and both mutations finish once

#### Scenario: Saturated run queue retains unchanged durable state

- **WHEN** one run holds the only run-operation entry and another run requests a mutation
- **THEN** the peer receives capacity and its journal cursor, request and quality counters stay unchanged
- **AND** an explicit retry after release commits once

#### Scenario: Separate submission admission supports minimum budgets

- **WHEN** both queue allowances are one and creation holds the submission entry
- **THEN** a peer submission is refused without exhausting the first submission through a nested run entry
- **AND** after release the peer can retry and repeated submission returns its original run id

#### Scenario: Independent submissions fit two entries

- **WHEN** one creation is held and both queue allowances are two
- **THEN** a distinct submission can finish and later exact retry retains its original run id

### Requirement: The home owner bounds resident runs

Home-owner server.max_resident_runs SHALL default to 1024 and accept integers from one through the central ceiling of 1024. Lower configuration layers MUST NOT override this process budget. The engine SHALL accept named schema-validated settings for residency, active agents, pending agents and request operations. Its run, journal-store, active-work and controller collections MUST use the resolved resident allowance. Legacy stored configurations without this optional field MUST retain their shape and hash.

A full resident set MAY evict an inactive run. It MUST NOT evict an active run to admit another run. Residency refusal MUST NOT execute the peer. Creation may already have recorded that peer before retention fails. In that case explicit retry SHALL recover its durable identity as blocked, and explicit resume after capacity becomes available SHALL execute it without an extra quality attempt. This memory budget does not limit the durable catalog or reserve capacity before filesystem work.

#### Scenario: Owner residency settings are validated

- **WHEN** an owner selects the default or a valid resident count
- **THEN** startup resolves that allowance and rejects zero, fractional, excessive or lower-layer replacements
- **AND** an old stored configuration remains unchanged when read

#### Scenario: Small resident boundaries retain queryable runs

- **WHEN** the engine admits runs at resident allowances of one, two and three
- **THEN** every retained run stays queryable and admitting another run evicts the oldest inactive run
- **AND** zero or negative engine allowances fail before run creation

#### Scenario: Active residents protect their slots

- **WHEN** one worker holds a resident slot while another submission arrives
- **THEN** two slots allow independent delivery and one slot refuses the peer without executing it
- **AND** release, explicit retry and resume recover the recorded peer with one quality attempt

### Requirement: The default model is a setting without a version

`titan` SHALL have a setting `defaults.model`. Its value MUST be a model name without a version, such as `sonnet`, `opus` or `haiku`. A persona's `model` field SHALL win over `defaults.model`. When neither is set, `titan` MUST NOT choose a model itself and MUST pass no model to the adapter. `titan` MUST NOT write a model with a version number into code, examples or defaults. The run record SHALL show the model name that each agent got.

#### Scenario: Default model applies to a persona without a model

- **WHEN** `defaults.model` is `sonnet` and a persona has no `model` field
- **THEN** the adapter gets the model `sonnet` for that persona
- **AND** the run record shows `sonnet` for every agent of that persona

#### Scenario: Persona model wins

- **WHEN** `defaults.model` is `sonnet` and a persona has `model: opus`
- **THEN** the adapter gets the model `opus` for that persona

#### Scenario: No model set anywhere

- **WHEN** neither `defaults.model` nor the persona names a model
- **THEN** the adapter gets no model from `titan`

#### Scenario: A model with a version is refused

- **WHEN** `defaults.model` holds a name that ends in a version number
- **THEN** validation fails and names the setting
