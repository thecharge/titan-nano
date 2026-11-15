## ADDED Requirements

### Requirement: The default test run never reaches a real API

`bun test` from the repository root SHALL run every default unit, integration and end-to-end test of `titan`. Live groups MUST run in separate explicitly enabled processes. None of these tests MUST reach a real agent tool, a real model API, RunPod or any host other than 127.0.0.1, `localhost` and `::1`. This MUST hold when the person's real keys are set in the environment.

#### Scenario: Keys set, no real call

- **WHEN** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` and `RUNPOD_API_KEY` are set and `bun test` runs from the repository root
- **THEN** every test passes or is skipped
- **AND** the test of the guard file reports that each key variable was removed before the first test

### Requirement: A guard file blocks the network, other programs and keys

The root `bunfig.toml` SHALL load the file `testing/support/guard.ts` before every test file, with `[test] preload`. In the default suite, regardless of inherited live flags, the guard file MUST:

- remove every variable whose name ends in `_API_KEY` or `_TOKEN`, or starts with `ANTHROPIC_`, `OPENAI_`, `GEMINI_`, `GOOGLE_API` or `RUNPOD_`;
- make `fetch`, `node:net`, `node:tls`, `node:http`, `node:https` and `Bun.connect` throw for any host other than 127.0.0.1, `localhost` and `::1`;
- make `Bun.spawn`, `Bun.spawnSync` and the `node:child_process` functions throw for any program other than Bun itself, `git`, and files under `test/fixtures/`.

The guard file MUST have its own tests, and they MUST run in every default test run. The probe in `research/dev-standards.md` showed that a guard without `node:https` and without the program check let calls through.

#### Scenario: A vendor API is blocked

- **WHEN** a test calls `fetch("https://api.anthropic.com/v1/messages")`
- **THEN** the call throws `network blocked in tests: api.anthropic.com`

#### Scenario: node:https is blocked

- **WHEN** a test calls `https.get("https://example.com/")` from `node:https`
- **THEN** the call throws an error that contains `network blocked in tests`

#### Scenario: The real agent program is blocked

- **WHEN** a test starts the program `claude` or `codex` as a child process
- **THEN** the call throws `process blocked in tests: claude` or `process blocked in tests: codex`

#### Scenario: A shell cannot get around the list

- **WHEN** a test runs `execSync("curl https://example.com/")` from `node:child_process`
- **THEN** the call throws an error that contains `process blocked in tests`

#### Scenario: Local server allowed

- **WHEN** a test starts `titan serve` on 127.0.0.1 with port 0 and calls it with `fetch`
- **THEN** the call gets an answer from the server

#### Scenario: Fake agent program allowed

- **WHEN** a test starts `test/fixtures/fake-claude.ts` with Bun
- **THEN** the program runs and prints its scripted answer

### Requirement: Live tests run only when a person turns them on

A test that calls a real service SHALL be a _live test_, and its file name MUST end in `.live.test.ts`. In its separate live process, each live test MUST be skipped unless its variable is `1`: `TITAN_LIVE_CLAUDE`, `TITAN_LIVE_CODEX`, `TITAN_LIVE_ANTIGRAVITY`, `TITAN_LIVE_API` or `TITAN_LIVE_RUNPOD`. When the variable is `1` and a key that the test needs is not set, the test MUST fail and name the missing variable. It MUST NOT pass in silence.

#### Scenario: No live variable

- **WHEN** `bun test` runs with no `TITAN_LIVE_*` variable
- **THEN** every `.live.test.ts` test is reported as skipped

#### Scenario: Live variable without its key

- **WHEN** `TITAN_LIVE_RUNPOD=1` is set, `RUNPOD_API_KEY` is not set, and the RunPod live test runs
- **THEN** the test fails with the text `RUNPOD_API_KEY is not set`

### Requirement: Each outside service has a tested fake

`titan` SHALL have one fake for each outside service, and the fakes MUST live in the repository:

| Outside service                              | Fake                                                               |
| -------------------------------------------- | ------------------------------------------------------------------ |
| Claude Agent SDK, Codex SDK, Antigravity SDK | `@titan/backend-fake`, and fake agent programs in `test/fixtures/` |
| Model APIs                                   | the AI SDK mock model `MockLanguageModelV4` from `ai/test`         |
| Tool servers                                 | the MCP SDK's linked in-memory transport                           |
| RunPod                                       | the fake RunPod server with a fast clock                           |
| The person                                   | a test helper that answers requests with the person token          |
| The embedder                                 | a fixed embedder that gives the same vector for the same text      |

Each fake MUST have its own tests. A fake MUST throw on a call that it has no script for, and the error MUST name the call.

#### Scenario: Unscripted call to the fake backend

- **WHEN** a test sends the task `other` to `@titan/backend-fake`, and the fake has no script for `other`
- **THEN** the call throws `fake backend has no script for task: other`

#### Scenario: Same text, same vector

- **WHEN** a test asks the fixed embedder twice for the vector of `skeptic`
- **THEN** both vectors are equal

### Requirement: Each port has one contract test for the fake and for the real service

Each port of `titan`, such as the backend port and the embedder port, SHALL have one _contract test_. A contract test is one set of checks in a function that takes a backend or an embedder. The default test run MUST run the contract against each fake. Each live test of an adapter MUST run the same contract against the real service. A change to a fake MUST pass the contract before it is merged.

#### Scenario: Contract on the fake and on the mock model

- **WHEN** `bun test` runs with no `TITAN_LIVE_*` variable
- **THEN** the backend contract passes for `@titan/backend-fake` and for `@titan/backend-api` with the mock model
- **AND** the backend contract for the live Anthropic API is reported as skipped

#### Scenario: Contract on the live service

- **WHEN** `TITAN_LIVE_API=1` and `ANTHROPIC_API_KEY` are set and the live test of `@titan/backend-api` runs
- **THEN** the same backend contract runs against the live Anthropic API

### Requirement: Unit tests check the rules with numbers

Each package SHALL have unit tests for its rules with numbers. These are the reward, the Wilson bound, the fading counts, the split width, the limits, the approval levels and the file checks. Each rule MUST have the examples from its spec as tests. A rule over a range of inputs MUST also have a property test with fast-check and a fixed seed. A unit test MUST NOT start a process, open a port or touch the disk outside a temporary folder.

#### Scenario: Wilson bound examples

- **WHEN** the unit tests of `@titan/registry` run
- **THEN** they check the Wilson lower bound 0.640 for 17 of 20, and 0.584 for 16 of 20
- **AND** they check the upper bound 0.919 for 16 of 20, and 0.471 for 1 of 8

#### Scenario: Wilson bound property

- **WHEN** the property test runs 1000 cases with seed 42, each with a count of results from 1 to 10000
- **THEN** in every case, the lower bound is at least 0, at most the survival rate, and the upper bound is at most 1

### Requirement: Integration tests join the real parts of titan with fakes

Each package that joins other parts SHALL have integration tests. They MUST use the real code of `titan` for its own parts, and fakes only for outside services. They MUST cover at least: the runner with the board and the fake backend; the server on 127.0.0.1 with port 0; each tool server through the in-memory transport; and the RunPod backends with the fake RunPod server. Every test MUST set `TITAN_HOME` to a new temporary folder.

#### Scenario: A hive run with fakes

- **WHEN** an integration test runs a workflow file with two parallel steps, a falsifier and an `add_step` request on the fake backend
- **THEN** the board holds the added step and both results
- **AND** no file outside its temporary home, project and evidence folders changed

#### Scenario: The person's folder is not touched

- **WHEN** `bun test` runs from the repository root
- **THEN** no file in the person's `~/.titan` changed

### Requirement: Each scenario is a test case with the same name

Each `#### Scenario:` in the specs of this change SHALL have exactly one test, named `<spec> > <scenario>`, such as `persona-lifecycle > A weak persona needs an update`. The script `tooling/scripts/check-scenarios.ts` MUST list every scenario and every such test name. It MUST fail when a scenario has no executable or explicitly pending test, or when a test names a scenario that does not exist. Pending cases MUST follow the staged-build rule below. Duplicate scenario test names MUST fail. The default `bun run check` MUST run it.

