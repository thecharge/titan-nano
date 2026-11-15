## ADDED Requirements

### Requirement: The board drives the work

The `titan` server SHALL start a step as soon as every step it needs has a result that survived, and capacity is available under both run and server limits. Admission MUST follow the fair scheduling rule below. It MUST NOT wait for a fixed order beyond what `inputs` and the groups say. A new board entry, such as a result or an added step, MUST make the server look again for steps that can start.

#### Scenario: A step starts when its input survives

- **WHEN** step `fix` has `inputs: { cause: cause.root_cause }` and the result of `cause` survives
- **THEN** the board has a `step_started` line for `fix` after the `survived` line for `cause`
- **AND** no other event came between them that `fix` waited for

### Requirement: Any agent can add steps

An agent SHALL add steps by sending a request of kind `add_step` in its answer, with the full steps in the workflow file format. `titan` MUST act on the request only after that candidate was kept. Requests from refuted attempts and losing candidates MUST be dropped. Each added step MUST pass the same checks as a step in the workflow file, including at least one entry across `falsify` and `verify`. A persona falsifier MUST differ from the resolved worker version. The board MUST name the step that added it.

#### Scenario: A planner adds three steps

- **WHEN** the agent of step `s1` sends an `add_step` request with steps `s2`, `s3` and `s4`, and the result of `s1` survives
- **THEN** the run has 4 steps
- **AND** the board lines for `s2`, `s3` and `s4` each have `"added_by":"s1"`

#### Scenario: Added step without a falsifier

- **WHEN** an agent sends an `add_step` request for a step with no entries in `falsify` or `verify`
- **THEN** `titan` does not add the step
- **AND** the board has a line with `"kind":"refused"` and the text `every step needs at least one falsifier`

#### Scenario: Steps from a refuted result are dropped

- **WHEN** an agent sends an `add_step` request and its result is then refuted on every attempt
- **THEN** none of the steps in that request are added
- **AND** the board has a line with `"kind":"dropped"` for that request

### Requirement: A step can be an open call

A step SHALL be able to name `call: { tags, task }` instead of a persona. `titan` MUST answer an open call with a persona from the register whose tags match, picked as in spec persona-lifecycle. When no persona in state `trial`, `proven` or `needs_update` matches, `titan` MUST send a `new_persona` request to the main agent.

#### Scenario: Open call answered from the register

- **WHEN** a step has `call: { tags: [chemistry], task: "Check the reaction" }` and the register has `chemist@2` in state `proven` with tag `chemistry`
- **THEN** the step runs with `chemist@2`
- **AND** the board line for the pick names the persona and the rule `thompson`

#### Scenario: No persona fits the call

- **WHEN** a step has `call: { tags: [tax-law] }` and no persona in the register has that tag
- **THEN** `titan` sends a `new_persona` request to the main agent with the tags and the task

### Requirement: A step can split its work into parts

A step SHALL be able to have `split: { parts: <step id>.<output name> }`, where the output is a list. `titan` MUST run one part execution for each list item, with at most `width` parts active at the same time. Each execution MUST apply candidates and falsifiers as defined below. When the file does not set `split.width`, the policy in spec self-training-orchestration MUST choose it.

#### Scenario: Width set in the file

- **WHEN** a step has `split: { parts: plan.files, width: 2 }` and `plan.files` has 6 items
- **THEN** 6 worker agents run when `candidates: 1`
- **AND** no more than 2 parts are active together and all roles remain within `limits.max_parallel`

### Requirement: Many runs share one server

One `titan` server SHALL run many runs at the same time. Each run MUST have its own board and run record. All runs MUST share the persona register, the knowledge hub and the orchestration policy.

#### Scenario: Two runs at once

- **WHEN** two runs start on the same server with different goals
- **THEN** each run's `board.jsonl` holds only lines with its own run id
- **AND** both runs finish

### Requirement: Limits stop a runaway hive

The workflow file SHALL accept `limits.max_steps` (default 50) and `limits.max_parallel` (default 4). Both defaults are guesses that have not been measured. When an added step would go over `max_steps`, `titan` MUST refuse it and log the refusal on the board. It MUST send at most one open `raise_limit` request per limit kind for the run, not one for each refused step. A later distinct proposal after a resolved request MAY create a new scoped request.

