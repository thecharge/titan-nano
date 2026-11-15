# End-to-end specification sweep

Reviewed on 2026-11-06 for `resilient-agent-blackboard-bun`.

The 2026-11-07 recovery and delivery follow-up is in `recovery-config-delivery-review.md`. It supersedes earlier interruption accounting and adds configuration, CLI and distribution contracts. Earlier counts and verification below remain historical evidence.

The change is a staged implementation baseline and a reviewable PRD variant. It is not an implemented or released product. The sweep reconciles the documents and adds counterexamples; it does not prove that the future implementation satisfies them.

## Objective and constraints

Review the entire path from a person's request through planning, validation, execution, falsification, selection, publication, recovery, reporting and release. Keep the accepted capabilities and mandatory Bun stack. Preserve unrelated work. Do not run live models, paid compute, publishing or deployment as part of this specification sweep.

The OpenSpec explore workflow was used to inspect and amend the existing artifacts. No product implementation task was started. Only specification verification tooling was changed.

## Result and entry points

- `proposal.md` is now a concise entry point with intended users, behavior, scope and limits.
- Design decisions 36 and 37 define the reconciled contracts, delivery stages and release gates. The open questions now name evidence owners and what each unknown blocks.
- All 23 capabilities remain. At the end of the concurrency sweep, the change had 249 requirements, 395 scenarios and 220 open product tasks.
- All 304 original scenario identities remain. The sweep adds 91 cases and 33 implementation tasks. The concurrency follow-up contributes 35 of those cases and nine tasks.
- `acceptance-map.tsv` assigns every scenario to a requirement, task, delivery stage and intended test level. Every row is pending. Ownership is planned coverage, not proof that a test exists.
- `benchmark-protocol.md` defines a proposed comparison of one agent, fixed Titan and adaptive Titan. Its freeze and execution tasks remain open.
- The Python specification checker now checks coverage ownership and command coverage. Its isolated fixtures exercise successful validation and rejection paths.

## Falsification pass: concrete counterexamples

Each row describes a way the earlier contract could fail. “Repaired” means the specification now states the required behavior. The corresponding product test is still pending.