#### Scenario: A scenario with no test

- **WHEN** the spec persona-board has the scenario `Unknown request kind` and no test is named `persona-board > Unknown request kind`
- **THEN** `bun tooling/scripts/check-scenarios.ts` exits with code 1 and prints `missing: persona-board > Unknown request kind`

#### Scenario: A test for a scenario that does not exist

- **WHEN** a test is named `persona-lifecycle > A scenario that does not exist`
- **THEN** `bun tooling/scripts/check-scenarios.ts` exits with code 1 and prints `unknown: persona-lifecycle > A scenario that does not exist`

### Requirement: End-to-end tests run titan as a person or a program would

The end-to-end tests SHALL run the `titan` command and `titan serve` with the fake backends, on each file in `examples/`. Each command scenario MUST have one owning test. An end-to-end owner MUST run the command; another owner MAY use a contract or unit check when the scenario tests that boundary directly. The acceptance map MUST state the test level. Additional tests MUST use distinct supporting names. The tests MUST write only isolated test reports and failure evidence. They MUST NOT generate, rewrite or publish documentation. Documentation MUST follow its own check below, replacing the document-generation rule in design decision 24.

#### Scenario: A failing scenario publishes nothing

- **WHEN** one end-to-end scenario fails on purpose
- **THEN** the test run exits with code 1
- **AND** documentation files stay byte-for-byte unchanged and the failed test report remains available

