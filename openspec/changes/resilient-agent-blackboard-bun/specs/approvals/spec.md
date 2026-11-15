## ADDED Requirements

### Requirement: Every request kind has an approval level

`titan` SHALL give every request kind an approval level. The level says who decides: `titan` alone (`auto`), the main agent (`main`) or the person (`human`). The default levels MUST be:

| Kind              | What it asks for                                                            | Default level |
| ----------------- | --------------------------------------------------------------------------- | ------------- |
| `ask`             | an answer from another persona                                              | `auto`        |
| `add_step`        | new steps in the run, within the limits                                     | `auto`        |
| `replan`          | a new plan for a run that makes no progress, as in spec hive-collaboration  | `main`        |
| `new_persona`     | a new persona                                                               | `main`        |
| `improve_persona` | a better version of a persona                                               | `main`        |
| `merge_personas`  | one persona in place of two that mean the same                              | `main`        |
| `retire_persona`  | stop picking a persona                                                      | `main`        |
| `delete_persona`  | move a persona's file to `.history/`                                        | `human`       |
| `tool`            | a tool for a persona                                                        | `main`        |
| `skill`           | a skill for a persona                                                       | `main`        |
| `tool_server`     | a new tool server, which is a program on the person's computer              | `human`       |
| `resource`        | a file, a data set or access to a service                                   | `main`        |
| `action`          | an act outside the run folder, such as a push, a payment or an email        | `human`       |
| `raise_limit`     | a higher step, agent or time limit                                          | `human`       |
| `paid_compute`    | agents that run on paid machines, such as RunPod                            | `human`       |
| `lock_statement`  | approval of a locked statement for proof checks, as in spec verified-checks | `human`       |

These defaults are choices made for this design, not measured values.

#### Scenario: Default level for a tool

- **WHEN** an agent sends a `tool` request and no file sets a level for `tool`
- **THEN** the request goes to the main agent
- **AND** the board line for the request has `"level":"main"`

### Requirement: Only the person can lower a level

The person SHALL set levels in `~/.titan/config.yaml` under `approvals`. A workflow file MAY raise a level, for example from `auto` to `main`. A workflow file MUST NOT lower a level. The levels of `delete_persona`, `action`, `raise_limit` and `paid_compute` MUST NOT go below `human`. Config checks MUST reject a lower level for any of these kinds.

#### Scenario: Paid compute cannot become automatic

- **WHEN** the config has `approvals: { paid_compute: auto }`
- **THEN** `titan` refuses to start before loading a paid backend

### Requirement: Initial plans and added work use the same approval rules

`titan` SHALL check approvals before starting any tool server or external action, whether named in the first plan or added later. An approved step MUST NOT count as approval for every action its script or agent might take. A backend that cannot enforce this rule MUST be `not ready` for workflows that require external actions.

#### Scenario: Initial tool server needs approval

- **WHEN** the first workflow file names a tool server whose effective level is `human` and no approval exists
- **THEN** the run waits for a `tool_server` request before starting that program

#### Scenario: Workflow file tries to lower a level

- **WHEN** a workflow file has `approvals: { tool_server: auto }`
- **THEN** `titan check` fails with the text `the workflow file cannot lower the level of "tool_server"`

#### Scenario: Config tries to lower a fixed level

- **WHEN** `~/.titan/config.yaml` has `approvals: { action: main }`
- **THEN** `titan` refuses to start and prints `the level of "action" cannot be lower than human`

### Requirement: The main agent can pass a request up to the person

For a request at level `main`, the main agent SHALL be able to run `titan answer <run id> <request id> --to-person` with the observed request version, client id and reason. It MUST omit an approve or deny argument. The request MUST then wait at level `human`, and the board MUST log the change.

#### Scenario: Main agent asks the person

