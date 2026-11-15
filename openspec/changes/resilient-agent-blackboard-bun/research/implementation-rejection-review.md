# Rejected implementation review

The person rejected the first runtime on 2026-11-07. Passing coverage and a fake run do not satisfy the requested delivery. The rejected commits remain in history; they are not an accepted baseline for readiness.

## Findings from the code and sibling project

| Finding                                                           | Evidence                                                                                  | Required correction                                                                                                     |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| CLI mixes transport, parsing, policy, runtime assembly and output | `apps/cli/src/main.ts` has all of these responsibilities                                  | Use a declarative command catalog, per-command validation, handlers, client port and a separate composition root.       |
| Flags can be silently ignored                                     | The global parser accepts `status --backend fake` and extra positional values             | Reject irrelevant, conflicting and extra arguments before I/O. Generate help from those same definitions.               |
| Repeated protocol values can drift                                | Backend identifiers occur in core, config, server and CLI                                 | Use owning constants and derive validation and types from them. Avoid moving unrelated values into a catch-all package. |
| Package rules are only prose                                      | No executable graph check rejects deep imports or undeclared dependencies                 | Add an import-aware graph validator and adversarial fixtures. Check public exports and dependency direction.            |
| Tests mix tiers and mutate global process state                   | CLI tests replace console and emit process signals                                        | Inject output and lifecycle ports. Keep pure command tests separate from real process integration.                      |
| Development gates are incomplete                                  | No pinned hooks or CI workflow                                                            | Implement the agreed scoped gates and complete offline CI, with no automatic rewrites or vendor calls.                  |
| High coverage hides absent contracts                              | Fake answers bypass the real SDK executable protocols                                     | Add versioned vendor executable stubs and real transport tests before adapter readiness.                                |
| End-to-end delivery is incomplete                                 | Applying artifacts, writer fencing, credential binding and native recovery remain pending | Preserve these as delivery blockers and exercise installed code and document workflows through failure and restart.     |

The sibling project's applicable engineering rules govern this repair, including async functions, comment restrictions, enums, schemas, centralized configuration and messages, shared bounded stores, capped concurrency, complete product coverage and flat factory-based tests. The person further requires buffers for file data, streams where useful, and a minimum of two positive and two negative `.each` cases per test subject. Earlier discretionary exceptions were rejected. Documentation independence remains the earlier instruction while clarification is pending.

## Order of repair

1. Replace the CLI monolith and enforce its command contracts. Add negative tests that fail the rejected implementation.
2. Enforce declared public package boundaries and prevent regressions with fault fixtures.
3. Finish scoped hooks, complete CI and test-tier ownership. Record timings without skipping checks.
4. Exercise both actual SDK transports against strict versioned stubs, then installed mixed-plan restart and artifact delivery.
5. Close the remaining first-delivery acceptance cases before requesting acceptance again. Do not describe a refactor or fake smoke test as end-to-end completion.

Track execution and evidence in `implementation-state.md` and the existing tasks 2.4, 27.1 through 27.10, 30.1 through 30.6 and 31.1 through 31.6.
