## ADDED Requirements

### Requirement: Run the groups in the stated order

`titan run <file>` SHALL run the items of a sequential group one after another. It SHALL make all items of a parallel group ready together. It MUST start them as places become free under `limits.max_parallel` and wait until all finish before going on.

#### Scenario: Parallel steps overlap

- **WHEN** the fake adapter takes 200 ms for each answer and a parallel group holds steps `b` and `c`
- **THEN** the run record shows that `c` started before `b` finished

#### Scenario: Sequential steps do not overlap

- **WHEN** a sequential group holds steps `a` and `d`
- **THEN** the run record shows that `d` started after `a` finished

### Requirement: Only surviving results move on

`titan` MUST pass a step's output to a later step only after the result survived falsification. A step's task SHALL contain the kept outputs named in its `inputs` map.

#### Scenario: Outputs flow through inputs

- **WHEN** step `fix` has `inputs: { cause: cause.root_cause }` and step `cause` kept `root_cause` "the clock is in UTC"
- **THEN** the task text of `fix` in the run record contains "the clock is in UTC"

### Requirement: A failed step stops its branch

When a step fails, `titan` MUST NOT start any step that uses it, or any step after it in the same sequential group. Other branches of a parallel group SHALL finish. The run MUST end with the status `failed` and exit code 1.

#### Scenario: One parallel branch fails

- **WHEN** steps `b` and `c` run in parallel, `b` fails, and step `d` comes after the group
- **THEN** `c` finishes, `d` does not start, and `titan` exits with code 1
- **AND** `result.md` names `b` as the failed step with its last evidence

### Requirement: Every run writes a run record

`titan` SHALL write each run to `.titan/runs/<run id>/`. The folder MUST hold:

- `workflow.yaml`: a copy of the workflow file;
- `events.jsonl`: one JSON line for each agent start, answer, verdict, retry and step end;
- `board.jsonl`: every message and request between personas and the main agent;
- `steps/<step id>/`: the task, each candidate, each verdict and the kept result;
- `result.md`: the goal, the final result, and each step with its outcome and number of attempts.

#### Scenario: Record after a passing run

- **WHEN** `titan run examples/business-plan.yaml --harness fake --fake-script tests/business-plan.answers.yaml` finishes
- **THEN** `.titan/runs/<run id>/` holds `workflow.yaml`, `events.jsonl`, `board.jsonl`, `result.md`, and one folder in `steps/` for each step
- **AND** `titan` prints the path of `result.md` and exits with code 0

### Requirement: A stopped run can continue

`titan resume <run id>` SHALL continue an interrupted, waiting, paused or blocked run after its blocking cause is resolved. A terminal failed run MUST require a new run. It MUST follow the accounting and terminal-state rules below. It MUST NOT run again a step that already survived.

#### Scenario: Resume after a crash

- **WHEN** a run is killed after step `cause` survived and during step `fix`
- **AND** `titan resume <run id>` runs
- **THEN** no new agent starts for `cause`
- **AND** `fix` continues its interrupted logical attempt from its latest consistent checkpoint, with every execution segment retained

### Requirement: Steps added during a run are run like the others

`titan` SHALL run a step that an agent added, as in spec hive-collaboration, by the same rules as a step in the file: inputs, falsification, retries and the run record. Each added step MUST get its own folder in `steps/`.

#### Scenario: Added step in the record

- **WHEN** an agent adds step `extra` during a run, and the run ends
- **THEN** `steps/extra/` holds its task, its verdicts and its kept result
- **AND** `result.md` lists `extra` and the step that added it

### Requirement: Show the cost before a run

`titan run --dry-run <file>` SHALL print the order and the agent bound for the current static plan. It MUST also print how many more steps agents can add under `limits.max_steps`. It MUST NOT start any agent, script, plug-in code or tool server. Plug-in capabilities not available from static metadata MUST be labeled unverified in dry-run output. For an unsplit persona step, the bound MUST be: candidates × max_attempts × (1 worker + number of persona falsifiers) + (candidates − 1) judge calls. A script worker contributes 0 worker agents. A known split MUST multiply this bound by its number of parts. An empty known split MUST contribute 0 agents. Main-agent discovery calls and orchestration reviewers outside this formula MUST be listed as unknown work. Unknown split sizes, `ask` calls, added steps and improvement rounds MUST be listed as unbounded by this formula. The output MUST NOT call this a whole-run maximum. It MUST label the formula as result-work calls excluding operational recovery. It MUST separately report the recovery allowance and unknown physical execution cost. A schema retry asks the same agent again, so it does not count as a new agent.

#### Scenario: Dry run cannot bound an unknown split

- **WHEN** a step splits over an output that the plan has not produced
- **THEN** the dry run says `split size unknown; no whole-run agent bound`
- **AND** no plug-in or tool server starts

#### Scenario: Dry run of a step with candidates

- **WHEN** a file has one step with `candidates: 2`, `max_attempts: 3`, two persona falsifiers and a judge
- **THEN** the dry run prints `static plan: at most 19 agents`, because 2 × 3 × (1 + 2) + 1 = 19
- **AND** it prints `agents can add up to 49 more steps`, with the default `max_steps` of 50
- **AND** no agent was started

### Requirement: Candidates negotiate shared live files

`titan` SHALL run candidate attempts and script falsifiers on the shared live project tree by default. Candidates MUST publish file-access intent to the blackboard and negotiate overlapping writes before execution. Independent scopes MUST remain eligible while a conflicting candidate waits. Waiting MUST release execution capacity and consume no vendor execution or quality attempt. Immutable candidate snapshots MUST retain the exact versions reviewed. Checks and later steps MUST bind their inputs to the kept evidence generation. Restoration after refusal MUST preserve newer external edits and record conflicts for reconciliation. Explicitly selected isolated mode MAY remain available for compatibility.

#### Scenario: Two candidates edit the same file

- **WHEN** candidates A and B request write access to `orders.ts` and only B survives
- **THEN** both use the same live project tree and the blackboard admits their conflicting writes in order
- **AND** each falsifier's evidence is bound to the exact candidate generation it reviews
- **AND** later steps receive B's kept generation while restoration preserves concurrent external edits

### Requirement: titan trace writes the run as spans

`titan trace <run id>` SHALL read `events.jsonl` of the run and write `spans.json` in the same run folder, with the package `@opentelemetry/sdk-trace-base`. A _span_ is one timed piece of work. The file MUST hold:

- one span named `invoke_workflow <workflow name>` for the run, with no parent;
- one span named `invoke_agent <persona name>` for each agent start, with the run span as parent;
- one span named `execute_tool <tool name>` for each tool call, with its agent span as parent.

Each span MUST have the attribute `gen_ai.operation.name`, with the first word of its name as the value. These names come from the OpenTelemetry rules for GenAI agent spans, which are still in development. `titan trace` MUST NOT send spans over the network.

#### Scenario: Spans of a run with a tool call

- **WHEN** a run of the workflow `fix-bug` has persona `coder` with one call of tool `read_file`, then persona `skeptic`, and `titan trace <run id>` runs
- **THEN** `spans.json` holds 4 spans
- **AND** `execute_tool read_file` has the parent `invoke_agent coder`
- **AND** `invoke_agent skeptic` has the parent `invoke_workflow fix-bug`

### Requirement: titan can send spans to a trace viewer

When the person sets `OTEL_EXPORTER_OTLP_ENDPOINT`, `titan` SHALL send the spans of each run that ends to that address over OTLP/HTTP with protobuf. _OTLP_ is the OpenTelemetry Protocol, the open format of trace viewers. The spans MUST be the ones of `titan trace`. Each span MUST also have the attributes `titan.run.id` and `titan.step.id` where they apply, `titan.check.verdict` for proof checks, `titan.falsify.verdict` for falsifiers, and `titan.cost_usd` where a backend reported a cost. A send that fails MUST print one warning and MUST NOT change the run's state or exit code. When the variable is not set, `titan` MUST send nothing.

#### Scenario: Spans reach a fake receiver

- **WHEN** a test sets `OTEL_EXPORTER_OTLP_ENDPOINT` to a fake OTLP receiver on 127.0.0.1 and runs a workflow with one persona, one tool call and one falsifier
- **THEN** the receiver gets 4 spans with the names of `titan trace` and the attribute `titan.run.id`

#### Scenario: The receiver is down

- **WHEN** `OTEL_EXPORTER_OTLP_ENDPOINT` names a port where nothing listens
- **THEN** the run ends with its own state and exit code, and `titan` prints one warning that names the address

### Requirement: Spans hold no prompt or answer text by default

The spans that `titan` writes or sends MUST NOT hold the text of prompts, tasks, answers or evidence. They SHALL hold only names, ids, times, counts, verdicts and costs. When the person sets `TITAN_TRACE_CONTENT=1`, `titan` MAY add the task and the answer text. A workflow file MUST NOT turn this on.

#### Scenario: Default spans hold no task text

- **WHEN** a run's task text is "Find the root cause in orders.ts" and `titan trace <run id>` runs without `TITAN_TRACE_CONTENT`
- **THEN** no span in `spans.json` holds the text "Find the root cause in orders.ts"

### Requirement: The final result and goal failure are explicit

The final result SHALL be an ordered map from terminal step ids to kept outputs. A terminal step has no dependants in the resolved execution graph. Terminal outputs MUST use plan order. All kept file changes MUST contribute to final file assembly, including those from intermediate steps. Split outputs MUST follow the split ordering in spec hive-collaboration. The result MUST include the hashes of kept file snapshots. Goal checks MUST run against that assembled result and its combined files. An operationally interrupted goal check MUST recover against the same assembly. A completed negative goal check MUST end the run as `failed`, with exit code 1 and its evidence. It MUST NOT retry an arbitrary step automatically. A new plan for that failure MUST use a new run id.

#### Scenario: Goal check fails after all steps pass

- **WHEN** every step passes but the completed final goal check semantically rejects the result as `not proven`
- **THEN** the run is `failed` with exit code 1
- **AND** the result keeps the step evidence and the failed goal check

### Requirement: Cancellation is durable and repeatable

`POST /runs/<run id>/cancel` SHALL record cancellation before acknowledging it. It MUST stop new work, cancel active sessions and scripts, and close their resources. The run MUST become `cancelled`, with CLI exit code 1. Repeating cancellation MUST start no work. Late answers MUST be recorded as ignored and MUST NOT publish files or hub changes. Restart MUST NOT resume a cancelled run.

#### Scenario: Late result after cancellation

- **WHEN** a worker returns after its run was cancelled
- **THEN** the run remains `cancelled` and the worker publishes no changes

### Requirement: Resume preserves accounting and completed evidence

Resume SHALL preserve every logical attempt, completed result, verdict and usage record. An interruption MUST retain its logical attempt id and create a new execution segment on continuation. A segment is one physical invocation within an attempt. It MUST NOT consume another result attempt or count as a refutation. Recovery MUST restore the latest consistent checkpoint under the recovery requirements below. A waiting session MUST continue with its answer without another result attempt. Exhausted completed result attempts MUST require a new run. Terminal failed, timed-out and cancelled runs MUST NOT reopen. Concurrent resume calls MUST start at most one continuation.

#### Scenario: Interrupted final attempt

- **WHEN** a candidate was interrupted during attempt 3 of `max_attempts: 3`
- **THEN** resume continues logical attempt 3 in a new execution segment and starts no fourth result attempt

#### Scenario: Duplicate resume

- **WHEN** two clients resume the same waiting run after its request was answered
- **THEN** only one continuation starts and its earlier usage remains in the run totals

### Requirement: Committed usage reports preserve every attempt

Engine, CLI `usage`, HTTP `GET /runs/RUN_ID/usage` and MCP `titan_usage` SHALL expose the same strict versioned report for an explicit run id. The report MUST bind its committed journal cursor and count physical executions, final usage records and executions without a final report. Known input tokens, output tokens and USD cost MUST each have a completeness flag. Missing values MUST remain unknown; no estimated price or zero cost claim may replace them. Any unreported execution MUST make every measure incomplete. Refuted attempts and operational continuations MUST contribute once across replay, with unchanged snapshots contributing no duplicate usage. Inconsistent history or numeric overflow MUST fail explicitly. Reading usage MUST start no agent. The history scan MUST retain only bounded phase cursors rather than a collection of events. Indexed reporting and partial native-stream normalization remain separate delivery work.

#### Scenario: Refuted attempts remain in totals

- **WHEN** a run completes three quality attempts and its report is read repeatedly or after reload
- **THEN** all six worker and checker usage records contribute exactly once through the committed cursor