| Counterexample                                                             | Contract repair                                                                                                                              | Owning tasks        |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| A proof-only step is accepted by one spec and rejected by another.         | At least one check across `falsify` and `verify`; apply the same rule to added steps.                                                        | 25.1                |
| The new dashboard and proof commands never reach the CLI list.             | Include both commands and check list coverage and count.                                                                                     | 2.2                 |
| A final goal check fails after every step passes.                          | Fail the run with goal evidence; preserve step outcomes and require a new plan for further work.                                             | 25.3                |
| Kept results are counted as both all-proven and only partly proven.        | Summary includes kept-step checks plus goal checks; discarded-attempt totals remain separate.                                                | 25.8                |
| Recheck silently uses changed files or rewrites learned history.           | Validate saved hashes and versions; store a separate observation; keep earlier accounting immutable.                                         | 25.8                |
| The first script run changes the files used by its second run.             | Run both checks from separate copies of the same candidate snapshot.                                                                         | 25.8                |
| An SMT assumptions check times out but the claim is declared proven.       | Require satisfiable assumptions and typed values before checking the negated claim.                                                          | 25.9                |
| A worker supplies its own Lake configuration or a missing solution path.   | Use locked imports and configuration; require an explicit or default solution file.                                                          | 24.3, 25.8          |
| Repeated crashes reset attempts and usage.                                 | Retain interrupted attempts, execution ids and usage; never reopen terminal runs.                                                            | 25.4                |
| A late answer publishes after cancellation.                                | Durable cancellation ignores late results and prevents publication.                                                                          | 25.4                |
| Split results arrive in a different order or contain no parts.             | Preserve input order; an empty split produces an empty result without agents.                                                                | 25.5                |
| Two surviving branches write different bytes to one path.                  | Reject conflicting parallel assembly with producing steps named. Sequential descendants keep the latest version; preserve earlier snapshots. | 25.5                |
| A losing candidate adds work despite losing the selection.                 | Activate additions only from the kept candidate.                                                                                             | 25.6                |
| Helpers form a long chain to evade the work limit.                         | Charge every invocation to the common finite allowance.                                                                                      | 25.6                |
| The improver adds a proof script or removes a locked check.                | Reject protected changes deterministically before model review.                                                                              | 25.7                |
| Evaluation recursively starts improvement or resets the paid deadline.     | Parent alone schedules rounds; all evaluation work shares the allowance and deadline.                                                        | 25.6                |
| Parent and evaluation runs count the same usage or persona result twice.   | Separate provisional and terminal phases; record linked ids and aggregate once.                                                              | 25.24               |
| Two runs overwrite the same persona version or replay its counts.          | Single-writer allocation and result-identity-based history updates.                                                                          | 25.12               |
| A stale pending edit partially publishes a multi-entry update.             | Commit the set or keep it unpublished and report a publication conflict.                                                                     | 25.12               |
| Installed credentials alone make an untested backend ready.                | Require a verified platform and capability matrix as well as setup.                                                                          | 25.14, 25.19        |
| A copied workflow or backend answer stores a key before the guard runs.    | Check values before persistence; discard unsafe input without saving its text.                                                               | 25.14               |
| A same-user agent reads the person token.                                  | State the trusted-agent limitation; test denied access before claiming human-only enforcement.                                               | 22.19               |
| Tool-server approval is treated as blanket authority for its tools.        | Bind operation scope and hashes; keep external-action checks per operation.                                                                  | 25.10               |
| Each worker needs a new identical bundled-server approval.                 | Reuse a run-scoped approval with distinct host-bound session capabilities.                                                                   | 25.23               |
| A plug-in executes during unapproved import or dry-run.                    | Gate import as executable work; dry-run reads static metadata only. Preflight provides an answerable request before module validation.       | 25.23               |
| A candidate forges another attempt id, or a judge changes the hub.         | Host-bound session scope; reviewer and helper hub access is read-only.                                                                       | 25.22               |
| The shared server interprets client paths from its own folder.             | Record absolute client project and workflow paths; use the single writer for shared changes.                                                 | 25.10               |
| A reconnect loses an event between replay and live subscription.           | Durable cursor handoff and client deduplication; refuse invalid future cursors.                                                              | 25.10               |
| Dashboard login requires the cookie it is supposed to create.              | Make one-time-code login the explicit exception; consume atomically and redirect without the code.                                           | 25.10               |
| Evidence injects browser code or missing costs appear as zero.             | Render text without execution and label partial usage totals.                                                                                | 25.11               |
| A live flag disables default-test isolation or a child process escapes it. | Separate live groups; require an operating-system boundary as well as the JavaScript guard.                                                  | 25.17               |
| A policy has no cold-start rule, update formula or concurrent ordering.    | Specify seeded beta draws, priors, score comparison, fading and single-writer updates.                                                       | 25.13               |
| Width one triggers an alarm although the run allowed no parallel work.     | Restrict the alarm to splits that could use a greater width; keep base rewards immutable.                                                    | 25.13               |
| Stopping a vLLM call is reported as stopping endpoint billing.             | Distinguish local request cancellation from endpoint lifetime and billing.                                                                   | 25.20               |
| A partial build or toy reward is presented as a fully effective release.   | Separate stage previews, functional release and benchmark-backed effectiveness claims.                                                       | 25.15, 25.16, 25.18 |

## Recheck of the repairs

A second pass checked neighboring rules, rather than stopping at the first patch:

- Proof short-circuiting now agrees with the rule to run configured falsifiers. Errors cannot count as survival.
- Split width limits active parts; the parallel limit counts every active role.
- Goal checks use a goal identity, not a fictitious step or attempt. Goal locks precede worker execution.
- A final failed run cannot resume after its reward and history have been learned.
- Default tests ignore inherited live flags. Separate live processes require their own enablement.
- Staged builds may report named pending tests, but completed tasks need executable coverage. Full release rejects required pending or skipped coverage. Existing coverage and mutation bars remain unchanged.
- The guide distinguishes isolated candidates from parallel branches that must combine file changes.
- The design's earlier recovery, approval, telemetry and proof-summary prose was reconciled with the new decision.

This was a contract review by the same agent, with automated rechecks. It was not an independent-agent audit or an executable product falsification run.

## Verification evidence

`sweep-verification.txt` records the observed output:

| Check                                                                        | Observed result                                                                                                                    |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `python3 -I scripts/check-specs.py`                                          | Passed: 23 capabilities, 249 requirements, 395 scenarios, 220 tasks, zero structural errors.                                       |
| Plain-language check called by the specification checker                     | Passed: 26 active files, zero findings.                                                                                            |
| `python3 -I scripts/test-check-specs.py`                                     | Passed: 13 isolated fixtures, including missing and duplicate mappings, invalid ownership, false completion and command omissions. |
| `openspec validate --all --strict`                                           | Passed for the active change.                                                                                                      |
| `git diff --check`                                                           | Passed.                                                                                                                            |
| Original scenario identity comparison against `HEAD`                         | Retained 304 of 304; added 91.                                                                                                     |
| Historical research ledger checker                                           | Passed structure: 94 entries, zero failures.                                                                                       |
| Historical quote checker, using source ids searched across the research tree | Failed: 10 quotations found in probes, 146 missing; no expected historical source-text files found.                                |

The historical quote failure was not repaired by changing quotations or weakening the checker. Structural ledger validity does not establish that a source supports a claim.

## Remaining evidence gates

No root Bun workspace, installable CLI or product test suite exists. No product, live adapter, paid RunPod, ordinary-host Lean sandbox, clean-package installation or benchmark test ran in this sweep. API bindings and package versions remain historical observations until pinned sources and contract runs verify them.

The build can start with the foundation stage. Backend-specific support, human-only enforcement, remote stopping, proof isolation and effectiveness remain gated by their named evidence tasks. A preview may state a tested subset; it may not claim the full change is shipped.

## Continuation

1. Read design decisions 36 and 37 and the acceptance map before implementing a package.
2. Build the foundation and local path with fakes, failure cases and real candidate isolation.
3. Prove one real adapter on Linux, including guide loading, permissions and cancellation. Record exact versions and limitations.
4. Add the remaining capability stages and turn each mapped pending case into an executable owning test.
5. Restore or replace reliance on historical evidence through fresh primary-source checks. Do not treat this sweep as SDK verification.
6. Freeze the benchmark protocol before scored runs. Obtain separate authorization for paid or credentialed probes.
7. Run full default, live, package and release gates. Do not archive this change while implementation remains open.

## Concurrent workflow follow-up

The user requested parallel workflows across harnesses and multiple workflows within one harness, with shared visibility. Decision 37 and task group 26 make this part of the local execution gate. No product tasks are marked complete.

| Counterexample                                                             | Required outcome                                                                           | Tasks            |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------- |
| Two runs finish successfully but never overlap.                            | A barrier requires three workers to start before any finishes. Serial scheduling fails.    | 26.3, 26.9       |
| The daemon uses its first caller's harness for every later run.            | Caller-specific detection and persisted backend choices.                                   | 26.1             |
| One MCP connection replaces its earlier run handle.                        | Independent handles, cursors and cancellation across outstanding runs.                     | 26.6             |
| A lost start response duplicates paid or local work.                       | Persisted submission ids and hash-checked deduplication.                                   | 26.1             |
| A busy run fills every newly free slot.                                    | Durable round-robin admission; waiting sessions release slots.                             | 26.3             |
| Two startup clients lose one submission to the home lock.                  | Connect both clients to the winning writer.                                                | 26.2             |
| Identical step names route answers or callbacks to another run.            | Full execution identities and explicit request/run/version checks. Swapped callbacks fail. | 26.4, 26.5, 26.9 |
| Cancelling or cleaning one run kills another.                              | Isolated session handles, folders and targeted cleanup.                                    | 26.4             |
| A global dashboard hides queued runs or mixes live event ids.              | Global origin-filtered overview, capacity reasons and per-run cursors.                     | 26.7             |
| Concurrent publication exposes a partial set or changes an active persona. | Consistent committed revisions and stable resolved versions.                               | 26.8             |

The server cap of 8 is a design guess. Fair admission does not promise preemption or vendor quota isolation. No live concurrency or dashboard implementation was tested: all mapped scenarios remain pending. Commit and push to main are authorized for this review by the user's follow-up.

## Development practices follow-up

The later sibling comparison is in `development-practices-review.md`. Decision 38 supersedes end-to-end documentation generation and full local checks before each commit. It adds scoped hooks, full offline CI, adapter response stubs, checked package imports and independent documentation checks. Its verification record is separate from `sweep-verification.txt`, which describes the earlier sweep. All implementation and timing tasks remain open.