### Requirement: Coverage and mutation bars show that the tests check the code

`bunfig.toml` SHALL set `coverageThreshold = { lines = 0.9, functions = 0.9 }`. The complete coverage run MUST inventory all product source, including files never imported by a test. It MUST fail below either threshold and list uncovered files. Focused hook runs MUST NOT claim complete coverage. Branch coverage MUST NOT be claimed when the pinned runner does not measure it. Once a day and before each release, StrykerJS MUST run with its command runner on `bun test` for the packages `policy`, `falsify`, `registry` and `workflow`. A mutation score under 80 % MUST fail that run, and its report MUST list each surviving mutant. Both bars are guesses that have not been measured. In the probe, files with 100 % line coverage still had 5 surviving mutants.

#### Scenario: Coverage under the bar

- **WHEN** a commit adds a function that no test runs, and the line coverage of the run falls to 85 %
- **THEN** `bun test --coverage` exits with a code other than 0

#### Scenario: Mutation report

- **WHEN** the daily mutation run ends for `policy`
- **THEN** its report lists the mutation score and each surviving mutant with its file and line

### Requirement: A live agent test starts clean and runs three times

Each live test of an agent SHALL start from a new, empty `TITAN_HOME`. It MUST run its task 3 times and report how many of the 3 passed. It MUST pass only when all 3 passed. The 3 is a guess that has not been measured.

#### Scenario: Live result with two of three

- **WHEN** the live main-agent test in Claude Code passes 2 of its 3 runs
- **THEN** the test fails and prints `2 of 3 passed`

### Requirement: Default isolation includes child processes

The default suite SHALL run inside an operating-system network boundary with external access denied and loopback available. The JavaScript guard MUST remain as an early diagnostic, not the only boundary. Child Bun code, Git hooks and native libraries MUST inherit the block. The test command MUST refuse to run when this boundary is unavailable, rather than silently fall back. Release evidence MUST name the mechanism used on each supported platform.

#### Scenario: Child Bun tries the network

- **WHEN** an allowed child Bun program tries to reach an external test address
- **THEN** the connection fails inside the default test boundary

#### Scenario: Git hook tries the network

- **WHEN** an allowed Git operation invokes a hook that tries to reach an external test address
- **THEN** the connection fails and the test's loopback fake remains reachable

### Requirement: Live enablement is scoped to its test group

A live variable SHALL grant access only to that live group in its separate test process. Default tests MUST keep stripped keys and blocked external access even when a live variable was inherited. Jaeger tests MUST use `TITAN_LIVE_JAEGER`. A skipped live test MUST NOT count as verified release evidence.

#### Scenario: Live flag with default tests

- **WHEN** the shell has `TITAN_LIVE_API=1` and the default suite runs
- **THEN** default tests still cannot call a model API and the live group runs only through its separate command

### Requirement: Staged builds expose all unbuilt scenarios

During implementation, the scenario checker SHALL also read a tracked acceptance map with a task and delivery stage for every scenario. An unbuilt scenario MUST have a named pending test and an open task; it MUST be reported as pending, never passed. An implemented task MUST have executable tests for all its scenarios. Missing, duplicate, unknown or falsely completed mappings MUST fail. The full-release check MUST reject any pending, todo or skipped required scenario. Live scenarios MUST use recorded passing runs for the claimed support matrix.