#### Scenario: Interrupted execution remains incomplete

- **WHEN** an interrupted checker resumes and later reports final usage
- **THEN** the earlier physical start remains unreported and every measure remains explicitly incomplete

#### Scenario: Usage transports preserve exact selection

- **WHEN** CLI, HTTP and MCP inspect a run or select a missing run
- **THEN** they return its bound report or refuse the missing target without substituting another run

#### Scenario: Inconsistent usage cannot rewrite history

- **WHEN** a history scan encounters a changed usage prefix, shrinking counters, foreign origin, unknown phase or numeric overflow
- **THEN** inspection fails without presenting a valid total

### Requirement: Usage aggregation respects native counter scope

Raw SDK usage records SHALL remain unchanged. Aggregation MUST select the phase backend from the frozen persona, configuration default and run fallback in that order. Claude cumulative session measures MUST contribute only positive increases within each phase and quality attempt; Codex turn measures MUST remain additive. Each new quality attempt MUST retain the earlier total and begin an independent counter. An observed counter regression MUST retain the highest known subtotal and mark that measure incomplete. Null values MUST remain incomplete after later reports. Unreported physical starts MUST remain explicit even when later cumulative records include their usage. Native cost MUST be described as an SDK estimate rather than billing evidence. Hidden resets without an observed regression cannot be reconstructed from these records.

#### Scenario: Cumulative Claude turns survive reload

- **WHEN** three retained-session turns report cumulative usage through persona or default backend selection and the run is reloaded
- **THEN** the report retains the final session total once and the raw records remain unchanged

#### Scenario: Codex turn usage remains additive

- **WHEN** three Codex turns report increasing or identical per-turn values
- **THEN** every turn contributes independently before and after reload

#### Scenario: Counter regression cannot claim completeness

- **WHEN** an observed Claude measure drops or has an unknown value before a later report
- **THEN** its conservative known subtotal remains available and its completeness stays false without changing unaffected measures

#### Scenario: Quality attempts have independent session totals

- **WHEN** three Claude quality attempts complete worker and checker sessions before and after reload
- **THEN** each attempt contributes independently without replacing earlier totals

### Requirement: Duplicate resume preserves an active execution

Resume of a nonterminal run with active work SHALL return that same work without resetting running nodes, appending a resume event or changing phase accounting. Its current execution origin MUST remain valid for request admission. Completed parallel peers MUST remain complete. The existing refusal for terminal runs MUST remain in force. A duplicate control does not start a continuation or replenish recovery allowance.

#### Scenario: Active worker and checker origins remain valid

- **WHEN** repeated resume calls arrive while a worker or checker is held inside its current turn
- **THEN** the node remains running with its original session, execution and journal cursor
- **AND** its exact execution origin can still open a request and the phase executes only once

#### Scenario: Duplicate resume preserves a completed peer

- **WHEN** repeated resume calls arrive after a parallel peer finishes while another worker or checker remains active
- **THEN** the active phase stays running and the completed peer, quality attempts and retry counts remain unchanged

#### Scenario: Native daemon controls retain the active origin

- **WHEN** HTTP controls repeatedly resume an active Codex or Claude stub process before cancellation or daemon death
- **THEN** its committed snapshot remains unchanged and its exact current request origin is accepted
- **AND** existing descendant termination and same-session recovery or terminal cancellation checks still pass

### Requirement: Parallel files merge only without conflicts

A later step SHALL receive a combined snapshot of its kept predecessors. Changes along one dependency chain MUST use the latest descendant version. Assembly MUST compare changes against their recorded common input snapshot. Non-overlapping changes from parallel branches MUST combine. Different changes to the same path from unrelated branches MUST fail assembly with a conflict naming both producing steps. Identical bytes at one path MAY combine. `titan` MUST NOT ask a model to silently choose a file or alter the person's tree. The main agent MUST use a new sequential or merge step to resolve the conflict in a new plan.

#### Scenario: Parallel kept files conflict

- **WHEN** two parallel kept steps write different bytes to `orders.ts` and a later step needs both
- **THEN** that later step starts no agent and the run fails with the two producing step ids
- **AND** both original kept snapshots stay available

#### Scenario: Sequential file changes use the later result

- **WHEN** step A changes `orders.ts` and its dependent step B changes that file again
- **THEN** final assembly uses B's kept file without reporting a parallel conflict
- **AND** both earlier snapshots remain in the record

### Requirement: Projects can host independent concurrent runs

Every run SHALL use a unique root for its durable evidence, checkpoints and run-owned temporary files. File, worktree, branch, temporary-path and process identities MUST include the run id where collisions are possible. Two runs MAY use the same project and workflow. In default live mode their agents and scripts MUST use the shared project tree and negotiate overlapping file scopes through the blackboard. Independent scopes MUST remain eligible. Separate execution copies MAY be used only when isolated mode is explicitly selected. Neither run MAY alter another run's retained snapshots. Completion, cancellation and cleanup MUST target only the named run and preserve shared project contents. Combining retained cross-run result artifacts MUST require a separate explicit operation; ordinary live execution MUST NOT require applying a copied result.

#### Scenario: Two runs edit the same project path

- **WHEN** two runs from the same project edit `src/value.ts` to different values
- **THEN** the conflicting live scopes yield and continue in admission order on the same project tree
- **AND** each run retains its own immutable result evidence without overwriting the other run's snapshots

#### Scenario: Cleanup while another run is active

- **WHEN** run A cleans up its worktrees while run B remains active in the same repository
- **THEN** B retains its folders, processes and snapshots

### Requirement: Queue and trace records explain shared capacity

Run events SHALL record queue entry, admission, slot release and the reason for waiting. Spans MUST carry run, client and execution ids; harness session ids MUST be included when provided. Queue time MUST remain in elapsed wall time and deadline accounting. Reports MUST separate queue time from active execution time. Shared overview totals MUST count each execution once, including linked evaluations. A failed or disconnected observer MUST NOT stop execution.

#### Scenario: One run waits behind another

- **WHEN** A holds the only server slot while B queues and an observer disconnects
- **THEN** B's record reports queue duration and admission; B continues after A releases its slot without that observer

### Requirement: Ready nodes run without group barriers in graph mode