- **WHEN** the main agent runs `titan answer <run id> r1 --to-person --request-version 1 --client-id CLIENT --reason Review` for a `resource` request
- **THEN** `titan requests` lists `r1` with level `human`
- **AND** the journal records one `passed_up` event for `r1`, preserving its scope and origin with the authenticated actor, reason and time

### Requirement: Human-level requests require the person token

A request at level `human` SHALL require the person token, as in spec titan-server. Token possession authenticates a client; it does not prove human presence. Backends sharing the user account MUST disclose this trusted-agent limitation unless denied token access has been tested. The person answers with `titan approve <run id> <request id>` or `titan deny <run id> <request id> "<reason>"`, run by the person. An answer with the agent token MUST be refused with HTTP status 403.

#### Scenario: Main agent answers for the person

- **WHEN** the main agent sends an answer to a `human` request with the agent token
- **THEN** the server answers with status 403
- **AND** the request is still open

### Requirement: Only the first answer counts

Each answer SHALL name the version of the request that it saw. When a request already has an answer, the server MUST refuse a second answer with HTTP status 409. The command `titan answer` MUST then exit with code 2 and print `request <id> already has an answer`.

#### Scenario: Two answers at the same time

- **WHEN** two answers to request `r1` arrive at the same time
- **THEN** one gets status 200 and the other gets status 409
- **AND** the board has exactly one durable request-answer event for `r1`

### Requirement: Waiting for an answer ends the agent's turn

An agent's request to the main agent or the person MUST NOT keep the agent's turn open. The `titan` tool server's tool for requests SHALL return at once, with the request id and the state `waiting`. `titan` MUST continue the agent's session with the answer when the answer comes.

#### Scenario: Tool returns while the request waits

- **WHEN** an agent calls the request tool of `titan mcp` with a `tool` request
- **THEN** the tool returns within 1 s with `"state":"waiting"`
- **AND** the answer later reaches the same session

### Requirement: Every decision goes on the board

`titan` SHALL write each decision on a request to the board: the request id, the level, who decided, the answer and the reason. A decision by `titan` alone MUST name the rule it used.

#### Scenario: Automatic decision

- **WHEN** an `add_step` request inside the limits is accepted by `titan`
- **THEN** the board has a line with `"kind":"decision"`, `"by":"titan"` and the rule `within limits`

### Requirement: The person approves locked statements by default

A `lock_statement` request SHALL show the full text of the statement, its SHA-256 hash and the step that uses it. Its default level MUST be `human`, because a proof only shows what its statement says. The person MAY lower it to `main` in `~/.titan/config.yaml`. A workflow file MUST NOT lower it.

#### Scenario: Lock request with its text

- **WHEN** a step with a `lean` check is about to start
- **THEN** the board has a `lock_statement` request with `"level":"human"`, the text of the locked file and its hash

### Requirement: Approval names the exact operation

An approval SHALL name its run, request version, operation, resource and relevant content hashes. Changed scope MUST require a new request. A request for a tool server MUST cover its command, arguments and environment names. Scripts, native SDK tools and tool-server calls MUST pass the same external-action checks. Approval to start a tool server MUST NOT approve every external action it offers. Denied or expired requests MUST NOT execute.

#### Scenario: Approved command changes

- **WHEN** a tool-server command changes after the person approved its request
- **THEN** the old approval is refused and the changed command does not start

### Requirement: A scoped tool approval can cover repeated bundled starts

A run's approval for the bundled hub server SHALL name its package version, command hash and run-root scope. It MAY cover repeated starts with session ids allocated by the host inside that scope. It MUST NOT cover a different executable, changed environment template or wider file access. A named external plug-in MUST receive an `action` approval before its first import because import executes code. Dry-run MUST NOT import it.

#### Scenario: Bundled server starts for a second worker

- **WHEN** a second worker needs the same approved bundled server within the same run scope
- **THEN** its start uses that approval and receives its own restricted session capability

#### Scenario: Workflow names an unapproved plug-in

