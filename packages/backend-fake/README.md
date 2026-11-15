# @titan/backend-fake

## Responsibilities

Owns deterministic offline backend behavior. It provides explicit injectable responses and bounded answer scripts without calling a vendor.

## Public contract

`FakeBackend` implements the same backend and session ports as real adapters. Handlers receive the invocation, prompt, combined cancellation signal and event sink. Resume retains the supplied session identifier. Without a handler, both admission and sending reject an unscripted task with fake_unscripted and its task name. The default runtime uses that same refusal when no answer profile is configured.

`ScriptedFakeBackend` accepts a version-1 script with an `answers` array. Every entry specifies `persona`, `task` and a JSON `answer`. Optional `attempt` and `execution` numbers default to 1. Matching uses all four coordinates, so quality attempts, operational retries and parallel personas select distinct replies. Duplicate coordinates and unknown fields fail validation. The complete encoded script is limited to one MiB and 1,024 entries. The adapter checks the bound before parsing or retaining a script copy. Returned answers are detached copies.

`validateTurn` checks the prompt and durable coordinates before the engine counts an execution. An absent reply raises `fake_unscripted` and names the task. It blocks the workflow at that phase while preserving its quality attempt. Native resume keeps the supplied session identifier and selects replies using saved execution counts.

## Verification

Run offline adapter and engine tests. The fake backend supports rate-limit, interruption, verdict and artifact fixtures; real adapter executable stubs remain a separate contract requirement.

## Limits

This backend is a test tool and does not count as another supported vendor. Production defaults never derive answers from an output schema. Control tests can explicitly inject schema-shaped responses through testing/support/backend.ts. CLI and installed offline delivery acceptance use named answer scripts.