The runner SHALL admit every ready graph node under shared capacity and per-run limits. A node MUST become ready only when all dependencies survived and its inputs and files are assembled. Unrelated branches MUST continue while another branch waits, recovers or fails. Failed dependencies MUST mark their descendants `skipped_dependency`, never refuted. Operationally blocked ancestors MUST keep descendants pending. A run with unresolved blocked work MUST remain nonterminal, even after other branches finish. Step count and nesting limits MUST come from configuration, not a fixed number of groups.

#### Scenario: Independent branch passes a recovering node

- **WHEN** B is recovering, C survives and D depends only on C
- **THEN** D runs while B waits; a later join still waits for B

#### Scenario: Long mixed plan

- **WHEN** a validated 40-node plan mixes joins, fan-out and sequential chains below configured limits
- **THEN** every node executes by dependency readiness without a fixed depth or width restriction

#### Scenario: Rejected ancestor is not a rejected descendant

- **WHEN** B exhausts completed result attempts and D depends on B
- **THEN** D is skipped_dependency with no persona refutation and independent ready work finishes

### Requirement: Interruptions are durable recoverable execution states

The runner SHALL classify rate limits, temporary transport loss, quota exhaustion, missing credentials, session loss and process exits separately from completed content verdicts. Unknown causes MUST block with evidence rather than invent a refutation. States MUST include `recovering`, `blocked` and `paused`. Waiting, recovering, blocked and paused MUST be nonterminal. Recovery MUST release slots after owned sessions are confirmed stopped and preserve dependency progress. Unknown remote executions MUST retain backend reservations until reconciled. Hard run deadlines and explicit cancellation MUST remain terminal under existing rules. Reports MUST retain actual usage, physical starts, unknown costs, interruption causes and retry dates. Result-attempt counters and quality measures MUST exclude operational interruptions.

#### Scenario: Rate limit on final result attempt

- **WHEN** attempt 3 receives a vendor rate limit with a retry date
- **THEN** the run recovers or blocks with that date, keeps attempt 3 and adds no refutation

#### Scenario: Unknown agent exit

- **WHEN** a worker exits before a complete answer without a classified cause
- **THEN** the step blocks with its exit evidence, preserves files and makes no content verdict

#### Scenario: Hard quota exhaustion

- **WHEN** a backend reports exhausted quota without a reset date
- **THEN** the run blocks without busy retries and unrelated eligible work continues

#### Scenario: Interruption after a completed answer

- **WHEN** a complete candidate was saved before its falsifier process crashes
- **THEN** resume reuses that candidate and reruns only the incomplete check

### Requirement: Checkpoints preserve agent and workflow progress together

Titan SHALL commit checkpoint manifests at completed tool, message, artifact and verdict boundaries before acknowledging them. Snapshot files MUST become durable before an atomically published manifest and board reference. Recovery MUST verify hashes before restoring any session or mutable working folder. Each manifest MUST bind run, step, split part, candidate, logical attempt, execution, persona version, backend and session identities. It MUST also bind transcript position, input and working-file hashes, pending requests, action journal, effective configuration and usage. Partial streams MUST remain partial and MUST NOT become outputs. Native session restoration MUST target its saved id, never the most recent session. Recovery MUST verify that vendor history and files refer to the same committed boundary. Each replacement segment MUST restore into an exclusively owned working folder, protected from writes by earlier executions. A backend-required path MUST NOT be reused while an earlier writer may remain active. A missing or inconsistent checkpoint MUST block. Earlier consistent checkpoints MAY be selected only after reconciling later effects. Recovery MUST NOT claim to restore unrecorded model reasoning or an interrupted machine instruction.

For default live execution, exclusive ownership refers to the negotiated writable file scope in the shared project tree. Recovery MUST NOT substitute an isolated project copy. Earlier executions must stop or relinquish the affected scope before replacement dispatch. Independent scopes remain eligible for concurrent work. Snapshot and session consistency checks remain required.

#### Scenario: Resume edited files and conversation

- **WHEN** an agent saved a code edit and tool result before the host restarted
- **THEN** resume restores that file snapshot and the matching saved session without rerunning survived steps

#### Scenario: Candidate bytes cannot replace their committed digest

- **WHEN** candidate files and their sidecar hash change after worker completion
- **THEN** resumed review, dependency assembly and publication compare the files with the digest committed in the worker phase
- **AND** a mismatch blocks before further agent work without changing completed phases, the logical attempt or refutations
- **AND** records created before this digest field retain their existing sidecar verification without adopting a new commitment from mutable files

#### Scenario: Attempt input is verified before continuation

- **WHEN** a root or dependent worker or checker resumes after restart
- **THEN** its captured input must match the verified base and surviving ancestor snapshots
- **AND** a missing or changed input blocks before another execution, without changing completed phases, the logical attempt or refutations

#### Scenario: Attempt input is verified before publication

- **WHEN** a worker or checker changes the captured input while producing or checking a candidate
- **THEN** publication blocks without deriving delivered changes from that altered input
- **AND** the logical attempt, completed phases and quality counters remain intact

#### Scenario: Attempt input checks share finite admission

- **WHEN** an interrupted worker or checker needs its saved input verified
- **THEN** comparison uses the engine's finite active, pending and per-run parallel budgets
- **AND** occupied capacity with no waiting allowance refuses before reading input or advancing execution and quality counters

#### Scenario: Torn checkpoint manifest

- **WHEN** a crash leaves a manifest referring to a missing snapshot
- **THEN** recovery ignores no committed effect and blocks pending reconciliation or a verified earlier boundary

#### Scenario: Two saved vendor sessions

- **WHEN** two runs use the same backend and working project
- **THEN** each continuation opens its own explicit session id and transcript position

### Requirement: Recovery has finite independent allowances and execution ownership

Recovery SHALL use the frozen `recovery` settings, not `max_attempts`. Retry counters and next retry timestamps MUST survive restart. Transient retries MUST use bounded exponential backoff and jitter. A vendor Retry-After MUST never be shortened; an incompatible deadline MUST block or end by the existing deadline rule. Exhausted recovery allowance MUST block without fabricating a content verdict. Resume without an approved allowance change MUST NOT reset its counter. SDK retries MUST be disabled or reported within the same allowance. Only the current execution generation MUST publish results. A generation is a durable ownership number replaced on continuation. Losing the single-writer lock MUST stop admissions and publications. Late answers from older generations MUST remain ignored evidence.