- **WHEN** a workflow names an installed plug-in without an import approval
- **THEN** no plug-in module code executes before its `action` request is approved

### Requirement: Answers and approvals cannot leak across runs

An answer SHALL bind to the explicit run, request id and request version. The server MUST check all three before applying it. A run-scoped approval MUST NOT authorize another run, even with identical commands and hashes. Open requests MUST record their originating client and harness session. Origin labels MUST NOT replace token checks. A main-level answer from another client MUST require explicit run selection and MUST record the answering client.

#### Scenario: Approval for an identical second run

- **WHEN** run A approved a command and run B requests the same command
- **THEN** B waits for its own approval

#### Scenario: Request id paired with the wrong run

- **WHEN** a client answers B's request id while naming run A
- **THEN** the server refuses the answer and neither request changes

### Requirement: Durable request history has bounded admission

The request owner SHALL retain at most 256 requests per run, including answered requests. It SHALL serialize decisions through a bounded queue and replay only committed request events. Replayed records MUST retain their run, origin, scope and approval level. Invalid or duplicate records MUST fail replay. The complete opening and answered records MUST fit the same byte allowance used during replay before they are appended. A refused record MUST leave the committed cursor unchanged and permit a valid retry. This journal contract does not replace transport authentication or external-action reconciliation.

#### Scenario: Large admitted request replays after restart

- **WHEN** a near-limit complete request and its answer fit the record allowance
- **THEN** a newly loaded engine returns the same decision

#### Scenario: Opening metadata exceeds its remaining bytes

- **WHEN** an input fits but its complete opening record exceeds the allowance
- **THEN** creation fails before any journal append
- **AND** a smaller valid request can still be created

#### Scenario: Answer exceeds its remaining record bytes

- **WHEN** an answer input fits but its complete answered record exceeds the allowance
- **THEN** the pending request and committed cursor remain unchanged
- **AND** a smaller valid answer can still be recorded

#### Scenario: Request allowance after an answer

- **WHEN** the run reaches its request allowance and an existing request has an answer
- **THEN** another request is refused without dropping earlier requests

#### Scenario: Request mutation queue is full

- **WHEN** the request mutation queue has reached its allowance
- **THEN** another mutation is refused before it changes the journal

#### Scenario: Changed scope in request history

- **WHEN** a durable answer changes the scope from its opening record
- **THEN** replay refuses that history instead of authorizing the changed operation

#### Scenario: Request append fails before admission

- **WHEN** a request append fails before changing the journal
- **THEN** no request is visible and a valid retry can create one

### Requirement: Request creation retries retain identity

A request creation SHALL carry a caller-supplied request id. Retrying the same run, id, origin and operation MUST return the existing request, including its answer. Changed scope or origin with that identity MUST conflict. Identical local request ids in different runs MUST retain separate decisions.

#### Scenario: Request response is lost after durable append

- **WHEN** request creation commits but its response is lost
- **THEN** an identical retry returns that request without another opening event

#### Scenario: Request id reused for changed scope

- **WHEN** a caller retries an existing request id with a changed operation scope
- **THEN** creation conflicts and preserves the original request

#### Scenario: Same request id in two runs

- **WHEN** two runs have an identical local request id and only one has approval
- **THEN** the second run still requires its own decision

### Requirement: HTTP decisions use authenticated scoped selectors

The local HTTP service SHALL create requests through `POST /runs/<run id>/requests` and inspect one request through `GET /runs/<run id>/requests/<request id>`. Answering through `POST /requests/<request id>/answer` MUST require the explicit run, matching request id, observed version, decision, reason and answering client label. Actor authority MUST come from the authenticated credential and MUST NOT be supplied in the body. These operations MUST use the engine-owned ledger and per-run operation queue. Invalid JSON and selectors MUST return input errors; absent requests MUST return 404; insufficient authority MUST return 403; stale, repeated or expired answers MUST return 409. These routes record decisions and do not themselves execute external actions.