`max_parallel` MUST count every active worker, falsifier, judge, helper and improver session in that run. A waiting session MUST release its place after its active turn stops. Limits MUST also apply to split parts and candidate attempts. `max_steps` MUST count each split part and helper invocation as work, as well as named steps. Rejected work MUST NOT start an agent. A helper MUST NOT ask a persona already waiting in its chain of requests.

#### Scenario: Helper can run with one place

- **WHEN** `max_parallel` is 1 and a worker asks another persona for help
- **THEN** the waiting worker releases its place and the helper runs
- **AND** the worker continues after the helper releases its place

#### Scenario: Split cannot bypass the work limit

- **WHEN** a run with `max_steps: 10` tries to split one step into 1000 parts
- **THEN** no part starts and one `raise_limit` request is created

#### Scenario: Circular help request

- **WHEN** A waits for B and B asks A for help
- **THEN** the request is refused with `circular ask request`
- **AND** B receives that refusal and can finish its turn

#### Scenario: Runaway agent

- **WHEN** a run has `limits.max_steps: 10` and an agent tries to add 50 steps, one request at a time
- **THEN** the run has 10 steps
- **AND** the board has 41 lines with `"kind":"refused"`
- **AND** there is 1 open `raise_limit` request

### Requirement: Each worker sees the plan of its run

`titan` SHALL give each worker agent the list of steps of its run, with each step's id, task, persona and state. A worker MUST NOT see the sessions of other agents. A falsifier MUST still get only the goal, the task and the result, as in spec persona-board.

#### Scenario: Worker prompt holds the step list

- **WHEN** a run has steps `cause`, `fix` and `review`, and the agent for `fix` starts
- **THEN** its prompt lists `cause`, `fix` and `review` with their states
- **AND** the prompt of the falsifier of `fix` holds none of the other step ids

### Requirement: A run that makes no progress gets a new plan

`titan` SHALL keep a _stall count_ for each run, starting at 0. The count MUST go up by 1 when an attempt is refuted and its result repeats an earlier refuted result of the same step. Two results repeat when they are the same after spaces at the start and end are removed. It MUST also go up by 1 when a step is marked `failed`. It MUST go down by 1, but not below 0, when a result survives. When the count is more than 2, `titan` MUST NOT start new steps in that run. It MUST send one `replan` request to the main agent with the failed and repeated steps and their evidence, and set the count to 0. An answer MUST either keep the existing plan or supply a replacement plan. A replacement that changes passed work or exhausted attempts MUST start a new run. Unfinished additions MUST pass the same checks, approvals and remaining allowance. A denial MUST fail the affected work, not leave it waiting forever. Steps that are already running go on. The limit of 2 comes from Magentic-One, as in `research/swarm.md`, and has not been measured for `titan`.

#### Scenario: Repeated results start a new plan

- **WHEN** step `fix` has `max_attempts: 3`, attempts 2 and 3 give the same result as attempt 1, and all three are refuted
- **THEN** the stall count reaches 3 when `fix` is marked `failed`
- **AND** the board has one `replan` request to the main agent that names `fix` and holds the evidence of its third refutation
- **AND** no new step starts in that run until the main agent answers

#### Scenario: Steady progress never starts a new plan

- **WHEN** a run has 10 steps, and each step survives on its first attempt
- **THEN** the board has no `replan` request

### Requirement: Split parts produce one ordered output

Each split part SHALL run the step's candidates, retries and checks independently. The step MUST pass only when every part has a kept result. Its output MUST be a list of those results in input order, regardless of completion order. An empty part list MUST produce an empty output without starting an agent. A script worker MUST run once per part, under the same checks. Split width MUST limit active parts; the run's parallel limit MUST also count their falsifiers and judges.

#### Scenario: Parts finish out of order

- **WHEN** input parts are A, B and C and finish in order C, A and B
- **THEN** the kept split output is ordered A, B and C

#### Scenario: Empty split

- **WHEN** `split.parts` resolves to an empty list
- **THEN** the step passes with output `[]` and starts no worker or falsifier

### Requirement: All requested work has a finite allowance