#### Scenario: Restart cannot refill retries

- **WHEN** all configured recovery retries were used before a daemon restart
- **THEN** restart leaves the run blocked with the same counters until an authorized recorded change

#### Scenario: Stale worker answers after recovery

- **WHEN** a replacement execution commits before the interrupted process returns
- **THEN** the older answer cannot publish artifacts, answers or hub changes

#### Scenario: Vendor wait exceeds retry cap

- **WHEN** Retry-After requests an hour while the configured maximum delay is a minute
- **THEN** Titan does not retry after a minute and records the wait or blocking reason

### Requirement: File snapshots preserve executable intent

New snapshots SHALL record whether a regular file has any execute bit. Copying MUST preserve that intent with private mode 700 for executables and 600 for other files. Snapshots MUST NOT restore setuid, setgid, sticky bits, ownership or group/world permissions. File identities, candidate hashes, dependency assembly and parallel conflict detection MUST include executable intent. A source whose execute bit changes during verification MUST fail with a snapshot-change error. Historical non-executable tree hashes MUST remain valid; missing manifest metadata MUST default to non-executable. Previously discarded executable metadata cannot be reconstructed automatically.

#### Scenario: Copied scripts remain runnable

- **WHEN** an executable script is copied through a new snapshot
- **THEN** its copy runs with private executable mode while ordinary data remains private and non-executable

#### Scenario: Mode-only changes reach dependent steps

- **WHEN** a checked worker adds or removes executable intent without changing file bytes
- **THEN** dependent workers, checkers and final artifacts receive the new intent and the original project keeps its mode

#### Scenario: Changed execute flag invalidates its source manifest

- **WHEN** a source gains or loses execute permission after its manifest is captured
- **THEN** copying rejects it and no changed snapshot is accepted as the captured version

#### Scenario: Parallel executable intents conflict

- **WHEN** parallel checked candidates deliver identical changed bytes with different executable intent to one path
- **THEN** assembly blocks without choosing a mode, publishing artifacts or recording a quality refutation

### Requirement: Managed native turns fence their working folder

The initial Linux Codex and Claude release SHALL run each native turn in a managed process group on the same machine. A process-owned lease in the reserved workspace metadata directory MUST remain held until that host terminates. A replacement host MUST refuse an occupied lease. The daemon MUST acknowledge each native event only after its durable sink accepts it, with at most one unacknowledged event. Typed messages MUST obey a central byte budget. A missing ready handshake MUST stop at the owner-configured startup deadline.

Daemon connection loss and targeted cancellation MUST stop the managed group before replacement work is accepted. Native ids, partial files and the logical quality attempt MUST remain available for explicit recovery. Ordinary descendants that remain in that group MUST stop too. This is lifecycle control for trusted vendor programs, not an operating-system security boundary: a process that deliberately escapes its group is outside this guarantee. Other platforms require separate acceptance.

#### Scenario: Active native worker survives daemon replacement

- **WHEN** the daemon is killed while a Codex or Claude worker and its descendant are active
- **THEN** the previous group stops writing before a replacement resumes the saved native id and partial files
- **AND** the same logical attempt finishes with zero quality refutations
- **AND** the installed archive passes the same offline cases

#### Scenario: Cancellation stops the owned group

- **WHEN** the caller cancels an active Codex or Claude worker
- **THEN** its ordinary descendant stops and the cancelled run publishes no completed result
- **AND** the quality attempt and refutation count do not advance

#### Scenario: Candidate lease refuses another active host

- **WHEN** a new or resumed turn tries to use a working folder with an active host lease
- **THEN** it reports an operational interruption before another backend starts
- **AND** a separate working folder can run concurrently

#### Scenario: Native events wait for durable acknowledgment

- **WHEN** the daemon has not accepted the current native event or its durable sink fails
- **THEN** the host cannot continue the turn past that acknowledgment
- **AND** malformed, out-of-order and oversized messages cannot complete a successful turn
- **AND** a silent host cannot wait beyond its startup deadline

#### Scenario: Parent disappears before host registration

- **WHEN** the host's daemon connection is already closed when its disconnect listener is registered
- **THEN** the host immediately stops its group before processing a first native frame

#### Scenario: Native failure diagnostics obey their own budget

- **WHEN** an SDK fails with an oversized code or message, including Unicode text
- **THEN** the host bounds those strings before sending the failure frame
- **AND** retry eligibility and delay remain available without turning the failure into a quality refutation

### Requirement: Phase task persistence precedes native execution

The runner SHALL persist a phase's task record before opening its native session or advancing its execution or retry counters. A task-record failure SHALL block operationally on the same quality attempt with zero new refutations. After repair, explicit resume SHALL continue that phase, including after journal reload with zero recovery allowance. A completed worker SHALL remain complete when checker task persistence fails. Native sessions SHALL be closed after successful or failed use. Agent-phase lifecycle, checkpoint and recovery policy SHALL have a separate internal owner from graph scheduling.

#### Scenario: Ordinary phases close their native handles

- **WHEN** one or several checked steps complete without setup faults
- **THEN** every opened worker and checker handle closes and each step retains one quality attempt with zero refutations

#### Scenario: Worker task persistence fails before session creation

- **WHEN** a worker task record cannot replace an obstructing directory
- **THEN** no native handle opens and execution and retry counters stay zero
- **AND** repairing the path allows same-engine or reloaded resume with zero recovery allowance

#### Scenario: Checker task persistence preserves completed worker

- **WHEN** checker task persistence fails after a worker checkpoint
- **THEN** the completed worker remains unchanged and no checker execution is spent
- **AND** repairing the path allows same-engine or reloaded resume without repeating the worker or spending a quality attempt

### Requirement: Complete task prompts have a byte budget before execution

The runner SHALL incrementally encode each complete task prompt within 1 MiB of expanded UTF-8 JSON before persisting it or opening a session. The allowance SHALL include the goal, task, assembled input references and worker evidence or checker candidate. Unsupported JSON data SHALL fail explicitly. An oversized prompt SHALL block operationally without advancing that phase's execution, retry or quality counters. Journal reload and explicit resume SHALL preserve that block while the input remains oversized, without repeating completed phases. This prompt admission SHALL not replace the enclosing host frame's independent budget.

#### Scenario: Assembled worker and checker prompts fit