#### Scenario: Native credentials decide at their permitted level

- **WHEN** an agent answers a main request or a person client answers a human request
- **THEN** the durable decision records the authenticated authority and answering client
- **AND** denial remains a denial without granting permission

#### Scenario: HTTP retries and restart preserve one decision

- **WHEN** creation is retried, the daemon restarts or two answers arrive together
- **THEN** the original request is retained and only one answer is committed

#### Scenario: HTTP answer refuses substituted authority or selectors

- **WHEN** a client forges authority, names another run or mismatches its path and body request ids
- **THEN** the request remains unanswered

#### Scenario: HTTP invalid decisions have explicit statuses

- **WHEN** an answer is stale, repeated, expired, absent or insufficiently authorized
- **THEN** the response uses its specified conflict, absence or permission status
- **AND** malformed JSON and unsupported selectors fail as input without changing the request

### Requirement: MCP request controls use authenticated decision transport

The MCP bridge SHALL expose titan_request_open, titan_request_read and titan_request_answer through strict shared input schemas and the typed authenticated HTTP client. Successful calls MUST return the complete request and state waiting or answered, matching its durable answer. Opening MUST return without waiting for a decision. Identical creation retries MUST retain an existing answer. Answers MUST require exact run and request ids, observed version, decision, reason and client. MCP MUST use only the agent credential and MUST NOT accept caller authority or select the person token after refusal. Errors MUST retain typed transport error codes in MCP error results. These controls do not by themselves continue native sessions.

#### Scenario: MCP opens pending requests without granting permission

- **WHEN** a client opens a main-level or human-level request through MCP
- **THEN** the call returns state waiting and the committed request without an answer

#### Scenario: MCP retries retain an existing decision

- **WHEN** identical creation is retried before or after the first answer
- **THEN** MCP returns the same durable request and its matching waiting or answered state

#### Scenario: MCP answers use explicit observed identity

- **WHEN** a client approves or denies a main-level request or reconnects before answering
- **THEN** MCP and HTTP observe the same first decision and main-level answering actor

#### Scenario: MCP cannot promote an agent to person authority

- **WHEN** an agent answers a human request or supplies an authority field
- **THEN** MCP refuses the operation and the durable request stays unchanged

#### Scenario: MCP refuses invalid request selectors and answers

- **WHEN** a client supplies a wrong run, missing request, stale or repeated answer, missing reason or invalid opening scope
- **THEN** the tool returns an error without changing an existing request or creating an invalid one

### Requirement: Effective approval policy is frozen into each run

Central configuration SHALL expose every request kind under approvals with its default level and source. Only the home configuration MAY lower configurable kinds. Project files, explicitly selected files, workflow settings and CLI assignments MUST preserve or raise inherited levels. Protected human kinds MUST reject lower levels before backend loading. Newly resolved run configuration SHALL record the complete effective policy and its hash. Request opening and replay MUST use that frozen map, rather than later home settings. Request events MUST retain the selected snapshot's configuration hash and expected level. Legacy run snapshots without the optional policy field MUST retain their serialized values and hashes and use the original default policy. Configuration errors SHALL identify the source and field using plain text. This requirement does not implement automatic decision rules or external operation execution.

#### Scenario: Policy values and sources cross configuration layers

- **WHEN** an owner changes a configurable kind and a project, workflow or CLI setting raises its inherited level
- **THEN** effective configuration exposes all kinds with the merged values and their sources, and CLI check accepts valid raised workflow policy

#### Scenario: Lower layers cannot undo owner authority

- **WHEN** a project, explicitly selected file, workflow or CLI setting lowers an inherited level, or any owner setting lowers a protected human kind
- **THEN** configuration fails before submission with a plain error, and unknown kinds and levels are refused

#### Scenario: Frozen request policy survives reload

