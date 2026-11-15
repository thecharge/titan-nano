## ADDED Requirements

### Requirement: Identifiers and selectors have consistent meanings

Every CLI, HTTP and MCP response SHALL distinguish workflow_id, workflow_revision, run_id, step_id, split_part_id, candidate_id, attempt_id, execution_id and session_id. File `workflow_id` MAY supply an explicit stable definition id. Otherwise its default MUST hash the canonical project path and workflow relative path. Workflow revision MUST hash the accepted definition. Run ids MUST be unique per submission. User-controlled ids MUST never become unchecked paths. Mutation commands MUST require full ids and explicit targets, never an implicit current run. Read-only prefixes MUST fail when ambiguous. Responses MUST include resolved project and home context.

A typed client MUST bind status, lifecycle control and artifact inspection responses to the full run id it requested. CLI and MCP handlers MUST use that shared validation. A valid response for another run MUST fail with a transport error before the client prints or uses that result. Submission responses assign a new run id and retain their separate admission contract.

#### Scenario: Status cannot observe another run

- **WHEN** status requests one full run id and receives a valid active or passed snapshot naming another run
- **THEN** the typed client rejects that response with invalid-response and transport exit code four

#### Scenario: Lifecycle response cannot switch targets

- **WHEN** resume, pause or cancel receives a valid snapshot naming another run
- **THEN** the typed client rejects the response without treating either run as successfully controlled

#### Scenario: Artifact inspection cannot switch runs

- **WHEN** artifact inspection receives an empty or populated valid manifest naming another run
- **THEN** the typed client rejects the response before exposing it as the selected delivery

#### Scenario: Repeated workflow gets separate runs

- **WHEN** the same workflow file starts twice without an explicit workflow_id
- **THEN** both runs share workflow_id and revision but have distinct run ids and isolated artifacts

#### Scenario: Ambiguous run prefix

- **WHEN** two stored run ids match a supplied read-only prefix
- **THEN** the CLI returns an ambiguity error without picking the latest run

#### Scenario: Mutating command without target

- **WHEN** two runs are active and cancel has no run id
- **THEN** the CLI exits 2 without changing either run

### Requirement: Run controls expose the whole lifecycle

The CLI SHALL offer runs, status, events, pause, resume and cancel with explicit run targets. Runs MUST filter by workflow, project, client, harness and state, with limit and cursor pagination. Status MUST expose step, candidate, attempt and execution filters. Events MUST support a durable `--after` cursor and optional `--follow`. Run MUST accept mutually exclusive `--detach` and `--watch`; watch MUST be the default. Detached success MUST mean accepted, not passed. Pause MUST stop admissions and request a checkpoint at the next safe boundary. If an active action cannot safely stop, pause MUST report pausing until reconciliation or completion. It MUST NOT report paused while untracked effects remain active. An uncertain effect MUST block reconciliation before further work. Resume MUST expose `--session-mode` and authorized `--recovery-max-retries` changes without resetting counters. Observer disconnection or Ctrl-C MUST NOT cancel daemon work.

#### Scenario: Detach and inspect a run

- **WHEN** a client submits with --detach and then requests status and events for its returned run id
- **THEN** submission returns accepted promptly and both inspection commands target that run

#### Scenario: Run watches until an outcome

- **WHEN** a sequential or parallel scripted run is submitted without an observation flag
- **THEN** its CLI waits for the passed outcome and exits zero with the completed run
- **AND** missing worker or checker answers return blocked with exit three while preserving the logical result attempt
- **AND** explicit detach returns accepted work whose run id can be inspected through status and events

#### Scenario: Observation flags conflict before work

- **WHEN** run combines detach with watch or dry run
- **THEN** the parser rejects the invocation with invalid input before loading a workflow or contacting a server
- **AND** status and resume reject detach as an unsupported option

#### Scenario: Pause one parallel workflow

- **WHEN** two workflows run and one is paused by full id
- **THEN** that run checkpoints and releases slots while the other continues

#### Scenario: Observer interrupt leaves work running

- **WHEN** a watched CLI receives Ctrl-C
- **THEN** the observer exits 130 and a new client can observe the same continuing run

### Requirement: Output and errors have stable machine contracts

Ordinary `--json` output SHALL be one versioned envelope with operation, identifiers, state, data and a nullable structured error. Run output MUST retain an ordered events page and next_cursor; paging MUST disclose truncation. Exit codes MUST be 0 for successful queries or accepted detached submissions, 1 for terminal negative outcomes, 2 for invalid input, and 3 for nonterminal waits. Transport or authentication failures MUST use 4 and MUST NOT claim the run failed. Lost submission responses MUST be recoverable through submission ids. Run MUST accept --submission-id; generated ids MUST be persisted in a local receipt before sending. Finite event queries MUST use one JSON envelope; `events --follow --format jsonl` MUST use versioned event lines and reject --json. Protocol command exceptions and server readiness MUST retain their existing contracts.