- **WHEN** a producer returns a 128 KiB value and a consumer receives one or six references to it
- **THEN** both worker and checker complete within the prompt allowance
- **AND** all four native sessions open once and the run passes

#### Scenario: Expanded worker input is excessive

- **WHEN** a consumer receives eight or twenty references to a producer's 128 KiB value
- **THEN** prompt encoding blocks before any consumer session opens and execution and retry counts remain zero
- **AND** reloaded resume keeps the completed producer and does not spend a quality attempt

#### Scenario: Checker input and candidate exceed the allowance together

- **WHEN** seven input references fit the worker prompt but adding the 128 KiB candidate exceeds the checker prompt allowance
- **THEN** the worker remains complete and no checker session or execution starts
- **AND** reloaded resume preserves that boundary without repeating completed work

### Requirement: Native frame admission precedes execution accounting

Managed native backends SHALL validate complete turn data before the runner advances execution or retry counters or opens a native session. This validation SHALL have no native tool or model side effects. The complete start frame SHALL include prompt, persona role, output schema, launch settings and identities within the central 1 MiB expanded JSON allowance. Frame checks SHALL count bounded segments without accumulating the whole serialized document. All frame paths SHALL reject unsupported JSON data explicitly. Direct transport calls SHALL also check complete start frames before process creation. Validation failure SHALL block the same quality attempt and remain unspent after journal reload while the invalid data remains.

#### Scenario: Both managed backends admit valid complete turns

- **WHEN** a workflow sends supported turn data to either pinned SDK through its controlled vendor program
- **THEN** worker and checker complete once and the run passes with one quality attempt

#### Scenario: Excessive start frames launch no host

- **WHEN** an oversized prompt or JSON escape expansion makes a direct transport start frame exceed 1 MiB
- **THEN** validation fails before its process factory is invoked
- **AND** supported structured and Unicode frames remain unchanged while undefined or non-finite frame data fails explicitly

#### Scenario: Excessive role data spends no runner execution

- **WHEN** either managed backend receives a role whose complete start frame exceeds its allowance
- **THEN** no native session opens and execution and retry counts remain zero
- **AND** journal reload and resume preserve that blocked phase and its quality attempt

### Requirement: New interruption diagnostics stay outside quality evidence

New step interruptions SHALL preserve their cause in phase status or the step-blocked event. They MUST NOT append that diagnostic to NodeState.evidence or to the prior_refutations supplied to a later worker attempt. Same-engine and reloaded recovery MUST retain the logical attempt and refutation count until an actual quality verdict occurs. A later refutation SHALL add only its quality evidence. This contract does not rewrite evidence already stored by older implementations.

#### Scenario: A recovered interruption does not enter a later quality prompt

- **WHEN** a worker or checker is interrupted, resumes in the same engine or after reload, and the candidate is then refuted
- **THEN** the next worker prompt contains only the actual quality evidence
- **AND** the journal retains the original interruption cause and the quality attempt advances only for the refutation

#### Scenario: Repeated interruptions do not accumulate quality evidence

- **WHEN** worker or checker recovery is interrupted again before any quality verdict
- **THEN** it remains blocked with its diagnostic, the same logical attempt and zero new refutations
- **AND** its quality evidence remains empty and no artifacts are published

### Requirement: Recovery backoff is visible without holding a node slot

A stopped execution waiting for its durable retry date SHALL release both physical agent capacity and its per-run node slot. Pending retry work MUST keep its native session, phase, files, execution count, recovery allowance and quality attempt. The scheduler MUST admit independent ready nodes under the same limits and MUST not admit a retry before its recorded date. The committed run status MUST be recovering when retry waits remain and no node is executing, and running while an independent node executes. Pause, cancellation and deadlines MUST interrupt the scheduler wait. Resume and reload MUST retain the retry date and counters. Cancellation and the existing hard deadline MUST remain terminal.

#### Scenario: Worker and checker waits retain their checkpoints

- **WHEN** a worker or checker enters backoff, is paused, optionally reloaded and resumed before its retry date
- **THEN** its committed status returns to recovering without a new physical start or a quality penalty
- **AND** the session, retry date and completed worker checkpoint remain unchanged

#### Scenario: One node slot serves an independent branch during recovery

- **WHEN** B is stopped in backoff under max_parallel one and C is ready with D depending only on C
- **THEN** C and D pass while B retains its original retry date
- **AND** a join depending on B remains pending, with running status during C and recovering status after D

#### Scenario: Recovery never starts before its recorded date

- **WHEN** a worker or checker receives a finite retry delay and then completes
- **THEN** its next execution starts no earlier than the durable retry date
- **AND** the same quality attempt and native session complete without a refutation

#### Scenario: Terminal controls interrupt a recovery wait

- **WHEN** cancellation or the hard run deadline arrives while a worker or checker waits in backoff
- **THEN** the run becomes cancelled or timed_out without another physical start
- **AND** the original operational diagnostic and quality attempt remain unchanged

#### Scenario: Mixed native branch retains its completed peers during backoff

- **WHEN** a Claude worker or checker waits in backoff with both global agent capacity and per-run parallelism set to one
- **THEN** an independent Codex node and its Codex successor complete once while their mixed join remains pending
- **AND** the run records running while those nodes execute and recovering after they finish
- **AND** daemon death followed by resume retains completed peers, native sessions, retry dates and files without another physical start
- **AND** cancellation cannot start the waiting join or publish partial artifacts

### Requirement: File readers release stream and handle resources

Workspace and journal readers MUST release both the read stream and its file handle before their iterator finishes. Full consumption, an empty input, early consumer return and consumer failure MUST leave no open descriptor for the input. Streaming and bounded reads MUST remain in use. Runtime limits MUST NOT be raised to hide retained resources.

Workspace source readers MUST open without following symbolic links or waiting for a pipe writer. They MUST verify that the opened descriptor is a regular file before reading bytes. A path check before opening MUST NOT replace this descriptor check. Unsupported sources MUST fail with unsupported_file and release the opened handle. This also applies when hashing or copying a previously captured source manifest.

#### Scenario: Regular snapshot sources retain their bytes

- **WHEN** the shared source reader opens an empty or populated regular file
- **THEN** it returns the exact bytes and closes the handle

#### Scenario: Special snapshot sources are refused before reading

- **WHEN** a source path identifies a null device, zero device or directory
- **THEN** the shared reader reports unsupported_file before yielding bytes and retains no opened handle