- **WHEN** a run opens and answers a request under an owner-selected policy and home settings later change
- **THEN** reload preserves the recorded level and decision, insufficient authority is refused and changed configuration or forged levels in request history fail replay

#### Scenario: Legacy policy hashes remain unchanged

- **WHEN** a journal created without an approvals field is loaded by the updated engine
- **THEN** its configuration values and hash remain unchanged and existing requests use the original default policy

### Requirement: Escalation preserves one durable pending request

The request ledger SHALL pass only a pending main-level request to human authority using exact run, request and observed version plus authenticated actor and reason. Escalation SHALL share answer serialization, preserve scope, origin, creation time and expiry, and append one passed_up event containing its bounded actor, reason and time audit. The request MUST remain unanswered at the next version and require human authority afterward. A later answer MUST advance the observed version and preserve its escalation audit. Complete record admission MUST finish before append. Replay MUST reject fabricated openings, altered immutable data, duplicate escalation, invalid audit authority and answers dated before escalation. Existing records without escalation metadata MUST remain readable. This ledger contract does not by itself expose escalation commands or continue a native session.

#### Scenario: Person decides after durable escalation

- **WHEN** a main request is passed up and its owner reloads before approval or denial
- **THEN** scope and origin remain unchanged, the pending version requires human authority and the person's later answer retains the audit at its next version

#### Scenario: Escalation and answer have one serialized winner

- **WHEN** escalation and a main-level answer arrive together in either order
- **THEN** exactly one succeeds, the other conflicts and a request that became human cannot receive the main answer

#### Scenario: Failed escalation leaves a recoverable decision

- **WHEN** append fails, complete record bytes exceed admission or an escalation response is lost after commit
- **THEN** failed admission leaves cursor and request unchanged, while a lost response reloads exactly one committed event and an old-version retry conflicts

#### Scenario: Escalation audit cannot rewrite history or delivery

- **WHEN** scope, origin, creation time, actor or audit changes in request history, or delivery state or file bytes change after escalation
- **THEN** replay or artifact inspection fails, while valid ordinary and executable deliveries remain inspectable after the person decides

### Requirement: Escalation controls share the durable request transition

HTTP POST /requests/REQUEST_ID/escalate, CLI answer --to-person and MCP titan_request_escalate SHALL use the same strict run, request, observed version, client and reason submission. The server MUST assign actor authority from authentication and refuse supplied authority. Agent-facing clients MUST use the agent credential. Successful responses MUST retain the pending human request and its escalation audit at the next version. CLI MUST reject missing companions and a combined decision before creating its client. A stale or repeated escalation MUST leave the retained request unchanged. Person approval or denial after restart MUST use its new observed version. These controls do not resume native sessions or execute an operation.

#### Scenario: All escalation surfaces retain one pending scope

- **WHEN** HTTP, CLI or MCP passes a pending resource request to the person
- **THEN** each returns the same scope and origin at human level with no answer and one passed_up event
- **AND** waiting listing retains that record and the agent credential cannot answer it

#### Scenario: Invalid escalation controls preserve the selected record

- **WHEN** an escalation has missing companions, forged authority, a wrong run, a stale version or an already answered request
- **THEN** it fails without changing the selected record or journal cursor
- **AND** invalid CLI arguments fail before client creation

#### Scenario: A person decides the escalated request after restart

- **WHEN** the server restarts after escalation and a person approves or denies the observed pending version
- **THEN** it retains the escalation audit, commits one decision at the next version and refuses an agent answer

#### Scenario: Escalation clients reject substituted responses

- **WHEN** a response changes the audit reason, actor, authority or expected version, omits the audit or already has an answer
- **THEN** the typed client refuses it as a transport error
- **AND** invalid, excessive or accessor input fails before transport

### Requirement: Optional execution origins retain the asking phase

