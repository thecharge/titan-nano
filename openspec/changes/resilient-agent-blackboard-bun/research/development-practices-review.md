# Development practices comparison

Reviewed on 2026-11-06. This extends the end-to-end and concurrency reviews for `resilient-agent-blackboard-bun`.

## Decision

Adopt the sibling's clear ownership, strict types, package graph checks, named test tiers and traceable verification. Keep Titan's smaller native Bun workspace. Separate documentation from end-to-end execution. Use small local gates and complete offline checks in continuous integration, called CI below.

Design decision 38 and task group 27 capture the changes. The revision adds 33 scenarios and ten implementation tasks, retaining all 395 prior scenario identities. All implementation tasks remain open. This review changes specifications, not product code or installed hooks.

## Evidence and scope

Inspected `/workspace/scratch-pad` read-only. Its recorded head was `5119223001cd13298ea8900481edd47ebaea57e7`; its working tree had local edits. Observations describe that working tree, not an immutable release. No sibling test, build, hook or infrastructure command ran.

The sibling has 29 product packages and four apps. Its root manifest also includes testing and tooling workspaces. `AGENTS.md`, `package.json`, `lefthook.yml`, TypeScript configuration, test runners and verification scripts describe the development practice. Its `.github` folder contains ownership and pull-request files but no CI workflow. Its running-checks guide explicitly says verification is local and stack-based.

The existing `.stack/verify/steps.json` holds 40 passing step records. Their summed durations are 576.10 seconds, about 9 minutes 36 seconds. This is saved evidence from one run; it is not a fresh benchmark, hook overhead measurement or percentile.

| Recorded step                  | Seconds | Interpretation                                                                                                         |
| ------------------------------ | ------: | ---------------------------------------------------------------------------------------------------------------------- |
| End-to-end                     |  444.89 | Includes documentation work through the tier runner. The report does not separate browser, site and product test time. |
| Coverage                       |   92.82 | Separate unit and integration coverage run.                                                                            |
| Knowledge-base recording check |   20.49 | Additional recording verification. Its exact overlap with end-to-end work is not measured.                             |
| Remaining 37 steps             |   17.90 | Includes types, formatting, boundaries, security and other repository checks.                                          |

`scratch-pad-verification-reference.json` preserves those numeric records, their source timestamp and hashes of the inspected configuration files. The report supports the user's concern about a roughly ten-minute verification path. It does not prove that every push takes that long.

## What the sibling does well

| Practice                | Evidence in sibling                                                                            | Titan decision                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Explicit ownership      | `AGENTS.md` and package manifests identify product, tooling and testing responsibilities.      | Keep a short ownership map and declared public exports. Add packages when their delivery stage needs them.  |
| Shared configuration    | Root TypeScript and Biome settings give consistent checks.                                     | Keep strict types and one style configuration. Avoid competing formatters for the same file type.           |
| Package graph           | `check-package-graph.ts` detects declared cycles and browser bundle leaks.                     | Check declarations and actual imports. Reject deep imports, vendor leaks, cycles and product-to-test edges. |
| Test tiers              | `test-tiers.ts` distinguishes shared unit groups and isolated integration or end-to-end files. | Use one `test/` tree with bounded isolated workers, temporary homes and allocated ports.                    |
| Observable verification | `verify.ts` records stage outcomes and elapsed time.                                           | Report scope, duration, failures and optional reuse without adding a general task framework.                |
| Rule ownership          | `check-rules.ts` maps rules to their blocking checks.                                          | Keep a small documented gate table and tests of the gate configuration.                                     |
| Failure assertions      | Unit and integration tests cover rejection paths; coverage includes missing source.            | Keep meaningful negative cases, source inventory, scenario ownership and mutation testing.                  |

## What does not transfer directly

The sibling's `pre-push` runs `bun run verify`. Its verification runner executes 40 stages sequentially and continues after failures to collect a full report. Individual stages also pass through its infrastructure runner. This is useful for that product but is too broad for Titan's ordinary push path.

Its end-to-end runner calls documentation production after successful tests. `build-docs.ts` records scenarios, generates several references, builds Astro and performs browser checks. Titan does not need that documentation application or a record-and-publish lifecycle.

The sibling also has product-specific bans on comments, local strings, local types and synchronous functions. It enforces a fixed count of positive and negative cases per function. Titan should preserve reviewable ownership and useful tests without copying these language-wide rules. A four-case quota cannot establish recovery, concurrency or permission correctness.

Its 100 percent line and function coverage target is stronger numerically than Titan's current threshold. Matching the number alone would not establish equivalent assurance. Keep Titan's existing bars, explicitly inventory unimported source and test critical failure paths. Review the bars with measured evidence under task 20.9. Do not describe the two coverage policies as identical.

## Primary documentation checks

Consulted on 2026-11-06. These sources establish tool behavior, not measured speed for Titan. Verify compatibility with the versions pinned during implementation.