#### Scenario: Completed readers keep a constant descriptor count

- **WHEN** repeated workspace and journal reads consume complete or empty files
- **THEN** no descriptor remains open for their temporary directory after completion

#### Scenario: Interrupted readers release the input

- **WHEN** a workspace or journal consumer returns early or throws
- **THEN** both resources close and the consumer failure remains unchanged

### Requirement: Workspace assembly bounds concurrent file copies

Workspace assembly SHALL use the shared capped concurrency utility for independent file copies. Manifest admission and destination checks MUST finish before copying starts. Every copy MUST retain streamed source verification, secret scanning, executable mode checks and durable replacement. A failed copy MUST stop further admission and drain all admitted copies before assembly returns. Neither successful nor failed assembly MAY retain open file descriptors or temporary copy files.

#### Scenario: Small assemblies retain their file contents

- **WHEN** two files with different executable modes enter workspace assembly
- **THEN** their exact bytes and modes survive and stale destination files are removed

#### Scenario: Assemblies larger than the worker cap finish

- **WHEN** seventeen files enter workspace assembly under the shared worker cap
- **THEN** every file is copied with its declared hash and executable mode

#### Scenario: Changed source drains admitted copies

- **WHEN** a source changes after its manifest was recorded while other copies are admitted
- **THEN** assembly refuses the changed source and returns only after admitted copies release their files and remove temporary files

#### Scenario: Missing source drains admitted copies

- **WHEN** a source disappears after its manifest was recorded while other copies are admitted
- **THEN** assembly reports the missing source and returns only after admitted copies release their files and remove temporary files

### Requirement: Execution guards apply through file capture

Snapshot capture and verified copies SHALL accept an additional execution-scoped secret scanner factory. The host MUST retain its execution guard through worker checkpointing. Additional guards MUST NOT replace existing environment-secret content checks. Each file MUST get an independent scanner whose tail spans its chunks. Relative file and directory paths MUST also be checked against the scoped guard. Refused copies MUST remove their temporary file. Providing this primitive does not complete runner credential delivery or journal protection.

#### Scenario: A minted credential appears in file content

- **WHEN** an agent writes its execution credential into a candidate file
- **THEN** scoped capture and verified copying refuse the credential
- **AND** a refused copy publishes no file containing it

#### Scenario: A credential crosses a file chunk boundary

- **WHEN** a credential begins at the end of one streamed chunk and finishes in the next
- **THEN** the same file's scanner refuses it
- **AND** unrelated prefixes and suffixes in different files do not form a false match

#### Scenario: A credential appears in a relative path

- **WHEN** an agent places the credential in a file or directory name
- **THEN** scoped capture and verified copying refuse that relative path

#### Scenario: An additional guard keeps environment protection

- **WHEN** an execution supplies its own scanner and a file contains an environment credential
- **THEN** capture and verified copying still refuse the environment credential

### Requirement: Proven setup refusals can resume safely

Before creating an execution tool binding, the runner SHALL durably reserve that execution with a prepared delivery state. Before calling backend start or resume, it MUST durably change delivery to uncertain. A prepared record with no session id MAY resume setup on the same logical attempt after its earlier lease has closed. An uncertain or legacy record without a session id MUST remain blocked until delivery is reconciled. A missing field MUST NOT imply that nothing ran. Setup refusal MUST preserve completed phases, working files, result attempts, refutations and recovery accounting. Resume MUST NOT refill the recovery allowance. This proof covers runner-owned setup; it MUST NOT treat an arbitrary native process failure as proof that no backend work started.

#### Scenario: Native owner refuses setup

- **WHEN** the worker or checker tool owner refuses before backend dispatch
- **THEN** explicit resume can repeat setup with a fresh execution binding on the same logical attempt, including after reload
- **AND** no quality refutation or duplicate backend start is recorded

#### Scenario: Bound turn validation refuses setup

- **WHEN** validation rejects a minted tool binding before backend dispatch
- **THEN** the lease closes and explicit resume can retry setup within the remaining recovery allowance
- **AND** worker and checker progress and completed phases are retained

#### Scenario: Startup delivery remains uncertain

- **WHEN** backend startup fails after the uncertain state was committed and no session id was saved
- **THEN** resume does not start another backend execution or invent a quality verdict

#### Scenario: Legacy delivery proof is absent

- **WHEN** a saved execution has no session id and no delivery proof
- **THEN** reload and resume preserve the blocked execution rather than infer that it was never dispatched

#### Scenario: Setup recovery allowance is exhausted

- **WHEN** a prepared execution has no remaining recovery allowance
- **THEN** resume and reload cannot reset its counters or dispatch another backend turn

#### Scenario: Malformed delivery proof

- **WHEN** a saved phase claims prepared delivery after all reserved executions were dispatched, contains an excessive dispatch count or has a counter without a delivery state
- **THEN** strict phase admission rejects the inconsistent record before recovery

#### Scenario: Installed owner setup refusal

- **WHEN** two native worker steps compete for one owner binding through Codex or Claude with versioned vendor stubs
- **THEN** one refused setup retains prepared proof without a false model start or quality verdict
- **AND** the installed controller can resume it after release, including after daemon restart, within the original recovery allowance
- **AND** zero allowance remains exhausted and the completed peer is not repeated

### Requirement: A blocked run resumes by itself

When a vendor says a usage limit ends at a given time, `titan` SHALL record that time as the step's retry time. It MUST set the run to `blocked` with the reason `limit`. The server MUST resume the run at that time without a person's command. `titan resume <run>` MUST also work before that time and MUST say how long is left. A resumed run MUST continue at the step that stopped, with its saved candidates, refutations and attempts. A person MAY change the model or provider with `titan resume <run> --backend <name>`, and the run MUST continue from the same step.

#### Scenario: Limit with a reset time

- **WHEN** a worker answers "You've hit your 5-hour limit · resets 10:50am"
- **THEN** the step shows a retry time of 10:50 in the person's time zone
- **AND** the run state is `blocked` with reason `limit`

#### Scenario: Automatic resume

- **WHEN** the retry time passes while the server runs
- **THEN** the run continues at the stopped step and no finished step runs again

#### Scenario: Switch provider on resume

- **WHEN** `titan resume <run> --backend codex` runs for a run blocked on Claude
- **THEN** the stopped step continues with Codex and the finished steps keep their results