A request MAY carry origin.execution with step_id, attempt, phase and execution_id. When supplied, admission SHALL bind these fields and harness_session_id to the selected run's current running phase and client. The engine MUST recheck its live state at append so completion during asynchronous admission cannot create a late request. Opening replay MUST validate the recorded origin against that event's state. Later phase completion MUST NOT invalidate a retained request, its answer or an exact creation retry. These labels establish recorded lineage; they MUST NOT replace authentication or imply native tool registration, pause or continuation.

Bound requests SHALL use request format two and upgrade the enclosing run header to format two before their opening is serialized. New unbound runs and legacy requests MUST retain format one. A synchronous journal admission refusal MUST restore the live header before a corrected retry. Optional execution metadata MUST NOT acquire a parse-time default. A previous installed runtime that cannot read format two MUST refuse inspection and resume without changing that journal, while still reading legacy runs. This is a compatibility fence, not an automatic migration or downgrade procedure.

#### Scenario: Worker and checker requests retain their origins

- **WHEN** a worker or checker opens an execution-bound request and its phase later finishes
- **THEN** reload, exact creation retry and a decision retain the original step, attempt, phase, execution and native session
- **AND** the request and enclosing run use format two

#### Scenario: Stale execution origins cannot open requests

- **WHEN** a new request names another step, attempt, phase, execution, client or native session, or its phase has completed
- **THEN** admission refuses it without adding a request or advancing the committed journal

#### Scenario: Completion races and forged opening history are refused

- **WHEN** a phase finishes while opening admission holds an older committed snapshot, or opening history substitutes its execution
- **THEN** live append refuses the late opening and replay refuses the forged history

#### Scenario: Previous runtimes refuse upgraded request runs

- **WHEN** an actual previous installed executable opens the home containing a format-two request run and a legacy run
- **THEN** upgraded inspection and resume fail without changing its journal
- **AND** the legacy run remains readable with its original format

#### Scenario: Refused journal admission preserves the live format

- **WHEN** a worker or checker request fits its own allowance but the complete journal record exceeds its byte limit
- **THEN** opening fails without a request, a cursor advance or a changed live header
- **AND** a corrected retry of the same request can commit at format two

#### Scenario: Failed executions cannot open new requests

- **WHEN** a worker or checker has recorded an operational failure or a scheduled retry, even while its step still appears running
- **THEN** a new execution-bound opening fails without changing requests or the journal cursor
- **AND** live append also refuses an opening that held a healthy snapshot while that execution failed

#### Scenario: Recovered executions clear old diagnostics before admission

- **WHEN** a failed worker or checker starts its next execution in the retained session
- **THEN** its execution-start checkpoint clears the old diagnostic and retry time
- **AND** a request from that new execution is admitted without adding a quality attempt or refutation

#### Scenario: Historical recovery diagnostics do not invalidate retained requests

- **WHEN** an existing opening recorded the older format's permitted recovery diagnostic or retry time
- **THEN** reload and exact creation retry retain that request
- **AND** the stricter live admission rule does not reinterpret its historical opening as corruption

### Requirement: Structured request turns retain their asking session

A persona MAY enable request_turns. Titan SHALL then require a strict result and requests envelope. Waiting MUST use a null result and a nonempty array of request descriptions. Normal completion MUST use an empty array and the persona's normal result format. Titan SHALL assign request identities and execution origins. A complete request batch, its asking execution and the phase's pending identities MUST commit atomically. Batches MUST respect the frozen run request allowance and existing record and journal byte limits, with a one-MiB complete-batch allowance. Existing personas and journals MUST NOT acquire a default field.

Only the asking step SHALL wait, and active capacity MUST be released. Independent steps MUST remain runnable. Unanswered resume MUST start no native turn. Answered continuation SHALL retain the native session and quality attempt without spending operational recovery allowance. Decisions MUST reach only their asking phase. The pending checkpoint SHALL use run format three, and subsequent decisions MUST NOT downgrade it. Older-runtime refusal, installed process recovery and native MCP registration require their own acceptance evidence.

#### Scenario: A structured request releases its asking step