`max_steps` SHALL charge each named step once, each split part once and each helper invocation once. Candidates and attempts MUST use the step's finite candidate and attempt limits. A split of K parts MUST reserve K additional work units before any part starts. Improvement work MUST use the same allowance. Helpers MUST NOT bypass it by forming a long chain of different personas. Exhaustion MUST refuse work and raise one open `raise_limit` request. A denial MUST fail the affected work with evidence rather than create another request for the same proposal.

#### Scenario: Helpers exhaust the work allowance

- **WHEN** a helper chain has consumed the run's remaining work units and asks another unused persona
- **THEN** no helper starts and one `raise_limit` request records the exhausted allowance

#### Scenario: Losing candidate adds steps

- **WHEN** candidates A and B survive, A asks to add step `extra`, and the judge keeps B
- **THEN** `extra` is not added and A's request is marked `dropped`

### Requirement: Runs share capacity without sharing an execution lock

The server SHALL schedule ready work across runs without holding its commit mutex during an agent call. Each run MUST retain its own `limits.max_parallel`. The person configures `server.max_active_agents` in `TITAN_HOME/config.yaml`; it MUST be a positive integer. The initial default is 8, a guess to measure. Every active worker, helper, falsifier, judge and improver session MUST consume one server slot and one owning-run slot. Linked evaluations MUST charge their parent once. Waiting sessions MUST release both slots after their turn stops. Admission MUST durably reserve both slots atomically before session startup. Restart MUST reconcile existing reservations before admitting replacements. A failed start MUST release its reservation. Cancellation or recovery MUST retain a slot until the owned session is confirmed stopped. Unknown remote work MUST remain visible and consume its backend capacity until reconciled. A workflow MUST NOT raise the server limit.

#### Scenario: Three workflows genuinely overlap

- **WHEN** three runs each have one ready fake worker, per-run limit 1 and server limit 3
- **THEN** all three workers start before any completes; each waits at a test barrier until all three have started

#### Scenario: All roles share the server cap

- **WHEN** two runs launch workers, judges and helpers with server limit 3
- **THEN** no observed interval has more than three active agent sessions across both runs

#### Scenario: Waiting run releases shared capacity

- **WHEN** run A waits for approval with server limit 1 and run B has ready work
- **THEN** B starts before A receives an answer

#### Scenario: Simultaneous admissions reserve one slot

- **WHEN** two ready runs race for one free server slot
- **THEN** exactly one starts; a failed startup releases its reservation for the other run

### Requirement: Pending agent callbacks have a separate owner budget

The home owner SHALL configure `server.max_pending_agents` as an integer from zero through 65536, defaulting to 1024. The server SHALL bound pending callbacks across runs separately from active sessions. Lower configuration layers MUST NOT change this budget. Zero SHALL allow admission to free active slots while refusing waiting. Saturation SHALL block the same logical attempt before an execution or session begins, without a refutation. Explicit resume SHALL retry that waiting phase after capacity is available. Cancelling a queued callback SHALL release its pending slot and remove empty run queues.

#### Scenario: Full queue preserves the waiting phase

- **WHEN** two parallel workers share one active slot and the owner disables waiting
- **THEN** one worker runs and the other blocks with zero executions and no session; explicit resume completes it on attempt one without a refutation or replaying the completed worker

#### Scenario: Reload preserves the queue-blocked attempt

- **WHEN** the daemon reloads a run blocked before agent admission and the person resumes it after capacity drains
- **THEN** the waiting worker starts once on its original attempt and the completed worker is not repeated

#### Scenario: Cancelled callback releases the waiting budget

- **WHEN** a full pending queue loses a cancelled callback while its active worker is held
- **THEN** a replacement can queue, the cancelled callback never runs and surviving runs retain round-robin turns

#### Scenario: Project cannot enlarge the pending budget

- **WHEN** a project file sets the server pending agent budget
- **THEN** configuration fails with an owner-setting error before agent admission

### Requirement: Ready runs receive fair admission

The scheduler SHALL admit one ready session per run in round-robin order among eligible runs. It MUST skip runs at their own limit or waiting for an answer. It MUST NOT reserve a whole run's future capacity. Existing sessions need not be preempted. Each freed slot MUST go to the next eligible run before a previously served run gets another turn. Queue order MUST survive restart. Limits and deadlines MUST still apply while queued.

#### Scenario: Busy run cannot monopolize newly free slots