#### Scenario: Pending scenario on a full release

- **WHEN** the release checker finds a required scenario marked pending
- **THEN** it fails and names that scenario and its open task

#### Scenario: Completed task has no executable test

- **WHEN** a task is checked complete but one mapped scenario has only a pending test
- **THEN** the default check fails with that task and scenario

### Requirement: Concurrency tests must defeat serial implementations

The default suite SHALL test different harness clients and multiple submissions from one harness using fake adapters. Tests MUST use barriers that require overlapping active workers before completion. Merely observing two eventual successes MUST NOT satisfy concurrency coverage. Tests MUST cover bootstrap races, retry deduplication, fair admission, request isolation, same-project files, independent cursors, cancellation and restart. A serial scheduler and deliberately swapped session ids MUST fail these tests.

#### Scenario: Serial scheduler fails the overlap test

- **WHEN** a test substitutes a scheduler that completes A before starting B
- **THEN** the overlap assertion fails instead of accepting both final results

#### Scenario: Swapped callback fails the isolation test

- **WHEN** a test swaps callbacks from runs with identical step and persona names
- **THEN** the isolation assertion fails even if both runs report success

### Requirement: Test tiers have one home and independent lifecycles

Tests SHALL live under `test/unit/<package>`, `test/integration/<package>`, `test/contract/<port>`, `test/e2e` and `test/live`. Shared helpers and response fixtures MUST live under `test/helpers` and `testing/fixtures`. Tests MUST not ship in product packages. Unit tests MUST not open a database, socket or child process. Integration tests MUST use real Titan components and stub only external boundaries. End-to-end tests MUST start real CLI, HTTP or MCP entry points in isolated processes. Port tests MUST share contract assertions with their live counterparts. Tests MUST use temporary homes, allocated ports, bounded waits and reliable cleanup. Independent isolated files MAY run concurrently within a fixed worker cap. Isolated case tables MAY opt into concurrent execution within a central cap of two. Ordinary cases MUST stay serial. A failed case MUST fail the runner while admitted cases drain and queued cases still execute. Resource-heavy mixed plans MUST retain their internal parallel agents without exceeding the container budget through additional case concurrency. Global mock or environment changes MUST not leak between files.

#### Scenario: Parallel tests do not share a home

- **WHEN** two end-to-end files run together and both use a run called `fix`
- **THEN** each has a different temporary home, project and allocated port, and cleanup leaves the other active

#### Scenario: Isolated cases respect the test runner cap

- **WHEN** shared case tables run in explicit concurrent and ordinary serial modes, with successful and deliberately failing cases
- **THEN** concurrent cases overlap at a maximum of two and serial cases never overlap
- **AND** all cases finish, active work drains to zero and a deliberately failed case keeps the runner unsuccessful

#### Scenario: Unit test starts a server

- **WHEN** a file under `test/unit` opens a listening socket
- **THEN** the tier check fails and requires moving that test to integration

#### Scenario: Global mock leaks into another file

- **WHEN** one test replaces a vendor module and another expects its own script
- **THEN** the isolation checks detect the leak; separate process state prevents it in the passing implementation

### Requirement: Vendor stubs exercise the actual adapters

The default end-to-end suite SHALL use fixed vendor responses with no real credentials or external calls. At least one offline contract per released adapter MUST execute its real request and response mapping against a stub transport or fake vendor program. Replacing the whole adapter with `backend-fake` MUST NOT count as adapter mapping coverage. Scripts MUST cover success, malformed output, tool calls, usage, throttling, interrupted streams and cancellation. Unscripted calls MUST fail. Request matching MUST check relevant fields rather than only return a canned success. Fixtures MUST name their contract version and MUST contain synthetic or sanitized data. Live contracts remain separate release evidence for vendor compatibility.

#### Scenario: Adapter drops a required request field

- **WHEN** a real API adapter omits its required model field when calling a loopback vendor stub
- **THEN** the stub rejects the request and the offline contract fails

#### Scenario: Vendor stream stops before completion

- **WHEN** a stub emits part of a response then disconnects
- **THEN** the run keeps failure evidence and applies the bounded retry rule without marking the partial result as kept

#### Scenario: Cancellation reaches a fake vendor process

- **WHEN** the real adapter is connected to a fake vendor program when its run is cancelled
- **THEN** the owned fake process stops and another run's process continues