### Requirement: Runs use prompt caching and report it

Every request to a vendor that supports prompt caching MUST put the fixed parts first and the changing parts last. The order MUST be tools, persona text, hub context, then the task. The fixed parts MUST NOT hold times, random ids or unsorted data. Several steps of one run that share a persona MUST send the same fixed prefix. Titan MUST record, for each execution, the input tokens, the tokens read from cache and the tokens written to cache. `titan status` MUST show the cache share per run, persona and step. A setting `cache.ttl` MUST choose five minutes or one hour. When the share is under 50 percent for a persona with at least three steps, `titan status` MUST say so and name the likely cause.

#### Scenario: Cache fields are recorded

- **WHEN** an execution reports 1000 input tokens, 9000 read from cache and 500 written to cache
- **THEN** `titan status <run> --json` shows those three numbers and a cache share of 90 percent

#### Scenario: Same prefix for the same persona

- **WHEN** two steps use the same persona in one run
- **THEN** the fixed part of both requests is identical byte for byte

#### Scenario: Low cache share is flagged

- **WHEN** a persona with four steps has a cache share of 20 percent
- **THEN** `titan status` flags it and names the likely cause

### Requirement: A workflow can mix agent, script and suggestion stages

A workflow step MAY be an agent step, a script step, a check step or an improvement step. A script step MUST run without an agent. An improvement step MUST write a suggested change to the workflow and MUST NOT apply it until a person approves it. The run record MUST show each stage and its kind.

#### Scenario: Mixed workflow

- **WHEN** a workflow has one script step, one agent step and one improvement step
- **THEN** the run shows all three kinds
- **AND** the script step ran with no agent
- **AND** the improvement is waiting for approval

### Requirement: Steps change the real project as they run

A run MUST change the real project folder while it works. The setting `workspace.mode` MUST accept `live` and `isolated`. The default MUST be `live`. In `live` mode an agent step, a script step or both MUST write to the project folder and not to a copy. Titan MUST NOT need `titan apply` in `live` mode. The run record MUST list the files each step changed.

#### Scenario: A step writes to the project

- **WHEN** a run in `live` mode finishes a step that changes `a.txt`
- **THEN** `a.txt` in the project folder has the new text
- **AND** the run record lists `a.txt` for that step
- **AND** no `titan apply` was needed

#### Scenario: Isolated mode stays available

- **WHEN** `workspace.mode` is `isolated`
- **THEN** the step writes to a copy and the project folder stays the same

### Requirement: A step can be allowed into a harness folder

A step MAY list `allow_folders`. Each entry MUST be one of `.agents`, `.claude`, `.codex` or `.agent`. The agents of that step MAY then write inside those folders, and only those. The folders `.git` and `.titan` MUST stay closed to every agent. The home owner MAY set `workspace.allow_folders` to bound the entries that a workflow can ask for. An entry outside that bound MUST make `titan check` fail and name the step and the folder. The run record MUST show the folders allowed for each step.

#### Scenario: A step writes a skill

- **WHEN** a step lists `allow_folders: [.agents]` and its agent writes `.agents/skills/titan/SKILL.md`
- **THEN** the file is written to the project
- **AND** the run record lists `.agents` as allowed for that step

#### Scenario: A folder that was not listed stays closed

- **WHEN** a step lists `allow_folders: [.agents]` and its agent writes `.claude/settings.json`
- **THEN** the write is denied with the workspace policy as the reason

#### Scenario: Git and Titan folders cannot be allowed

- **WHEN** a step lists `.git` or `.titan` in `allow_folders`
- **THEN** `titan check` fails and names the step and the folder

#### Scenario: The owner bounds the request

- **WHEN** the home setting `workspace.allow_folders` is empty and a step lists `.agents`
- **THEN** `titan check` fails and names the step and the folder

### Requirement: Every step has a restore point and a refuted step rolls back

Before each step in `live` mode, Titan MUST save a restore point of the files the step may change. When the checker refutes the step, Titan MUST restore uncontested changes. Titan MUST keep the refuted attempt as evidence in the run folder. Titan MUST preserve later external edits, including edits to the same file, and request scoped reconciliation before a conflicting restoration. An approval MUST bind the current file identities; a newer edit invalidates it.

#### Scenario: Refuted step is rolled back

- **WHEN** a step changes `a.txt` and the checker refutes it
- **THEN** `a.txt` has the text from before the step
- **AND** the refuted attempt is kept in the run folder

#### Scenario: Outside changes stay

- **WHEN** a person edits `b.txt` while a step runs and the step is refuted
- **THEN** `b.txt` keeps the person's edit

### Requirement: Steps that touch the same file run one after another

Titan MUST NOT run two steps at the same time when both may change the same file in `live` mode. This applies across runs sharing a server. The blackboard MUST record file-scope intent, contention, acquisition and release. A conflicting scope MUST yield and continue automatically after release without manual resume, vendor dispatch or a quality refutation for waiting. Steps on different files MAY run at the same time. This cooperative contract MUST NOT be described as fencing arbitrary external editors.

#### Scenario: Same file

- **WHEN** two steps both list `a.txt`
- **THEN** the second step starts after the first step ends

#### Scenario: Different files

- **WHEN** two steps list `a.txt` and `b.txt`
- **THEN** both steps may run at the same time

### Requirement: Checks run inside the loop

A workflow MAY list checks for a step, such as a type check, a lint check and the tests for the touched files. In `live` mode Titan MUST run them after the builder writes and before the checker starts. When a check fails, Titan MUST send the output to the same builder and let it try again, within the attempt limit. A step MUST NOT pass while a listed check fails.

#### Scenario: Failing check goes back to the builder

- **WHEN** a listed check fails after the builder writes
- **THEN** the builder gets the check output and writes again
- **AND** the step passes only after the check passes

#### Scenario: Check never passes

- **WHEN** the check still fails at the attempt limit
- **THEN** the step fails and the files are put back

### Requirement: The dashboard lists runs without reading whole boards

The run list in the dashboard MUST come from stored run summaries. It MUST NOT read the whole board of each run. It MUST answer in under two seconds for 200 runs. It MUST show what each running run does now, which stage it is in and which persona works on it.

#### Scenario: Run list is fast

- **WHEN** the project has 200 runs and a person opens the run list
- **THEN** the list shows every run with its state, stage and persona
- **AND** the answer takes under two seconds