- **WHEN** A continuously adds ready work, B and C are queued, and one slot becomes free at a time
- **THEN** B and C each receive a turn before A receives another; the test uses controlled completions rather than timing sleeps

#### Scenario: Restart preserves queued turns

- **WHEN** B is next in the durable admission queue when the server restarts
- **THEN** B remains next among eligible recovered runs

#### Scenario: Queued run reaches its deadline

- **WHEN** B reaches its recorded deadline while waiting behind A
- **THEN** B times out without starting an agent or resetting its deadline

### Requirement: Run catalog inspection has bounded caller pages

CLI, HTTP and MCP SHALL expose the same strict versioned run page with `runs`, `before`, `next_before` and `has_more`. Rows SHALL retain the indexed submitting client identity even when their journal is unavailable. The default count SHALL be 50 and the maximum SHALL be 200. SQL SHALL select at most count plus one rows before bounded parallel description. An optional client identity filter SHALL select only that caller's indexed runs. The exclusive descending insertion cursor SHALL remain valid across insertion and server restart. An empty final page SHALL keep its cursor. This filter MUST NOT be presented as authorization. Summary text fields SHALL be bounded to 4096 characters. The client SHALL reject responses that change the requested cursor, exceed the requested count or substitute a filtered caller.

#### Scenario: All clients page and filter indexed callers

- **WHEN** CLI, HTTP and MCP list a home with multiple submitting clients using a small page count
- **THEN** they return the same ordered rows and client identities, and filtering returns only the selected caller

#### Scenario: Older cursors survive insertion and restart

- **WHEN** another submission is indexed after the first page and the server restarts before the next page
- **THEN** the older cursor drains the original older rows without duplicates, a final empty page keeps its cursor and a fresh first page sees the newer submission

#### Scenario: Invalid selectors and substituted responses fail

- **WHEN** selectors are unknown, repeated or outside their bounds, or a response changes the requested cursor, count or caller
- **THEN** admission or response validation fails explicitly instead of silently changing the requested listing

#### Scenario: Bounded pages preserve unavailable rows

- **WHEN** selected indexed runs have no readable journals
- **THEN** SQL limits selection before description and the bounded page preserves indexed identity and availability state without inventing a workflow outcome

### Requirement: Scoped request inspection has bounded origin pages

CLI, HTTP and MCP SHALL return the same strict versioned request page containing query, requests, unavailable, next_cursor and has_more. The default count SHALL be 20 and the maximum SHALL be 100. A page SHALL stay within 1 MiB and describe at most 16 runs after selecting at most 17 catalog rows. Run, submitting request client, harness session, normalized absolute project path and waiting or answered state filters SHALL combine by intersection. These filters MUST NOT be described as authorization. Each request SHALL retain its exact run and request identities. An opaque continuation SHALL bind its selection, descending catalog position and last request identity; only count may change between pages. Empty filtered pages MUST advance when older catalog rows remain. Unreadable or excessive source data SHALL retain indexed run identity in unavailable without hiding healthy runs. Responses SHALL reject changed query, foreign selected identity, duplicate identities, stalled cursors and excessive count or bytes. Request states may change between pages; listing SHALL NOT promise a frozen snapshot.

#### Scenario: All request clients select the same origins

- **WHEN** two harness sessions each create requests in two runs across two projects and HTTP, CLI and MCP list with small pages
- **THEN** exact run, client, session, project and answer-state selections return the same intersecting identities, and an unfiltered list spans both harnesses

#### Scenario: Request pages bound count bytes and scan work

- **WHEN** large records exhaust the byte allowance or many runs outside the selection exhaust scan allowance
- **THEN** a page cuts before its count or byte allowance, describes at most 16 runs and advances even when its request list is empty

#### Scenario: Request cursors survive restart and refuse selection changes

- **WHEN** the catalog restarts and a newer run is inserted after a first page, or a caller changes filters or supplies an absent continuation identity
- **THEN** an unchanged older cursor drains only the older selection without duplicates, and changed or absent selections fail explicitly

#### Scenario: Invalid request pages and source records fail closed

- **WHEN** selectors are unknown, repeated or outside their bounds, a response substitutes selection or fails count, byte or progress checks, or source records are excessive or inconsistent
- **THEN** admission or response validation fails explicitly, and unavailable source runs preserve indexed identity while healthy requests remain visible
