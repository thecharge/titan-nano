# Request turn delivery

This work continues tasks 9.1, 9.4, 9.5 and 16.4 for Codex and Claude Code. It is not complete acceptance of those tasks.

## Evidence and boundary

The [Codex SDK guide](https://developers.openai.com/codex/sdk) documents repeated turns on a retained thread and resuming an existing thread. The [Codex MCP guide](https://developers.openai.com/codex/mcp) documents stdio and HTTP server configuration. Neither page establishes that killing an SDK process after a tool response preserves that response in its native transcript.

The [Claude SDK hook guide](https://code.claude.com/docs/en/agent-sdk/hooks) documents event callbacks and turn control. The [input guide](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode) distinguishes persistent streaming input from single queries resumed through session state. The installed 0.3.319 declarations also expose interrupt and hook continuation fields. These interfaces need process evidence before they can establish a native checkpoint. No live vendor call was made.

For the first structured path, let the native turn finish normally. An opted-in persona uses request_turns: true and returns an object with result and requests. A completed turn uses an empty requests array. A waiting turn uses a null result and one or more strict request descriptions containing kind, scope and expires_at. Titan assigns request identities and binds their origins to the current execution and native session. Personas without this optional field retain their existing output contract and stored workflow hashes.

A waiting turn must atomically commit its complete request batch, retained session and phase request identities. The step then releases its active slot. Independent work continues. With no runnable work, the run is waiting and retains exit code three. Resume with unanswered requests starts no new native turn. Answered requests go only to their asking phase. Intentional continuation retains the quality attempt and does not spend operational recovery allowance. An actual interruption during that continuation remains an operational failure.

The new record uses run format three so older runtimes cannot strip the pending turn while resuming. Existing unbound runs retain format one and ordinary execution-bound requests retain format two. Appending an ordinary decision must never downgrade a format-three header. Synchronous publication refusal must restore the previous live format, step state and phase metadata. Asynchronous write failures require reload; their durable outcome must not be guessed.

## Observed engine evidence

All twenty-eight focused cases passed in 12.74 seconds. They exercise both actual pinned SDK libraries through strict offline executable fixtures, worker and checker continuation at zero recovery allowance, approval and denial, reload, unanswered resume, independent peer delivery and invalid envelopes. Three-request batches, frozen capacity, synchronous journal refusal, lost acknowledgement, forged origin and missing membership are covered. The focused command correctly failed omitted global coverage.

Five deliberate regressions were detected and source was restored after each: charging recovery allowance on intentional continuation, charging a retry, omitting aggregate waiting state, omitting synchronous format rollback and omitting answer delivery. They failed sixteen, sixteen, eighteen, two and sixteen unique cases respectively. The restored complete suite passed all 1792 tests across 99 files in 150.52 seconds, with 173 product sources and no line or function gaps.

The previous format-two source at e77947e4bf6239d04e2480f440310c9e45513693 was exported, installed with its frozen lock, packaged and installed outside the checkout. Its actual executable refused inspection and resume of worker and checker format-three waiting runs without changing their journal hashes. Format-one and format-two control runs remained readable. The probe ran in offline Podman with the normal two-CPU, two-GiB limits; see probes/request-turn-rollback.ts. No live vendor call was made. The canonical guide source and package contracts now describe the implemented opt-in path without loading or operating the Titan skill.

## Work still required

The complete installed archive check passed, including eight shared waiting daemon cases with CLI, HTTP and MCP answers, graceful restart and SIGKILL. Its existing sixteen SDK recovery, four mixed-workflow and four active-process cases also passed. Write the bounded requests.json projection. Keep native MCP tool registration and its turn-ending guarantee pending until implemented and tested. Complete batch identity conflicts, expiry and answer-lineage counterexamples still need broader coverage. Do not mark the broader tasks complete from the structured subset.

## Pending projection implementation evidence

The next working increment adds requests.json as a journal projection, not an input or authorization source. RunStore invokes the supplied writer after append and state publication but before acknowledgement and committed snapshot advancement. Failed publication keeps the writer failed. Explicit load validates history and rebuilds before Engine retains a run. The callback receives the detached state and reads its explicit journal prefix directly, avoiding a snapshot wait on its own writer queue.

The complete document uses strict streamed JSON and atomic bounded writes. Its allowance is the fixed maximum request count times the complete per-record allowance, plus bounded metadata. Independent 64 KiB pages avoid a second whole encoded projection buffer. The original bounded request inventory still resides in memory. Answered records are excluded; pending escalation audit is retained. Unrelated later execution events may advance beyond the file's through cursor.

All seven new projection assertions and all twelve enhanced daemon waiting cases passed in the first focused run. Single-session process cases delete or corrupt the file after daemon termination and require journal reconstruction before answering. Parallel cases check both pending records and removal of only the decided peer. The four older forged-turn tests first failed because rejection moved earlier into load; their assertions now require corrupt_board and no retained run at that boundary. A complete restored suite is running.

Four restored mutations were detected by the projection table: retaining answered records failed six unique cases; skipping reload repair failed seven; acknowledging failed publication failed two; reopening a failed writer failed two. Source was restored after each mutation and in a final cleanup. Logs are temporary local evidence under /tmp/titan-projection-*.log; the reproducible assertions live in testing/integration/request-projection.test.ts and its shared case/factory files. Normal gates and installed package verification remain required. Tasks 9.4 and 16.4 remain open.