- [Bun workspaces](https://bun.com/docs/pm/workspaces) documents native workspace directories and `workspace:*` dependencies. [Package filtering](https://bun.com/docs/pm/filter) selects package patterns. Package selection alone is not proof that every affected downstream consumer was tested.
- [Biome's VCS integration](https://biomejs.dev/configuration/integrate-with-vcs/) distinguishes staged files from revision-based changed files. It warns that an exported type change can affect other files. Titan therefore needs downstream selection and full CI checks.
- [Lefthook run templates](https://lefthook.dev/configuration/run/) exposes staged and pushed file sets. These are useful inputs, not a transitive dependency analysis. Hooks must preserve filenames and inspect all outgoing commits.
- [Bun mocks](https://bun.com/docs/test/mocks) describes controlled replacements for dependencies. Titan uses replacements at vendor boundaries while running its actual adapter mapping and product logic.
- [Bun coverage](https://bun.com/docs/test/code-coverage) documents separate line and function thresholds. It does not make Titan's package source inventory or mutation assertions unnecessary.

## Proposed gate placement

| Gate                                     | Mandatory scope                                                                                                                                             | Excluded work                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| While editing                            | Focused lint, types and selected tests                                                                                                                      | No automatic full suite after every edit.                                        |
| Pre-commit                               | Staged formatting, lint, secrets, affected boundaries, specification or documentation checks                                                                | No rewriting, restaging, installs, site builds or product builds.                |
| Commit message                           | Existing Conventional Commit subject rule                                                                                                                   | No product test rerun.                                                           |
| Pre-push                                 | Complete outgoing range; changed packages and transitive consumers; types, unit and integration tests; guard and CLI/HTTP/MCP smoke set for product changes | No full coverage, mutation run, dependency network audit or documentation build. |
| Every branch push and pull request in CI | Complete offline five-stage check, all default test tiers, scenario coverage, source inventory and documentation checks                                     | No real model calls or paid compute.                                             |
| Dependency changes and scheduled CI      | Separate dependency audit; dependency-change merges require a pass                                                                                          | No dependency audit repeated inside ordinary local hooks.                        |
| Daily and before release                 | Existing targeted mutation checks                                                                                                                           | No mutation run at every push.                                                   |
| Packaging changes and release            | Packed installation, shipped files and supported-platform evidence                                                                                          | No routine package rebuild in unrelated hooks.                                   |
| Explicit live verification               | Adapter contracts and main-agent trials for claimed support                                                                                                 | Never enabled by inherited flags in default tests.                               |

Correctness remains blocking. Local result reuse is optional. A reused success must match all inputs, including fixtures, versions and configuration. CI independently runs the full suite. Unknown scope falls back to full relevant offline checks and reports why.

Initial targets are 5 seconds for pre-commit, 15 seconds for an ordinary affected push and 60 seconds for the complete offline CI run. These are guesses, not promises. Installation is excluded. Measure repeated cold and warm runs on named hardware before accepting them. Shared-contract and guard changes may select all packages; report those cases separately. Missing a target must never suppress a correctness check.

## Falsification pass

Each case below is a proposed executable test. The implementation does not exist, so none is reported as a product test that passed.

| Attempt to break the proposal                                         | Required outcome                                                    | Owner       |
| --------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------- |
| Lint the working file while a staged secret remains.                  | Check the index snapshot and refuse without exposing its contents.  | 27.1        |
| Use unstaged fixes to make the outgoing commit appear valid.          | Verify the outgoing revision rather than unrelated working content. | 27.1, 27.2  |
| Change a shared type without changing its consumer.                   | Reverse dependency selection includes and checks the consumer.      | 27.2        |
| Inspect only the last of several outgoing commits.                    | Include every changed path across the outgoing range.               | 27.2        |
| Delete an edge so the new graph hides a former consumer.              | Use both base and proposed dependency graphs.                       | 27.2        |
| Push a new branch with no known base.                                 | Report a full relevant fallback instead of checking nothing.        | 27.2        |
| Change a vendor fixture after a green result.                         | Reject the old receipt and rerun its checks.                        | 27.3        |
| Cache a timeout as success.                                           | Fail; retain failure evidence; do not refresh success.              | 27.3        |
| Hit the speed target by dropping an integration test.                 | Fail the completeness check regardless of elapsed time.             | 27.4        |
| Import another package's source or a test response from product code. | Fail the dependency boundary check.                                 | 27.6        |
| Replace the entire adapter and call the vendor contract tested.       | Require real adapter request and response mapping against a stub.   | 27.8        |
| Omit a request field but receive a canned success.                    | Stub request matching rejects the malformed request.                | 27.8        |
| Break a stream or cancel the wrong vendor process.                    | Preserve evidence, bound retries and stop only the owned process.   | 27.8        |
| Generate docs after a passing or failing end-to-end test.             | Fail documentation hash and hook configuration assertions.          | 27.9, 27.10 |
| Add a product module that no test imports.                            | Source inventory includes its uncovered lines and functions.        | 27.10       |
| Remove the end-to-end tier from a supposedly complete check.          | A deliberately failing fixture detects the omission.                | 27.10       |

## Remaining work and continuation

Implement task group 27 alongside foundation packages. Build the selector and hook configuration with failing fixtures before relying on affected checks. Keep the full gate independent of local receipts. Exercise real adapters against synthetic response scripts, then run separately authorized live contracts before claiming vendor compatibility.

No Titan product, hook or CI performance was measured. The sibling was not modified. The prior historical-source gap remains separate and unresolved. This review does not authorize paid probes, deployment or changes to the sibling's workflow.

`development-practices-verification.txt` records the specification checks, checker tests, plain-language pass and strict OpenSpec validation. These checks verify the artifacts, not the future hook implementation.
