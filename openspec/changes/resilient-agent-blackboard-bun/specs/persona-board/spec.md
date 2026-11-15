## ADDED Requirements

### Requirement: Every message goes onto the board

`titan` SHALL write every message between personas, `titan` and the main agent to `board.jsonl` in the run record. Each message MUST be one line, added to the end of the file in one write. Each line MUST hold an id, a time, the sender, the receiver, the kind and the body.

#### Scenario: Board after a run with a question

- **WHEN** a run ends in which the persona `fixer` asked the persona `investigator` a question
- **THEN** `board.jsonl` has a line with `"from":"fixer"`, `"to":"investigator"` and `"kind":"ask"`
- **AND** a later line with `"from":"investigator"`, `"to":"fixer"` and `"kind":"answer"`

#### Scenario: Parallel steps write at the same time

- **WHEN** 8 parallel steps each write 2000 messages to the board
- **THEN** `board.jsonl` has 16000 lines more than before
- **AND** every line is valid JSON

### Requirement: Agents send requests in their answer

An agent SHALL send requests by adding a `requests` list to its structured answer. A request kind MUST be one of the kinds in spec approvals. `titan` MUST refuse other kinds and log the refusal on the board. Knowledge hub calls are tools, not requests, as in spec tool-servers.

#### Scenario: Unknown request kind

- **WHEN** an agent sends a request with kind `delete_files`
- **THEN** `titan` does not act on it
- **AND** the board has a line with `"kind":"refused"` and the text `unknown request kind "delete_files"`

### Requirement: A persona can ask another persona

For an `ask` request, `titan` SHALL start the named persona with the question. It MUST then continue the asking agent's session with the answer.

#### Scenario: Answer reaches the asking agent

- **WHEN** the fake adapter's `fixer` asks `investigator` "Which file holds the bug?"
- **AND** `investigator` answers "orders.ts line 40"
- **THEN** the next prompt in the same `fixer` session holds "orders.ts line 40"

### Requirement: Each agent sees only the messages meant for it

`titan` SHALL give an agent only its inputs and the board messages addressed to it. A falsifier MUST get only the goal, the task and the result.

#### Scenario: Falsifier does not see board questions

- **WHEN** `fixer` and `investigator` exchanged two messages on the board
- **AND** `skeptic` falsifies the result of `fixer`
- **THEN** the prompt of `skeptic` holds neither of those two messages

### Requirement: Requests to the main agent pause only the step that asked

For requests at level `main` or `human`, as in spec approvals, `titan` SHALL pause the step that asked. Other steps that do not depend on it MUST keep running. When nothing else can run, `titan run` MUST exit with code 3 and write the open requests to `requests.json`.

#### Scenario: Persona asks for a tool

- **WHEN** a step in one parallel branch sends a `tool` request for `WebSearch` and the other branch has two more steps
- **THEN** the other branch finishes its two steps
- **AND** `titan run` then exits with code 3
- **AND** `requests.json` lists the request with its id, the step and `"tool":"WebSearch"`

### Requirement: The main agent answers requests and resumes

`titan answer <run id> <request id>` SHALL take exactly one of `--persona <file>`, `--tool <name>`, `--skill <name>`, `--resource <path>`, `--yes`, `--to-person` or `--deny "<reason>"`. `--yes` accepts the request as it was sent, for example a `merge_personas` or an `add_step` request. `titan resume <run id>` MUST continue the paused steps with the answers. A persona given with `--persona` MUST also go into the register.

#### Scenario: Tool given and run resumed

- **WHEN** the main agent runs `titan answer <run id> r1 --tool WebSearch` and then `titan resume <run id>`
- **THEN** the paused step's agent continues with `WebSearch` among its tools
- **AND** the board has a line with `"kind":"answer"` for `r1`

#### Scenario: Request denied

- **WHEN** the main agent runs `titan answer <run id> r1 --deny "No web access for this problem"` and then `titan resume <run id>`
- **THEN** the paused step's agent gets the reason in its next prompt

#### Scenario: Request accepted as sent

- **WHEN** the main agent runs `titan answer <run id> r3 --yes` for an `add_step` request at level `main`
- **THEN** the steps in `r3` are added only if their originating candidate was kept
- **AND** the board has a line with `"kind":"decision"`, `"by":"main"` and `"answer":"yes"` for `r3`

#### Scenario: Resume with an open request

- **WHEN** `titan resume <run id>` runs and request `r2` has no answer
- **THEN** `titan` exits with code 3 and lists `r2`

### Requirement: Messages carry complete run and session identity

Every board message and continuation SHALL bind to a run, execution and session. Local step names and event numbers MAY repeat across runs. A message, helper answer or late callback MUST NOT be routed by persona name, latest run or latest session alone. A client reconnect MUST resume each watched run from its own cursor.

#### Scenario: Identical step names in different runs

- **WHEN** runs A and B both have step `fix` and request `r1`, and B answers first
- **THEN** only B's waiting session receives that answer; A remains waiting

#### Scenario: Two watches reconnect

- **WHEN** one client watches A through event 7 and B through event 3 and reconnects
- **THEN** A resumes after 7 and B after 3 without mixing messages

### Requirement: Journal admission bounds serialized records and projections

The journal SHALL admit strict JSON data and its central 16 MiB expanded UTF-8 record allowance through bounded segments before serializing a complete record. Repeated references SHALL count their expanded bytes. Unsupported values, accessors, cycles and excessive nesting SHALL fail before sequence reservation or file writes. Omitted event data SHALL retain the null default. An admission failure SHALL preserve journal bytes, committed state and sequence and allow a later valid commit. State projections SHALL use compact JSON within the admitted record budget. This admission rule SHALL preserve existing append ordering, replay and failed-writer recovery contracts.

#### Scenario: Valid event data commits and replays

- **WHEN** supported structured JSON, Unicode, repeated references or omitted event data is committed
- **THEN** replay returns the expected data and the committed version advances once

#### Scenario: Unsupported event data leaves no sequence gap

- **WHEN** an event contains an accessor, cycle, excessive nesting, nested undefined or non-finite data
- **THEN** admission fails without changing the journal or committed version
- **AND** a later valid event commits with the next consecutive id

#### Scenario: Repeated data exceeds the record allowance

- **WHEN** repeated references would expand the complete record above 16 MiB
- **THEN** admission fails before complete serialization or file writes
- **AND** the next valid event can still commit without a sequence gap

#### Scenario: Projection formatting cannot expand an admitted state

- **WHEN** a deeply nested state fits its record allowance but indentation would grow its projection beyond 16 MiB
- **THEN** the compact projection remains within that allowance and preserves the committed version
