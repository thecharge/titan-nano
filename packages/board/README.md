# @titan/board

## Responsibilities

Owns durable run records, queued journal appends, streamed replay and atomic projection writes. It validates record paths, plan identity, configuration hashes, node sets and sequence continuity.

Each store retains only the last validated configuration and plan identities. An exact content change triggers semantic validation again. Every event still receives schema, sequence, runtime, path, node and origin checks. Repeated unchanged records reuse semantic validation without trusting object identity. Append, replay and event iteration refuse changed invalid configuration or plan data.

## Public contract

`readEventPage` consumes validated journal events with central count and byte budgets and returns a versioned page with run identity, starting cursor and continuation. Future cursors and oversized single events fail. `RunStore` admits strict JSON data and its 16 MiB expanded record budget through bounded segments before whole-record serialization. Rejected admission leaves the journal, sequence and committed snapshot unchanged; a later valid commit can proceed. It commits admitted records and replays events from a run root. State projections use compact JSON and cannot exceed the admitted record budget. Its async `snapshot` waits for queued writes and returns a detached committed state. Replay can stop at a captured committed version. Failed writers remain failed; recovering a projection requires explicit journal reload. `forRun` validates run identifiers. `initialNode`, `initialPhase` and `requestHash` build canonical state. `atomicWrite` syncs a temporary file, renames it and syncs the parent directory. `atomicWriteStream(path, source, maximum)` uses the same publication sequence with asynchronous byte chunks and a complete byte allowance. Invalid limits fail before opening a temporary file. Overflow and producer failure close the iterator, remove temporary bytes and preserve the previous destination. A failure after rename requires reconciliation because publication may already have occurred.

## Verification

Run `bun run test testing/integration/board.test.ts` and engine recovery tests. Cases exercise queued appends, incomplete tails, complete corruption, invalid usage and duplicate sequence numbers.

`testing/integration/run-origin.test.ts` checks labelled and legacy run controls, caller identity changes, metadata removal and late introduction. Initialized writers reject changed caller identity before appending and remain usable for an unchanged commit. Replay and event iteration reject inconsistent labelled history before accepting that record. Client, submission and caller session labels remain fixed once a journal begins with a caller label; a legacy journal cannot acquire one later.

## Limits

Records have a finite byte limit. Cross-process writer fencing and injected durable-write failure recovery still need delivery evidence. The journal is authoritative; the state JSON file is a projection.

A RunStore may receive a typed projection writer. A commit invokes it after the durable journal and state file, before acknowledging or exposing the new committed snapshot. Failure leaves the queue failed. Explicit read invokes it on validated replay before accepting recovered state. Engine supplies the request projection writer; standalone stores without it retain their existing contract.

The local event log and board journal share one durable append file under events.jsonl and board.jsonl. Each line retains the complete validated event and run state. Acknowledged appends require both names to identify the same ordinary file. Replay creates a missing event name for legacy runs. An unrelated replacement blocks acknowledgement and explicit replay until the obstacle is removed. A failed append acknowledgement can already have reached the canonical journal, so recovery reads its committed sequence before retrying.

`runResultChunks(run, outputs?)` validates and streams a versioned Markdown report with workflow identity, goal and step outcomes, attempts, refutations and evidence. Passing reports require final outputs. Omitting outputs selects a failed report. Both the JSON encoder and atomic report writer use the central record allowance.

Replay and append inspect RunFormatProbeSchema before full record validation. A positive integer format outside RunFormat produces unsupported_run_format with the supported formats and recovery guidance. Other invalid records retain corruption handling. Refused future records leave the journal and its incomplete tail intact, preserve the state projection and keep an initialized writer available for a valid commit.

Format five requires a runtime_version matching the shared Titan release. A mismatch retains unsupported_run_runtime with the required and current releases and recovery guidance. The pin cannot disappear or change within a journal. Replay and append refuse before filesystem mutation, and refused append leaves an initialized writer usable for its original record.

Read-only backup inspection uses `inspectCopy(source, null)` to validate supported journal formats across retained creating runtimes. It validates every event, sequence, original path, configuration, plan and fixed origin, including consistency of the runtime pin. It returns retained state without projection writes or worker execution. Passing a runtime version instead preserves exact-version compatibility checks. Normal replay, append and event iteration require the current runtime.

A validated worker result is retained in a phase_received event before native session cleanup and file checkpoint capture. This promotes the journal to format six and preserves its existing release and caller identity; legacy records do not gain an invented release pin. A pending capture cannot be marked completed or attached to a checker. If capture or cleanup fails, restart retains the answer and refuses another worker dispatch. Later live contents cannot be accepted as the original result. Unsealed native receipts use the reconciliation generation described below.

## Received-result reconciliation

A native worker receipt can now resume through an explicit reconciliation generation. Titan retains the original phases and usage, captures a hash-bound current input and records reconciliation_started before dispatch. The original persona and backend receive the retained result and original task with a reconciliation instruction. Execution stays in the live project. Fresh candidate evidence and checks use a generation folder. Each generation spends the existing recovery allowance and preserves the quality attempt and refutation counts. Format nine fences older readers. Changed retained input blocks before dispatch. A sealed receipt first requires its retained candidate, journal hash and manifest to agree. Changed live files then require a fresh generation. Every retained input and sealed candidate is verified before dispatch and acceptance. Refutation restores the current generation input within its declared write scope, preserving the intervening external edit. Private knowledge proposals use separate generation identities. Only the checked generation can publish. Completed native workers also reconcile changed dependencies before acceptance, retaining their original sealed result and requiring fresh checks. Script and split receipts retain their separate reconciliation work.