- **WHEN** a worker or checker finishes its native turn with a valid request batch
- **THEN** its phase and every request are committed together and the run can become waiting
- **AND** independent peer work completes while dependent work stays pending

#### Scenario: Answers continue with no recovery allowance

- **WHEN** every request from a waiting phase is approved or denied and recovery allowance is zero
- **THEN** the retained session receives only that phase's answers and completes the same quality attempt
- **AND** its retry count and quality evidence remain unchanged, including after reload

#### Scenario: Unanswered resume starts no turn

- **WHEN** a run resumes with one or more unanswered phase requests
- **THEN** it remains waiting without starting another execution

#### Scenario: Invalid or excessive batches publish no requests

- **WHEN** a turn supplies both a result and requests, or its complete batch exceeds the frozen count allowance
- **THEN** it blocks without publishing a request or quality refutation

#### Scenario: Atomic publication survives acknowledgement loss

- **WHEN** the complete waiting event commits and its acknowledgement is lost
- **THEN** reload retains exactly one batch and its answers continue the original session

#### Scenario: Journal refusal restores the pending checkpoint

- **WHEN** synchronous journal admission refuses the complete waiting event
- **THEN** no request or pending checkpoint is published and the live run format is restored

#### Scenario: Forged request turns fail replay

- **WHEN** a recorded batch changes its asking execution or its pending membership omits a request
- **THEN** replay refuses the changed history

#### Scenario: Native SDKs carry structured request turns

- **WHEN** the pinned Codex or Claude SDK executes a request turn against its versioned executable fixture
- **THEN** a worker or checker resumes its retained native identifier after reload and receives the answer
- **AND** unanswered resume starts no extra native call and malformed envelopes publish no request

#### Scenario: Installed request turns survive daemon replacement

- **WHEN** an installed Codex or Claude worker or checker waits and its daemon stops gracefully or dies
- **THEN** the installed CLI resumes its retained native identifier after a CLI, HTTP or MCP answer
- **AND** approval and denial reach that session with zero recovery allowance, one quality attempt and unchanged source files

#### Scenario: Installed unanswered resumes spend no execution

- **WHEN** the installed CLI resumes an unanswered worker or checker after daemon replacement
- **THEN** it exits three while the same request and native execution remain waiting
- **AND** a later answer still permits the original session to complete

#### Scenario: Previous runtime refuses pending request turns

- **WHEN** the previous format-two installed runtime inspects or resumes a worker or checker format-three waiting run
- **THEN** it refuses the unsupported format without changing its journal bytes
- **AND** format-one and format-two control runs remain readable

#### Scenario: Waiting origins stay closed during continuation admission

- **WHEN** a continuation is validating its next turn and an independent decision commits the running step state
- **THEN** a new request using the previous waiting execution is refused without changing the journal cursor
- **AND** the independent decision stays outside the asking phase's answer prompt

#### Scenario: Parallel request turns continue independently

- **WHEN** Codex and Claude worker or checker phases wait in the same parallel wave
- **THEN** answering one lets only that step finish while the other remains waiting and their join stays pending
- **AND** after daemon death the other answer finishes its retained session without repeating the completed seed or peer
- **AND** an unanswered resume spends no execution in either phase

#### Scenario: Complete turn members fit before publication

- **WHEN** a worker or checker request member and its added metadata fit the central 512 KiB record allowance
- **THEN** ledger admission passes the complete member to the supplied atomic publisher exactly once
- **AND** admission alone does not append a journal event

#### Scenario: Turn member metadata exceeds its allowance

- **WHEN** a strict input fits its allowance but the complete worker or checker request record exceeds 512 KiB
- **THEN** ledger admission refuses it before calling the publisher
- **AND** no request or journal cursor is changed

#### Scenario: New turn members require current lineage and expiry

