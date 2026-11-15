# Titan Nano readiness review

Reviewed on 2026-11-06 against the active change `resilient-agent-blackboard-bun`.

This is the earlier review snapshot. The later specification sweep, current counts, falsification cases and rechecks are in `end-to-end-review.md`. Product evidence blockers below remain open unless that report states otherwise.

The specification can guide a staged build. Titan Nano is not ready to install, use or release. This checkout contains a proposal, design, 21 capability specs and research probes. It has no root Bun workspace, product packages, built CLI or product test suite. OpenSpec's completed artifact status means that planning documents exist; it does not mean that the product exists.

## Problems corrected in this review

| Problem                                                                                                                      | Correction and evidence                                                                                                                   | Build task                             |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Project context excluded the HTTP and MCP surfaces required by the proposal.                                                 | `openspec/config.yaml` now names the local server and both tool servers.                                                                  | Existing server and tool-server groups |
| Hub kinds excluded plans, and persona paths used both singular and plural forms.                                             | The hub accepts `plan`; persona files use `knowledge/persona/` throughout active artifacts.                                               | 22.3                                   |
| Sessions had no cancellation or cleanup method despite run deadlines.                                                        | The session port now requires cancellation and repeatable cleanup.                                                                        | 22.20                                  |
| Empty rewards could divide by zero, and policy replay could learn twice. Alarms also changed weights assigned to the person. | Empty rewards use zero survival share; terminal updates are keyed by run id. Alarms use an effective multiplier.                          | 22.21                                  |
| A refuted attempt could publish when a later attempt passed. Losing candidates could publish too.                            | Changes are private to a candidate attempt; only the kept candidate publishes. Persona deletion keeps its human approval through the hub. | 22.1, 22.4                             |
| The design treated file writes inside SQLite transactions as recoverable together.                                           | One writer journals file changes and repairs the index on restart. Pending updates cannot overwrite a newer committed version.            | 22.2                                   |
| A 10% pick floor is impossible for more than ten versions. `needs_update` versions were both eligible and excluded.          | The floor is `min(0.1, 1/N)`. Eligible states now agree. Missing Wilson acceptance scenarios were added.                                  | 22.5, existing 20.5                    |
| Parallel groups promised to start together regardless of limits. Helpers could deadlock at width one.                        | Every active agent role counts; waiting agents release places. Circular helper requests and oversized splits are refused.                 | 22.7                                   |
| Concurrent code candidates had no separate file state.                                                                       | Each attempt has its own folder; code uses separate Git worktrees. Falsifiers test that candidate's files.                                | 22.8                                   |
| Recovery lacked resolved paths, durable acknowledgements and action outcomes.                                                | The board records replay inputs, only one writer owns a home, and uncertain external actions wait for the person.                         | 22.9, 22.10                            |
| A resumed RunPod run could exceed its original hour. Worker-time language implied a guaranteed billing cap.                  | The deadline survives restart. Later work needs a new run and approval. Failed cancellation leaves the remote state unknown.              | 22.11, 22.12                           |
| Every backend needed a local hub server, but a remote worker could not start a host program.                                 | Workers use their own bundled server and a final-entry snapshot. Pending changes return with the result.                                  | 22.13                                  |
| Initial plans could avoid request approvals; paid compute and limit raises could be lowered in config.                       | Initial and added work use the same checks. These request kinds remain at human level.                                                    | 22.10, 22.12                           |
| Falsifier aliases, invalid counts and empty backend lists had no explicit rejection.                                         | New workflow scenarios cover resolved identities, positive limits and backend lists.                                                      | 22.6                                   |
| JSON output mixed final objects, live events and MCP streams. The command list omitted two required commands.                | Run JSON contains an ordered event array. Protocol streams keep their formats. The list includes `trace` and `tool-server`.               | 22.14, existing 2.2                    |
| Dry-run math claimed a whole-run bound while excluding runtime work.                                                         | It bounds only known static work and names unknown work without executing plug-ins.                                                       | 22.15                                  |
| The build check needed an untracked skill file. The plan requested an intentionally broken push to main.                     | A tracked writing checker and spec checker now run without a workspace. Failure checks use local fixtures.                                | Existing 2.13                          |

These are specification repairs. Their acceptance scenarios are requirements for future tests, not tests that passed today.

## Fitness for purpose and use

The main-agent workflow, separate backend adapters, saved personas and falsification records fit the stated purpose: coordinate work and keep evidence about attempts to refute it. Surviving a set of checks does not establish truth. Scientific, legal and business answers still depend on the chosen sources, tools and falsifiers.

Usefulness remains unmeasured. The orchestration results are toy experiments. Neither the learned widths nor the persona statistics establish a gain on real tasks. Before claiming better outcomes, compare the same tasks with one agent and a fixed workflow. Record correctness, elapsed time, model usage, paid cost and repeated-run variation. Keep the policy experimental until this comparison exists.

The full release spans six built-in backends, three harnesses, a server, two tool-server modes, local embeddings and paid remote compute. This is a large first delivery. Build a thin path first: schema, fake backend, isolated worker and script falsifier, board, result record and recovery. Then prove one real adapter end to end. Add shared knowledge, other adapters, learning and RunPod behind their own evidence gates. This order changes no accepted capability.

## Remaining release blockers

- No product code exists. All original implementation tasks remain open. The new tasks describe the review's acceptance work.
- SDK identity, permissions, tool and skill loading, and platform questions in group 1 remain unproved. Dependency versions in research are historical; check current primary documentation before implementation.
- Mode 600 does not separate a person from an agent running as the same operating-system user. The token authenticates possession, not human presence. Do not claim protection from an agent with unrestricted file access. Resolve task 22.19 before claiming human-only enforcement.
- The JavaScript test guard is not an operating-system boundary. Allowed Bun code or Git hooks can evade parent-process patches. Prove child-process isolation with task 22.18.
- Initial scripts and native SDK tools need an enforceable permission path. A written `action` rule alone does not intercept commands. Backends without proof remain unready for external actions.
- RunPod remote-stop behavior and billing limits need live evidence. A local timeout or submitted cancel request cannot prove remote work stopped.
- The original quote corpus is absent. The existing checker finds 10 of 156 passages in available probes; 146 have no source text file. The 94-entry ledger passes structural checks only. Historical quote claims cannot be independently reproduced from this checkout.
- No clean-package installation, supported-platform matrix, release benchmark or delivery estimate has been verified. Task count is not an estimate of effort.

## Verification and continuation

Strict OpenSpec validation passed for the one active change after the repairs. The structural checker and four negative fixtures passed. Every original requirement and scenario heading was retained. The writing check covered 24 active files with zero findings. This report also passed its separate writing check. The ledger check covered 94 entries with zero structural failures. The original ledger and prior review were retained.

Run `python3 -I scripts/check-specs.py` and `openspec validate --all --strict` for specification changes. Run the ledger checker separately. Quote verification remains failed until task 22.16 restores the corpus. Once the workspace exists, run the full `bun run check` and the release checks before any product readiness claim.

Continue with group 1's evidence gathering and the first thin implementation path. Do not archive this change while implementation tasks remain open. Do not run paid or credentialed probes without the person's authorization for those calls.
