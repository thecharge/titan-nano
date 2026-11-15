# Backend capacity and physical run admission

## Objective and scope

Continue the authorized Codex and Claude product delivery under OpenSpec. Preserve normal hooks and frequent verified pushes to main. This increment implements owner backend budgets and admission without a busy backend reserving another backend's active slots. Task 26.3 stays open: durable admission, restart fairness and queue telemetry are not accepted by these cases. Native skill and MCP bindings and the self-development test remain open. Do not load the Titan skill or call live vendors until requested.

## Published baseline

Main was independently confirmed at bb928f3eae3a13144976dcbad4d35fc75334cd5e with git ls-remote. That Claude cleanup increment passed its normal staged gate: 2,645 tests, zero failures, 194 product sources and zero coverage gaps; tests took 245.337 seconds and the staged hook 260.07 seconds. Its outgoing gate exited zero with 194 sources and zero gaps, tests in 253.704 seconds and the complete hook in 267.96 seconds. The push completed normally. Repository Actions were found disabled. Approval to change that repository setting is still pending; no independent CI success is claimed for this baseline.

## Implementation

The central config schema adds optional home-only server.backend_limits for codex-sdk, claude-sdk and fake. Each value is a positive safe integer or null; omission and null add no backend ceiling. No default is inserted into legacy snapshots. Lower layers cannot set server budgets. The daemon forwards the checked map to Engine. The capacity owner copies its input, bounds backend counts by the closed backend identities, and bounds run counts and queues by the existing resident and pending limits.

Admission combines the global ceiling, each run's physical max_parallel ceiling and its backend ceiling. It rotates queued runs and scans within each run for eligible work. A newly available backend can pass a saturated one. Ready graph nodes can wait in the bounded pending-agent queue without occupying active run slots. Worker input preparation, checker preparation and worker checkpoint copying occur inside admission. Preparation or queue failure precedes native execution counters. Repeated attempts, request turns, backoff, native handles and session cleanup retain their existing ownership. A zero pending budget can operationally block excess ready work; it never invents a completed result or refutation. Resume after capacity drains.

The home file is read at daemon startup. Restart after an owner edit. This is not a live budget-revocation protocol or an implementation of adapter-declared maxConcurrentSessions. Default tests use injected fake backends under the native backend identities, not paid calls or native permission evidence.

## Verification observed before normal hooks

- Frozen install exited zero without a lockfile edit.
- Typecheck exited zero before the accepted focused runs.
- The first two-slot graph counterexample produced 23 passes and two actual failures: independent branches could not pass a saturated backend. This established the old node-window barrier. After physical admission and bounded preparation were implemented, 92 focused cases passed across five files in 1.285 seconds.
- Added direct physical-run ceiling and queued-head counterexamples, then held checker admission and cancellation cases for both backends at engine and HTTP boundaries. The final focused selection passed 112 cases across six files in 9.89 seconds. Its command exited one only because focused selections omit global coverage: 195 product sources, 153 omitted or uncovered gaps. It is not a clean full-suite result.
- HTTP cases submit two runs, require the other backend to finish while the first is held, inspect total started worker segments, and then cancel or drain the owner. Both backend directions retain one quality attempt and zero refutations. The fixture counts starts without assuming which parallel node wins filesystem preparation.
- A refactor typecheck caught a missing manifest-path local and nullable input narrowing. A dependent focused run was mistakenly started before those errors were fixed; it failed 14 cases and is not acceptance evidence. The recorded accepted runs followed corrected, observed successful type checks.
- The actual pinned scratch-pad structure checker ran read-only on nine new or replaced capacity modules, support, factories, cases and registrations, with zero findings after the final edits. Existing engine and phase findings remain outside this acceptance; this is not whole-repository parity.
- All central non-test checks exited zero: formatting, type and lint policy, schema ownership, flat test structure, spelling, bounded promises, async filesystem access, unused code, package boundaries and policy, OpenSpec, technical documents and package READMEs.
- The first installed archive probe exposed a backoff fixture that treated every running graph node as an execution start. With physical admission, queued nodes may already be running logically. The fixture now checks the event's step identity. It also allows the peer's initial worker to begin before the checker enters backoff, while still requiring the next dependent node to start with the original recovery checkpoint intact. A focused run caught the remaining checker-order assumption with two failures before that correction; the final six-file run has no test failures.
- A fresh archive installed outside the checkout passed the complete offline package probe with exit zero. Archive SHA1: 82d1b2ba289cacaf8f15af3ea11221e5a482674e. Observed checks include CLI/HTTP/MCP requests and decisions, the four-step installed workflow, 16 SDK recovery cases, four Claude retry cases, six Claude backoff cases, four mixed-backoff cases, four eight-step mixed native deliveries, four active-recovery cases, eight native request-turn cases and four parallel request-turn cases. Vendor responses were strict stubs; no live calls ran.
- The first normal staged hook correctly rejected this increment: 2,692 tests passed, one recovery fixture failed, 195 sources had zero coverage gaps; the hook took 271.58 seconds. The fixture held a peer worker while waiting for the original checker to start under a one-agent ceiling. Physical admission fairly queued the checker behind that held worker. The fixture now holds the peer's matching phase, preserving the intended proof that independent work advances during worker or checker backoff. After an observed successful typecheck, the affected recovery, mixed-backoff and capacity selection passed all 57 cases across three files in 11.90 seconds. Its nonzero command result reflects the focused global coverage gaps, not test failures. The complete hook must still pass before commit and push.

## Falsification

The initial front-of-queue mutant survived, revealing that the first tests only exercised a peer arriving with a free slot. A new table fills both global slots, queues the blocked backend and the peer in one run queue, then releases the unrelated blocker while retaining the first backend. It requires the peer to pass the blocked head in both directions and checks cancellation as negative cases.

After that repair every mutant typechecked, produced actual test failures, and restored the exact original bytes in finally:

| Deliberate defect                        | Passing cases | Failing cases |
| ---------------------------------------- | ------------: | ------------: |
| Ignore the backend ceiling               |            11 |            22 |
| Ignore the per-run ceiling               |            29 |             4 |
| Examine only the front of each run queue |            31 |             2 |
| Restore the old running-node window      |            31 |             2 |
| Drop daemon backend-budget forwarding    |            29 |             4 |

Logs are local /tmp/titan-backend-*.log; the summary is /tmp/titan-backend-mutations.json. The initial surviving mutant is not reported as a detected defect. All mutation runs use the offline boundary and the shared flat cases.

## Remaining verification and next actions

Review the full diff. Commit and push this coherent increment through normal hooks; record the exact gate results and remote identity in the next work record. Do not edit this checkout while verification is running. Only one offline suite, installed probe or mutation run may run locally at a time. Preserve the parked worktrees and stashes, and root .agent, .claude and .codex folders.

After this increment, native persona tool and skill bindings still need product implementation and pinned primary-source checks. The fast-hook receipt design remains open; current source gates take several minutes each and do not meet the accepted fast-development targets. Independent CI remains blocked by the disabled Actions setting pending the person's answer. This change does not establish production readiness or live self-development.