#### Scenario: Lost detached acknowledgment

- **WHEN** a server accepts a submission but the CLI loses its response
- **THEN** the CLI reports transport uncertainty with submission id; retrying it finds the same run

#### Scenario: Blocked run is not failed output

- **WHEN** a watched run blocks on missing credentials
- **THEN** its JSON state is blocked with a recovery action and exit code 3

#### Scenario: Paged event history

- **WHEN** more events exist than the configured page size
- **THEN** JSON returns an ordered bounded page, truncation metadata and a usable next_cursor

#### Scenario: Ordinary responses share a versioned envelope

- **WHEN** a person or harness requests ordinary JSON help, version, a query, a completed run or an input failure
- **THEN** exactly one schema-checked envelope contains operation, identifiers, state, data and a nullable structured error
- **AND** an error includes code, message, field paths, retryability and a nullable recovery action
- **AND** protocol framing and serve readiness retain their contracts

#### Scenario: Event following uses versioned lines

- **WHEN** events are followed with --follow --format jsonl
- **THEN** each committed event occupies one versioned line bound to the selected run and durable cursor order
- **AND** bounded pages drain before polling and an observer interrupt leaves daemon work running
- **AND** combining --follow with --json or using an unsupported format fails before network work

#### Scenario: Observation uncertainty retains its target

- **WHEN** observation or the final event page fails after a run was accepted
- **THEN** transport output retains the known run id and a status recovery action with exit four
- **AND** the response state remains unknown and does not assign a quality failure

### Requirement: Help covers valid combinations and remote parity

Help and a command reference SHALL specify every subcommand, positional argument, flag, default, environment binding, exit code and JSON shape. Run controls MUST document --home, --project-path, --config and explicit identifiers. Repeated `--set <key=value>` MUST accept only registry-listed CLI-overridable fields and validate typed values before submission. The reviewed surface in `research/recovery-config-delivery-review.md` MUST supply the implementation reference alongside existing capability commands. Conflicting flags, unknown flags and missing companion arguments MUST fail before side effects. Mutations MUST accept --expected-version and --idempotency-key. When expected version is omitted, the client MUST fetch it once before mutation and report a later conflict without blind retries. Create requests MUST use submission identity instead of a preexisting run version. HTTP and MCP MUST expose equivalent typed controls with matching validation and errors. Each example MUST be checked against the shared command definitions without starting a vendor. Documentation MUST explain local observation, daemon execution and artifact delivery as separate actions.

#### Scenario: Conflicting invocation before execution

- **WHEN** run is called with both --detach and --watch or an unknown flag
- **THEN** the CLI exits 2 with usage and creates no run

#### Scenario: HTTP and MCP recovery parity

- **WHEN** the same paused run is resumed through CLI, HTTP and MCP contract fixtures
- **THEN** all three enforce the same target, ownership, allowance and idempotency rules

### Requirement: Artifacts can be inspected exported and deliberately applied

`titan artifacts list`, `show` and `export` SHALL address a run and artifact id. Manifests MUST record kind, producing identities, paths, hashes, size and check evidence. Exports MUST use kept snapshots and reject traversal and escaping symlinks. `titan apply <run id> --target <path> --dry-run` MUST show the exact code or document changes. Applying MUST require a scoped person decision tied to that diff and target base hash. A changed base MUST conflict before any writes. Failed application MUST roll back local writes or report the precise partial state. Exported proposals MUST NOT claim that an external operation was performed.

Later request opening and answer events MUST NOT invalidate an unchanged passed delivery. Inspection MUST locate the original passed commitment through the selected cursor and verify that current and intermediate request-event state differs only in journal version. Changed state, unrelated later events, another passed event or a missing selected tail MUST fail inspection.

#### Scenario: Decision events preserve kept delivery

- **WHEN** request decisions are recorded after an ordinary or executable delivery passed
- **THEN** inspection and installed export retain the original verified kept result

#### Scenario: Later request cannot rewrite delivery identity

- **WHEN** a current or intermediate request event changes the passed state, even if a later event restores it
- **THEN** inspection refuses that history

#### Scenario: Later event cannot replace commitment

- **WHEN** unrelated events, a second passed event or a missing selected tail follow a delivery
- **THEN** inspection refuses to present it as the selected verified result

#### Scenario: Deliver a document outside Git

- **WHEN** a document workflow keeps a report in an isolated folder
- **THEN** the user can inspect and export the checked report with its manifest without creating a Git repository

#### Scenario: Target changed before apply

- **WHEN** the target file changes after its diff was approved
- **THEN** apply refuses with a base conflict and preserves both the target and kept artifact