#### Scenario: Unexpected vendor call cannot succeed

- **WHEN** a worker makes an extra request that no response script matches
- **THEN** the test fails with that request identity instead of contacting a real vendor

### Requirement: Documentation has its own small checks

Documentation SHALL be maintained as readable source files. `bun run check:docs` MUST check local links, plain language, command names, option names and example workflow syntax against the shipped schema. It MUST NOT generate pages from end-to-end tests or start a documentation site. Command examples needing execution MUST use a focused stubbed smoke test independent of page generation. End-to-end success or failure MUST leave documentation unchanged. Schema-derived reference files MAY be checked for drift in this separate command. Dashboard screenshots MUST be optional test evidence rather than inputs needed to build documentation.

#### Scenario: Passing tests leave documentation unchanged

- **WHEN** the complete end-to-end suite passes
- **THEN** all tracked documentation hashes remain unchanged and only test report folders receive evidence

#### Scenario: Documented command no longer exists

- **WHEN** a guide names an option removed from the CLI contract
- **THEN** the documentation check fails without invoking an end-to-end suite

#### Scenario: Invalid example is caught without vendors

- **WHEN** a guide workflow references an unknown persona
- **THEN** the documentation check rejects it using the real schema with no vendor call

### Requirement: The complete gate verifies all required scope once

The full offline check SHALL enumerate all product files and default test tiers before running. Every required test MUST execute once per check; support runs MUST be named separately. Its report MUST retain per-stage and per-test outcomes. Required pending or skipped cases MUST follow existing stage and release rules. A green smoke test MUST NOT replace full scenario coverage. The full gate MUST verify its own selector, guard, package graph and hook configuration with deliberately failing fixtures. Product builds and packed-install checks MUST run for release and packaging changes, without becoming a routine hook dependency. Dependency security audits MUST run in a separate CI job for dependency changes and on a schedule; they MUST gate affected merges and releases.

#### Scenario: New source is never imported by tests

- **WHEN** a new product module is added without any test importing it
- **THEN** the source inventory includes it and the coverage gate reports its uncovered lines

#### Scenario: Full check silently omits end-to-end files

- **WHEN** a selector mutation leaves `test/e2e` out of the full run
- **THEN** the gate fixture fails even when every executed unit test passes

Focused offline test selections MUST resolve every requested file or directory to regular test files in the named tiers before starting test children or coverage checks. A missing request MUST fail even beside a valid request. Discovery MUST reject symbolic test files, empty selections and exhausted argument, entry or file budgets. Overlapping selections MUST execute each selected test once. The complete product coverage requirement remains in force for focused runs.

#### Scenario: Missing focused test cannot disappear

- **WHEN** a focused offline command names a valid test and a missing test
- **THEN** selection fails before any test child starts and identifies invalid selection

#### Scenario: Focused inventory cannot silently shrink

- **WHEN** discovery encounters symbolic test files, no selected tests or an exhausted inventory budget
- **THEN** the offline command refuses the selection before execution instead of running a partial inventory

#### Scenario: Documentation build is added to pre-push

- **WHEN** a hook configuration invokes a site generator before pushing
- **THEN** the hook configuration test fails and names the prohibited step

### Requirement: Recovery falsification covers every phase and installed usage

Offline verification SHALL inject rate limits, process exits, lost streams, quota blocks and daemon death in workers, falsifiers, judges and goal checks. It MUST also inject faults before and after checkpoint flush, action intent, effect acknowledgment and publication. Tests MUST use deterministic clocks, vendor stubs and isolated homes. Assertions MUST verify attempt identities, files, usage, pending work and once-only publication across restart. A mutant that spends a result attempt on interruption MUST fail these tests. Another mutant that reruns the whole workflow MUST fail them. Documentation checks MUST remain independent from end-to-end execution. Packed installation, mixed graphs and all deliverable examples MUST run in the offline acceptance path.

#### Scenario: Recovery mutants are detected

- **WHEN** one fixture spends attempt 3 on a rate limit and another reruns a completed step after restart
- **THEN** both implementations fail the recovery acceptance cases

#### Scenario: Crash at publication boundary

- **WHEN** the server stops immediately before or after committing kept artifacts and hub changes
- **THEN** replay either completes the uncommitted set safely or recognizes the committed set without double publication
