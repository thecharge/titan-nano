# Parallel verification investigation

The complete delivery must include required checks and finish within five minutes. The current pinned Bun 1.3.10 suite has exceeded that limit. This investigation retains existing assertions, fixture process deadlines and product coverage requirements.

## Native parallel runner

The [Bun parallel-runner documentation](https://bun.sh/docs/test/parallel) describes file workers and coordinator coverage merging. The local Bun 1.3.10 help has no parallel-file option. A temporary installation of the official @oven/bun-linux-x64 package at version 1.4.4 exposes parallel file workers. Its npm integrity is sha512-CHbbkmHVM28T1GFq+6GL4Ao4ujwwYwj1CxFFwEFzLanPfNsId9AhbIP0Q4reWuWBkGimUkoQygrK7Rgjtj3vog==.

The binary was installed under /tmp/titan-bun-1.4.4. It was mounted into the existing offline Podman image for investigation. The system runtime, repository toolchain and test image remain at their existing settings.

A small offline probe defined three functions. Two files independently called the first two functions. The merged report retained FNF 3 and FNH 2, with the third line uncovered. This establishes a useful negative case for the native coordinator. The current manual fast-mode merge cannot establish the same function union from counts alone.

## Complete-suite experiment

On thecharge-ThinkPad-P14s-Gen-5-AMD, Bun 1.4.4 ran all 335 test files inside the existing network-disabled, read-only Podman boundary. It used four file workers and two concurrent cases per file. The existing native process deadlines stayed intact.

The command omitted the normal 60-second default test timeout. Bun therefore used five seconds. Two tests hit that accidental limit. The run observed 5,643 passing tests, one skip and two failures in 221.42 seconds. The failures were the business-plan example and the project-hub contention test. This result is a timing experiment with failures. Log /tmp/titan-bun-parallel-full.log.

The existing product coverage checker found uncovered lines in 32 of 446 product sources under this report, with no missing functions. Several reported lines are defensive failure branches. The difference from the pinned runner needs investigation and regression coverage before adoption. The faster runner has not replaced the complete gate.

The old runner and installed acceptance overlapped part of this experiment. Its duration cannot establish an uncontended cold or warm delivery time. It also excludes commit, push and the rest of the required checks.

## Required follow-through

- Keep the corrected experiment below separate from complete delivery acceptance.
- Investigate every changed coverage finding and cover genuine missing cases.
- Prove complete function union and missing-source refusal through blocking fixtures.
- Pin a compatible image and verify installed-package behavior before changing the normal runner.
- Measure the complete staged verification, installed acceptance, commit and push on the named host.

## Corrected experiment

The second experiment retained --smol and the established 60-second test timeout. It used four file workers and two concurrent cases per file inside the same offline boundary. All 5,655 test assertions passed, with one skipped test and zero failed tests, across 335 files in 175.42 seconds. There were 8,766 expectations. The command exited one. The coverage report still had findings in 32 of 446 sources, with no missing functions, so this command did not pass the complete gate. Log /tmp/titan-bun-parallel-corrected.log.

Guide and pagination edits began while that experiment was running. It therefore used a mutable working tree and cannot establish acceptance of one exact source identity. It also excludes later dashboard, installer and SDK-detection changes. The pinned Bun 1.3.10 gate remains authoritative. Its earlier corrected full run passed 5,645 tests, with one skip and zero failures, in 473.77 seconds and reported 446 product sources with zero coverage gaps.

## Lost output during normal driver shutdown

A subsequent normal source command exited zero, but its retained log ended midway through the last test file. It used process.stdout.write and process.stderr.write for buffered child output followed by process.exit. The driver now awaits Bun output writes and sets process.exitCode for natural shutdown. A separate strict coverage check immediately after that source run reported 451 sources and zero gaps. Its missing test summary is not reconstructed from another run.

Four actual-driver regression cases send two-megabyte payloads on each stream with successful and failing children. Reinstating the old driver reproduced one missing standard-output payload. The fixed driver passed 26 focused cases, including all four new regressions. Logs are /tmp/titan-driver-output-before.log and /tmp/titan-driver-output-retry.log. The current pinned Bun eight-shard development experiment is running separately. Its maximum-per-shard function count remains conservative and is not replaced with summed counts.

## Pinned manual eight-shard result

The Bun 1.3.10 development experiment in /tmp/titan-driver-parallel-source.log exited one. Across eight shards it observed 5823 passes, one skipped test and four failures. The longest shard took 197.73 seconds. The two long-graph positive cases reached their unchanged 15-second deadlines. The eight-client knowledge case reached its unchanged 30-second deadline. One business-plan example reported an unsuccessful child exit. The merged coverage check reported 118 findings across 451 product sources. Its function merge still uses the maximum witnessed per-shard count and cannot reconstruct a union of function identities from count-only reports. No deadline, assertion, coverage rule or normal shard setting was changed. These timings do not establish a successful five-minute delivery.

## Frozen read-claim revision experiment

A new Bun 1.4.4 run used the 1599-file read-claim identity recorded in HANDOFF.md, four file workers and two concurrent cases per file. It observed 5906 passes, one skip and two long-graph failures in 260.71 seconds. Both failures reached the unchanged 15-second deadline. Coverage found line gaps in 34 of 454 product sources, with zero function gaps. Session 45517 exited one. Log /tmp/titan-read-claims-parallel-experiment.log and report /tmp/titan-bun-144-read-claims-coverage/lcov.info remain separate from normal coverage.

The normal Bun 1.3.10 gate on that identity also hit both long-graph deadlines. It observed 5906 passes in 672.04 seconds and zero coverage gaps. These runs overlapped part of their execution, so neither establishes uncontended delivery timing. Installed acceptance passed. A separate two-file native parallel probe covered an explicitly thrown line with two passing tests. Investigate actual missing negative coverage before attributing the 34 findings to instrumentation. No runtime, image, deadline or coverage requirement changed.

## Reproduced false-positive line coverage

A controlled diagnostic now distinguishes one genuine missing branch from a runner measurement difference. It imports Titan's actual knowledge parser through its source module inside the unchanged offline Podman boundary. The only initial test passes one byte with a ten-byte allowance and asserts its malformed document is refused. The parser's oversize condition is false, so its oversize rejection line cannot execute in that test.

The pinned Bun 1.3.10 report nevertheless records DA 15 with count two for that rejection line. Bun 1.4.4 records count zero. A second test supplies two bytes with a one-byte allowance. Running both files with the documented parallel two-worker setting then records count one under Bun 1.4.4. This proves the pinned report can count an unexecuted rejection branch as covered. Earlier zero-gap results retain their observed output, but cannot establish that every product line executed. The other 33 files need their own source and regression review.

Temporary diagnostic source and reports are under /tmp/titan-coverage-audit. Its final log is /tmp/titan-coverage-audit-final.log. Each newer-runner test assertion passed. Its diagnostic child exits one because the selected parser probe deliberately leaves other product functions and lines uncovered. It is not a complete verification pass. The first diagnostic omitted the required boundary metadata and refused before tests. The second used an undocumented worker option. Their retained logs are /tmp/titan-coverage-audit.log and /tmp/titan-coverage-audit-retry.log. The final diagnostic uses the required boundary metadata and --parallel=2. No repository runner, image, source or coverage requirement was changed.

Before adopting the faster runner, add the missing failure cases, repeat complete coverage on one frozen identity and retain installed acceptance. Mandatory line and function coverage remain unchanged. A new complete delivery timing still needs every required check, commit and push.

## Receipt guard counterexample and current regression batch

The later frozen 1,622-file audit completed with 5,963 passes, one skip, zero failed assertions and 9,155 expectations across 339 files in 213.47 seconds. Its command exited one with line findings in 31 product files and no function findings. Log /tmp/titan-current-parallel-audit.log and report /tmp/titan-current-parallel-audit/coverage/lcov.info retain that result. Every recorded input still matched /tmp/titan-current-parallel-source-identity.json after completion. The runner and image pins remain unchanged.

One finding is independently disproved. Bun 1.4.4 reported the board's pending-capture format guard as unexecuted in both parallel and serial runs. Temporarily removing that guard made three actual board tests fail, with 35 passes. Restoring the exact original bytes restored all 38 passes. The mutation log is /tmp/titan-board-receipt-mutation.log. The restored source SHA-256 before the intentional refactor was 1e4155e3839e6d52d133748584f373f5910dd73a79e41668492cf10515e4bc99.

The guard now assigns its existing predicate to incompatibleReceipt before checking it. The predicate and rejection behavior are unchanged. A fresh serial run passed all 38 board assertions and measured three executions of the rejection line. Its selected-subset command still exited one because other product coverage was incomplete. Log /tmp/titan-board-receipt-guard-audit.log. This counterexample prevents treating all 31 findings as genuine missing tests or using either runner's report alone to establish readiness.

New failure cases exercise knowledge input validation and live corruption, Claude hook refusal, board record invariants, configuration filesystem errors, dashboard fallback routes, workspace errors and statement paths. The corrected pinned development focus passed 311 cases. A separate newer seven-file diagnostic passed 413 assertions with 495 expectations in 3.40 seconds, then exited one for selected-subset coverage. Logs are /tmp/titan-coverage-failure-paths-focus-retry.log and /tmp/titan-failure-paths-parallel-audit.log. The initial focus had three fixture-parent failures, corrected before the retry. A later file-claim persistence and capacity focus passed 12 cases in /tmp/titan-file-claim-failure-paths-focus.log. Typecheck and flat-test policy passed after those additions. These changes postdate the complete audit and need combined verification.

The next frozen audit included those cases, serialized read-intent persistence, early project-directory validation and formatter ownership policy. It passed 6,035 assertions with one skip, zero failures and 9,256 expectations across 339 files in 202.51 seconds. Coverage still failed, with line findings in 24 product files and no function findings. Every one of the 1,622 identity entries matched after completion. Identity /tmp/titan-intent-format-source-identity.json has SHA-256 9ff6ce09a6a8e43d6cff53223acde16deb11fd9a3604c3461e6e6e17edeaeb27. Log /tmp/titan-intent-format-parallel-audit.log, report /tmp/titan-intent-format-parallel-audit/coverage/lcov.info and findings /tmp/titan-intent-format-parallel-audit/gaps.json. This remains a failed diagnostic command, with no runner or coverage-threshold change.