#### Scenario: Unsafe artifact path

- **WHEN** an artifact export includes a symlink outside its snapshot
- **THEN** export rejects it before writing outside the selected destination

#### Scenario: Kept delivery inspection is verified across clients

- **WHEN** a passed run is inspected through the CLI, authenticated HTTP endpoint or MCP tool
- **THEN** all three return the same versioned workflow identity, kept paths, stable file identifiers, hashes, byte sizes, executable flags and outputs
- **AND** unfinished runs and changed file, manifest, result or journal evidence cannot be reported as verified delivery

#### Scenario: Artifact inspection rejects altered paired evidence

- **WHEN** an altered file and manifest agree with each other, or altered outputs and result text agree with each other
- **THEN** inspection rejects disagreement with the committed artifact hash or node outputs
- **AND** missing, duplicate, escaping or reserved manifest paths and linked kept evidence are refused

#### Scenario: Kept file pages preserve bytes and targets

- **WHEN** a checked file is read by its stable artifact identifier through CLI show, HTTP or MCP with offset and limit
- **THEN** each returns the same versioned producing identities, file metadata, base64 bytes and byte cursor within a central 65536-byte maximum
- **AND** binary data, stream boundaries and an empty final page preserve exact bytes without retaining the whole file
- **AND** changed content, size or executable intent, unknown identifiers, links, invalid ranges and repeated or unknown selectors fail

#### Scenario: Artifact response cannot change the selected target

- **WHEN** a server response names another run, artifact identifier, path or offset, exceeds the requested length, disagrees with decoded bytes or stalls before the file end
- **THEN** the typed client refuses it instead of presenting the response as the selected kept file

#### Scenario: Nested artifact commands validate before execution

- **WHEN** artifacts list or show is parsed from the shared command catalog
- **THEN** command help reports its ordered required arguments and supported options
- **AND** missing or extra arguments, invalid artifact identifiers, list-only option conflicts and invalid ranges fail before client execution

### Requirement: A selected kept file can be exported for local review

`titan artifacts export RUN_ID ARTIFACT_ID --output ABSOLUTE_DIRECTORY` SHALL verify the passed delivery and selected file before creating a new private review directory. Its parent SHALL already exist without linked components. The command MUST refuse an existing destination and destinations within run storage. It SHALL copy through bounded verified byte streams, preserve executable intent and relative path beneath `files/`, and write `artifact.json` with the selected file, workflow revision, delivery hash and outputs. An ordinary copy failure SHALL remove the incomplete directory created by that call. Existing destinations and original project files MUST remain unchanged. Export SHALL require shared local filesystem access and MUST NOT imply approved application, execution of a proposed external operation or protection against hostile concurrent filesystem replacement. Crash recovery for a partial export remains a separate guarantee.

#### Scenario: Review copy preserves selected content and commitment

- **WHEN** the person exports a plain, binary, nested document or executable file from a passed delivery
- **THEN** copied bytes, executable intent and portable metadata agree with the selected kept artifact, and original project and kept files remain unchanged

#### Scenario: Export refuses occupied or linked destinations

- **WHEN** the output already exists, has a linked parent, is relative or lies within run storage
- **THEN** export fails explicitly and preserves existing destination bytes and links

#### Scenario: Failed export removes its incomplete copy

- **WHEN** copying fails after a partial write, source bytes change during the stream or metadata cannot be created exclusively
- **THEN** export fails and removes only the incomplete directory that this invocation created

#### Scenario: CLI selects one exact kept file

- **WHEN** CLI export receives a returned run and file identifier with a valid new absolute destination
- **THEN** it writes the same verified review copy as the artifact package; invalid output admission and occupied destinations fail without replacement

### Requirement: Event pages bind identity and preserve continuity

Finite event pages SHALL include a schema version, run id and requested starting cursor. Each selected event id SHALL be the next consecutive id after that cursor. The next cursor SHALL equal the last returned event id, or the starting cursor for an empty page. An empty page SHALL NOT claim more events. Complete serialized pages SHALL stay within the shared 1 MiB allowance. The client SHALL refuse a substituted run or starting cursor, more than the requested count, invalid version, unknown field, broken sequence or inconsistent continuation as a transport error. CLI, HTTP and MCP SHALL retain the same page contract.

#### Scenario: Event pages identify the requested committed history

- **WHEN** callers inspect ordinary, empty and continued pages through CLI, HTTP or MCP
- **THEN** each page identifies its run, version and starting cursor and retains the exact consecutive event sequence within byte and count bounds

#### Scenario: Substituted and inconsistent event pages fail

- **WHEN** a response substitutes identity, exceeds a response bound, breaks sequence or continuation, or changes its admitted shape
- **THEN** the client reports an invalid response with transport exit code 4 instead of advancing observation

