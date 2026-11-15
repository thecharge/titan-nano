# Package dependency direction repair

## Objective and base

Continue the full Codex and Claude production goal using OpenSpec apply. Preserve every applicable requirement, normal hooks, stubbed vendor verification, unrelated harness directories and parked work. Do not load or operate the Titan skill or call live vendors before the person requests it.

This increment starts at main 8305e0faa1abb8c625d18c1bc503139fa30a58a1. Its independent [CI 42483402657](https://github.com/thecharge/titan-nano/actions/runs/42483402657) succeeded: 2534 tests, zero failures, 131 files, 411.00 seconds, 192 product sources and no coverage gaps. The mixed graph test totals were 11615.13 and 11700.56 milliseconds; the unchanged internal twelve-second deadline passed with limited margin. The preceding local staged gate passed 2534 tests in 248.53 seconds and took 264.04 seconds overall. The outgoing gate passed 2534 tests in 251.98 seconds and took 266.83 seconds overall. These results establish that increment, not product readiness.

## Reproduced gap and repair

The product graph checked cycles, undeclared imports, private exports and misplaced vendor imports, but an honestly declared runner-to-Claude dependency could pass. Task 2.4 remained open. Its old backend specification also contradicted the later accepted foundation packages and runtime bootstrap design. The updated rule uses that accepted ownership: core depends only on constants, types, errors and messages; adapters use those foundations, core and their registered vendors; runtime composes adapters. Ordinary product libraries and CLI handlers cannot acquire concrete adapters or vendor SDKs. Tests may exercise them through declared test dependencies.

The new package policy reads root and all declared workspaces through the existing bounded manifest reader. It checks runtime and development dependencies separately, canonical workspace patterns, directory-bound identities, missing workspace dependencies and downward test-stack order. The product source graph shares the direction and vendor ownership helpers. Both full and documentation hooks require the new command.

The first actual metadata inventory found four product-to-test development dependencies in the Codex and Claude manifests. Their transport registrations, byte-identical case tables and adapted factories now live in the central testing tree. Both SDK contract suites use public backend APIs. Claude retry-field assertions now exercise a public session and verify stream observation and closure instead of importing a private recovery module. The testing aggregation declares the native Claude SDK it uses. Product adapters no longer declare test framework or factory dependencies. Frozen dependency installation passed.

Test discovery now selects unit, integration and e2e. The former contracts directory moved into integration, as did process-scope cases that start children. The flat-test command rejects undiscovered test files and source-bearing test, fixture, factory, harness and stub directories under products or tooling, including nested directories. Flat syntax and strict byte/file limits remain required. Product contracts such as packages/types/src/testing.ts remain ordinary sources.

## Observed verification

Initial package policy: 25 workspaces, four findings. After moving test ownership: 25 workspaces, zero findings. The initial focused metadata selection found one incorrect test expectation: inventory exhaustion is a TitanError with verification_budget, rather than a plain Error. The expectation now checks its typed code. The later focused guard selection passed 238 cases across seven files in 9.47 seconds, with zero assertion failures. Its command exited one because focused coverage omitted product sources; it is not a full coverage pass. Subsequent additions and final normal gates remain to be verified. All non-test jobs passed after replacing one vague spec sentence rejected by the plain-language checker. The final spec inventory has 345 requirements and 758 scenarios; 791 files passed spelling checks.

The moved native transport selection executed both SDK libraries with stubbed vendors. Its large output was truncated before its summary was retained; do not claim a complete result from that observation. The full final gate must include both moved suites and the retry-field assertions. A later focused run passed 106 cases and failed nine newly tightened post-close assertions: send closes its stream once, but session.close calls the retained SDK closer again. No classification or observation assertion failed. The unsupported across-owner exact-call assertion was removed; the factory still requires one observed retry event and one stream close before send returns. Record a focused follow-up to clear finished active-query references and prove cleanup across cancellation and explicit close. Do not claim exactly-once SDK closure across session shutdown from this increment.

Both case tables were independently compared against main with SHA-256 and byte equality. Codex: aed77a11475389599bb2bc019a971d4303a7e500c7b522568194461bfc28597a. Claude: 52e93bf58369ad66a0294a1f0e8e42b1e7f28c68e4feb9fa5e3966e521cb5c36. Factory and registration import changes are intentional.

Eight deliberate mutations were applied separately, type-checked successfully, tested in the offline boundary and restored byte-for-byte:

| Removed guard                        | Failing assertions |
| ------------------------------------ | -----------------: |
| Adapter composition ownership        |                  7 |
| Adapter dependency direction         |                  4 |
| Development dependency inspection    |                  2 |
| Named owner directory binding        |                  3 |
| Test stack ordering                  |                  4 |
| Test layout finding                  |                 14 |
| Mandatory package policy hook job    |                  1 |
| Canonical workspace scope validation |                  2 |

The driver asserted an actual failing test for every mutation, not merely a nonzero coverage exit. Raw logs remain temporary host evidence under /tmp/titan-direction-mutant-*.log; they are not shipped product artifacts.

The first normal staged gate refused the commit: 2625 tests passed and four graphManifest fixtures failed in 256.65 seconds; the complete gate took 272.21 seconds. All 194 product sources had zero coverage gaps. Those pre-existing fixtures used the external name @fixture/example for packages/example. They now use the canonical @titan/example identity; duplicate-name and missing-contract expectations are preserved. The identity rule was not relaxed. The corrected focused and normal gates remain to be observed.

## Remaining acceptance and next actions

The independent installed archive probe exited zero for cf45052a1bee60fc50bbee1c79d506875bc94548. It built and installed a fresh archive outside the checkout and exercised installed CLI, HTTP and MCP decisions, fake mixed delivery, sixteen SDK recovery cases, four Claude retry cases, six backoff cases, four mixed backoff cases, four mixed SDK delivery cases, four active recovery cases, eight request-turn cases and four parallel request-turn cases. Vendor executables remained stubbed and the checkout was not mounted into the installed offline container. This remains a private alpha preview, not a release claim.

Run final type checking, relevant focused cases and normal staged and outgoing hooks. Review the final diff. Commit and push without bypassing any hook. Only close task 2.4 and new acceptance rows after their mapped checks and normal gate pass. Record independent CI before treating the pushed revision as cleared.

This increment does not establish complete reference parity. Arbitrarily named non-source fixtures and helpers still need ownership checks, as do transitive unit effects, full test-source import graphs, private manifest policy, per-subject case inventory, complete nesting and comment rules, and the full blocking job registry. Wider product requirements remain open. Faster affected verification and reusable receipts are still pending; source hooks still rerun the complete offline suite.

## Accepted local increment

Commit cbcd8aa passed the corrected normal staged hook: 2629 tests, zero failures, 134 files, 253.17 seconds, 194 product sources and zero coverage gaps. The gate took 268.95 seconds; message verification passed in 0.47 seconds. The corrected graph and metadata selection separately passed 51 tests across two files in 2.00 seconds; its focused command still failed omitted global coverage as expected. The moved SDK contracts and public retry-field assertions all passed in the complete gate.

Task 2.4 and the nine new package/test-placement acceptance rows are now implemented. The exact runner-to-Claude dependency is rejected in the actual tree checker and both manifest dependency scopes. Core, adapters, runtime, CLI and test owners retain their stated boundaries. Progress is 11 of 261 tasks, with broader tasks 27.6, 32.1 and 32.3 still open. Outgoing verification, remote main and independent CI are not yet observed for this increment. Do not infer product readiness from these engineering checks.

The next separate worktree prepares public query-lifecycle tests for the retained Claude stream. No tests there have run, and it is not part of this accepted increment. Finish this push before running another local suite or package probe.