- **WHEN** a new turn member names another execution or native session, or has already expired
- **THEN** ledger admission refuses it before calling the publisher
- **AND** the existing run and request inventory remain unchanged

### Requirement: Pending request files are journal projections

Titan SHALL publish requests.json in each run root with schema_version, run_id, through and the complete pending request set. The through cursor SHALL identify the committed journal prefix used to build that file. Answered requests MUST be absent; escalated pending requests MUST retain their audit. The file MUST NOT authorize operations or replace journal history. Request mutations MUST publish the projection before acknowledgement. Failed publication MUST fence subsequent committed reads and writes until explicit journal reload. Loading a run MUST rebuild the projection from validated journal history before admitting that run. Missing, stale or malformed projection bytes MUST NOT change the recovered requests.

Encoding and file writes SHALL use bounded byte pages and a complete allowance derived from the maximum retained request count and record size. Temporary bytes MUST be removed on failure before rename. Failure after durable append or rename MUST be reconciled through the journal; it MUST NOT be treated as proof that the mutation did not happen.

#### Scenario: Decisions update the complete pending file

- **WHEN** a run opens requests whose complete JSON spans multiple pages, answers one and escalates another
- **THEN** requests.json contains exactly the pending records and the escalation audit after each acknowledged mutation
- **AND** approval and denial both remove only their answered record

#### Scenario: Request files rebuild without trusting old bytes

- **WHEN** a run loads with missing, stale or malformed requests.json
- **THEN** Titan rebuilds the exact pending set from its validated journal
- **AND** editing the file cannot change a retained decision or grant an operation

#### Scenario: Failed request publication requires reconciliation

- **WHEN** projection publication fails after a request opening or answer is durably appended
- **THEN** the mutation is not acknowledged and the writer refuses committed reads and later writes
- **AND** explicit reload recovers the one durable mutation and rebuilds the pending file without duplication

#### Scenario: Failed projection repair prevents run admission

- **WHEN** a run's projection cannot be rebuilt during load
- **THEN** the engine refuses to retain or admit that run
- **AND** after the filesystem problem is repaired, another explicit load restores its journal-derived pending records

### Requirement: A run starts only on a backend the person named

A run MUST start only on a backend that the person named for that run, with `--backend` or in the workflow file. Titan MUST NOT pick another backend or provider by itself. When the named backend hits a limit, the run MUST become `blocked` with the reason and the reset time. Switching to another backend MUST need `titan resume <run> --backend <name>` from the person or the main agent they told to do it.

#### Scenario: Limit does not switch backend

- **WHEN** a run on `claude-sdk` hits a usage limit
- **THEN** the run is `blocked` with reason `limit`
- **AND** no run starts on any other backend

#### Scenario: No backend named

- **WHEN** a run starts with no backend named by the person
- **THEN** `titan` refuses to start and names the missing choice

### Requirement: Titan takes part in its own delivery

The tasks of this change MUST be done by Titan workflows, with the main agent and the person as equal members of the same swarm. Each run MUST name the task it delivers. A commit MUST list any change that a person or the main agent made by hand and not through a run. The skills MUST tell the main agent to deliver this way.

#### Scenario: Commit lists hand changes

- **WHEN** a commit holds a change that no run wrote
- **THEN** the commit message lists that change as written by hand

#### Scenario: Run files are recorded

- **WHEN** a run writes a file into the project
- **THEN** the path of that file is added to `.titan/written-by-runs.json`
- **AND** a commit that holds only recorded files needs no hand-change line

### Requirement: The skills carry the working rules

The Titan skill and the delivery skill MUST state these rules in plain language. Run only on a backend the person named. Search both hubs first. Check `titan requests`. Resume after a limit. Read the cost and the cache share in `titan status` before a large batch. Let runs write to the project. List hand changes in the commit.

#### Scenario: Skill names the rules

- **WHEN** a person reads the Titan skill file
- **THEN** each rule above has its own sentence
- **AND** `check-plain.py` passes on the file