### Requirement: Decision commands require observed selectors

The CLI SHALL inspect one request with `requests show <run id> <request id>`. Agent `answer` and person `approve` or `deny` commands MUST require explicit run and request ids, `--request-version`, answering `--client-id` and a reason. `answer` and `approve` MUST accept the reason through `--reason`; `deny` MUST take a reason positional. Unsafe ids, missing or excessive reasons and invalid versions MUST fail before creating a client. A stale or repeated answer MUST exit 2. Person commands MUST explicitly read an existing safe person token and MUST NOT create or replace it. Agent answers MUST NOT fall back to that token. The typed client MUST bind responses to its selected identity, scope and decision.

#### Scenario: Agent and person use distinct decision commands

- **WHEN** native clients approve or deny requests through their permitted command
- **THEN** the decision records the actual credential role and answering client
- **AND** a restarted daemon retains the request while clients read the fresh address

#### Scenario: Invalid decision arguments fail before access

- **WHEN** ids, observed version, answering client or reason are missing or invalid
- **THEN** CLI validation fails before creating the request client

#### Scenario: Person command cannot repair or replace its credential

- **WHEN** its person token is missing or linked
- **THEN** the command fails without recording a decision or replacing that file

#### Scenario: Stale decision and substituted response fail

- **WHEN** an answer conflicts or its response changes identity, scope, answer or actor
- **THEN** the client reports the specified input or transport failure
- **AND** an agent-to-human refusal never switches credentials

#### Scenario: Installed commands retain decision semantics

- **WHEN** the archive is installed outside the checkout and used offline
- **THEN** main and human approvals and denials succeed through the packaged executable
- **AND** agent-to-human and repeated decisions fail with exit 2 without changing the first decision

### Requirement: Human observers print durable events while work continues

Watched human commands SHALL print each durable event as its id, type and compact JSON data on one line. They SHALL drain bounded event pages in cursor order, retain only the current page and cursor, and read the terminal tail before printing the final run snapshot. Embedded newlines in event data MUST stay escaped within their line. A completed run MUST still replay its events. Progress lines MUST be suppressed for `--json` and detached submissions. Machine output SHALL follow the separate versioned-envelope requirement.

#### Scenario: Human watch drains the journal

- **WHEN** a watched run has several event pages and then finishes
- **THEN** its human output contains every committed event once in order, including its terminal event
- **AND** event lines precede the final snapshot and result path

#### Scenario: Ordinary examples show the same live history

- **WHEN** the maintained examples run against an existing or automatically started server
- **THEN** their human event lines match the durable journal through the returned run version
- **AND** blocked work keeps its blocked exit code and counters

#### Scenario: Event transport fails during observation

- **WHEN** an event read fails while the run is active
- **THEN** observation reports the transport failure without claiming a run outcome or sending a control operation

#### Scenario: Status transport fails after progress

- **WHEN** events have printed and the next status read fails
- **THEN** the printed events remain valid and observation reports the transport failure
- **AND** it does not print a fabricated terminal result or change the run state

### Requirement: CLI submission receipts precede network effects

The CLI SHALL save generated or supplied caller and submission ids in a private local ledger before creating a server client or posting a run. The receipt SHALL bind the validated workflow, source bytes, absolute project and workflow paths, backend, effective settings and optional caller session through a digest. Retrying an explicit submission id without a client id SHALL reuse its one known caller. An ambiguous id SHALL require --client-id. A changed digest SHALL fail before submission. Independent callers MAY reuse a submission id.

The home owner MAY set client.max_submission_receipts from one through 10000. The default SHALL be 10000. Project, workflow and command override layers SHALL reject client settings. A full ledger SHALL retain existing receipts and allow identical retries while refusing new ids. An interrupted or failed ledger commit SHALL cause no submission. A transport failure during submission SHALL report both ids and the receipt path with exit 4. Successful run output SHALL keep its existing shape. Receipt contents SHALL contain only version, ids and digest.

#### Scenario: Restarted CLI reuses its caller

- **WHEN** a CLI retries one saved submission id after reopening its home
- **THEN** it posts the original caller and submission ids
- **AND** separate caller ids remain independent

#### Scenario: Receipt conflicts prevent network work

- **WHEN** a saved submission id has different input or has several callers without an explicit caller
- **THEN** the CLI refuses before creating a server client

#### Scenario: Full receipt storage keeps retry identity

- **WHEN** the configured receipt count is full
- **THEN** an identical retry succeeds and a new submission fails without deleting a receipt

#### Scenario: Lost response retains recovery arguments

- **WHEN** the server commits a run but its submission response is lost
- **THEN** the CLI reports both recovery ids and the receipt path with exit 4
- **AND** retrying starts no duplicate run or worker
