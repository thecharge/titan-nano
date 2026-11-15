# Claude query lifecycle repair

## Objective and base

Continue the full Codex and Claude production goal using OpenSpec apply. This increment starts from 9248337633dda436413db3bc16eab24e0bfa5c76, independently confirmed on remote main. Its outgoing hook passed 2629 tests in 254.04 seconds, with zero failures, 134 files, 194 product sources and zero coverage gaps. The complete gate took 269.04 seconds. The preceding source cbcd8aa passed outgoing verification with the same counts in 249.18 seconds and a 264.40-second gate.

Preserve unrelated root harness directories, both stashes and parked frozen configuration work. Do not load or operate Titan's skill or call live vendors until the person explicitly requests it. This repair remains part of the active delivery goal; broad production acceptance is incomplete.

## Reproduced problem and ownership

The public retry fixture exposed a retained query: send closed its stream, then session.close called the same SDK closer again. The SDK permits repeated cleanup, but the adapter also retained the completed query object. No measured memory leak is claimed.

Send cleanup, cancellation and explicit close now share one local closeStream helper. Successful close clears the active reference. A throwing close reports its original error and keeps the reference available for explicit cleanup. Repeated cleanup does not call a finished query's closer. A second turn uses a fresh query while retaining the learned native session identifier. No public export exists solely for tests.

Four backend specification scenarios and acceptance rows belong to task 22.20. Their mapped offline behavior is implemented. The task remains open because its live cancellation acceptance has not run. Other provider implementations, complete native permissions, persona tool servers, skills and broader release evidence remain delivery requirements.

## Focused and reference verification

Frozen dependency installation passed. Type checking passed before the initial red run, after the repair and before each deliberate mutation. The first red output reproduced duplicate SDK closer calls; its retained summary was truncated. The later retained-query mutation independently reproduced sixteen failing cases.

The initial fourteen-case repaired table passed in 296 milliseconds. Two throwing-close cases and immediate cleanup assertions were then added. All sixteen passed in 289 milliseconds. Factories were subsequently reorganized into named helpers to retain the reference nesting limits. The final selection passed 119 cases across five files in 8.85 seconds, covering lifecycle, both SDK transports, adapter contracts and Codex cancellation. It had zero assertion failures; its overall command exited one because focused coverage left 129 gaps in the 194-source product inventory. It is not a full coverage pass.

The actual scratch-pad checkSource implementation at pinned reference e77dea405084be20de04debf72f56aaaf459eae5 reported zero findings for the new lifecycle factory, case table and test registration. It checked their nesting, object depth, test control flow, comments and hygiene. This does not establish whole-repository structure parity.

All current non-test jobs passed: Biome CI, TypeScript, compiler and lint policies, schema ownership, flat tests and placement, documentation format, spelling, bounded promise and async filesystem rules, unused code, product boundaries, all-workspace package policy, specification, documentation and README checks. Spelling checked 795 files. The specification inventory contains 346 requirements and 762 scenarios. Source boundary and metadata checks reported 21 and 25 workspaces respectively, with zero findings.

## Deliberate regressions

Each mutation type-checked successfully, produced actual failing assertions inside the offline boundary and was restored byte-for-byte. A nonzero focused coverage exit alone could not count as detection.

| Mutation                                  | Passing cases | Failing cases |
| ----------------------------------------- | ------------: | ------------: |
| Retain finished query reference           |             0 |            16 |
| Discard reference before a throwing close |            14 |             2 |
| Omit cancellation close                   |            14 |             2 |
| Omit explicit close                       |            12 |             4 |
| Omit send cleanup                         |             4 |            12 |

Raw logs are temporary host evidence under /tmp/titan-lifecycle-mutant-*.log. They are not shipped artifacts. The source was restored and type checked before the final native selection and installed probe.

## Installed candidate

The independent archive check exited zero for 6c6996adbc5d6120456d66e3005b7da4a7f8c408. It built and installed a fresh archive outside the checkout; the offline installed container had no checkout mounted and no vendor network access. This candidate includes the final shared-tier derivation from the package repair and the lifecycle change.

It exercised installed CLI, HTTP and MCP decisions, fake mixed delivery, sixteen SDK recovery cases, four Claude retry cases, six backoff cases, four mixed backoff cases, four mixed SDK delivery cases, four active recovery cases, eight request-turn cases and four parallel request-turn cases. Query-level throwing-close behavior is established by injected unit cases; the native process fixtures retain their separate transport and child-exit checks. This remains a private alpha preview.

## Independent CI availability

The Verify workflow id 410780590 is active, but the repository Actions permission endpoint reported enabled false. Source cbcd8aa had no check runs or workflow runs. The person was asked asynchronously whether to enable GitHub Actions, because their AGENTS.md instruction requires approval before changing system configuration. Do not change that setting without an affirmative answer. Continue local implementation and do not report independent CI success for these revisions.

GitHub also documents suppression of some repository-token events in its [GITHUB_TOKEN reference](https://docs.github.com/en/actions/concepts/security/github_token). That is context rather than the diagnosed cause here: the observed blocker is the repository's disabled Actions setting. No token source or permission was inferred or exposed.

## Next verification and delivery

Review and commit this source and acceptance evidence together through normal hooks, then push to main and confirm its exact remote revision. Record actual staged and outgoing results in the next durable increment. The four mapped offline scenarios may remain implemented only if their required gate passes. Task 22.20, full engineering parity and production readiness remain open.

Prioritize fast verification without losing checked inputs: exact successful-snapshot receipts or an equivalently proved affected selector. Reusing only a timestamp or declared dependency versions is insufficient. Bind immutable source, actual dependency inputs, toolchain and offline image; reject stale, missing, malformed or mismatched evidence; retain secrets, messages and non-test checks, earlier outgoing revisions and independent full CI. Avoid separate TSV-only acceptance commits that cause an extra full gate under the current conservative selector. Complete structure enforcement and native persona execution, skill and tool-server capabilities still require implementation before self-development readiness can be claimed.
