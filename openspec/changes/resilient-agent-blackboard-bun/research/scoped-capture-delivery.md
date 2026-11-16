# Scoped shared-file capture delivery

## Objective

Use installed Titan with the real Codex SDK to implement and review bounded live snapshot operations in the shared repository. The original workflow has two parallel implementation tasks, independent reviewers, integration and script verification. Its retained results required controller completion.

## Delivered scope

Live restore-point preparation, rollback comparison and rollback approval hashes now traverse the negotiated write paths. Selected capture retains regular-file ancestors so that a file replacing a parent directory becomes a reconciliation conflict. Approved rollback preserves that replacement. Denied rollback preserves the current files and blocks continuation.

Expanded write baselines already used selected capture. Full candidate and received-result checks still validate the complete readable view because arbitrary shell and native reads remain unobserved. Whole-project claims retain whole-project capture. Execution claims and selected reads enforce the same path-count bound.

The Codex adapter now sets the pinned native CLI's per-tool `approve` mode for exactly the execution role's enabled Titan tools. The native filesystem policy and host checks enforce role authority, declared paths and observed versions. The vendor fixture checks the exact per-tool settings and absence of a server-wide override. The setting's semantics were checked against the [pinned Codex source](https://github.com/openai/codex/blob/rust-v0.167.0/codex-rs/core/src/mcp_tool_call.rs).

The pinned script sandbox now preserves the operating system error from symbolic-link lookup. Returning `ENOENT` for regular files broke Node native real-path lookup and TypeScript dependency resolution. Two regression cases require the invalid-argument error for a regular file and a directory. The file-write policy remains enforced by the same boundary tests.

## Execution and recovery

The inspectable [run summary](scoped-capture-runs.json) retains the failed attempts, completed worker answers, reviewer findings and journal fingerprints. The [original workflow](scoped-capture-workflow.yaml) and [script verification workflow](scoped-capture-verification.yaml) are included.

- Run `dd1ab67b-f40a-42d3-a7f9-87b04f8f889a` used real Codex sessions. Mutating MCP calls required an approval that conflicted with the native `never` policy. The controller cancelled it and repaired the adapter.
- Run `f5c99573-f9c1-4810-94a0-1fc76aad63eb` used the repaired installed controller. Both workers started concurrently in this repository. The acceptance reviewer refuted two attempts. The source reviewer identified the replaced-parent defect, and the second source worker repaired it. Its final reviewer exceeded the one-MiB host-message budget. Resuming repeated that failure. The controller cancelled the run with its evidence intact.
- The controller restored the second acceptance candidate and added four regression cases covering approved and denied rollback over concurrent file and parent replacements. The controller also removed an unreachable over-capacity capture fallback. No broad parent task was checked off.
- Run `6f1d472c-208d-42dd-8cac-01976239f372` received the owner's explicit approval for the exact two verification commands after automatic approval review rejected the earlier controller attempt. TypeScript failed inside the sandbox because of its incorrect symbolic-link lookup error. The controller cancelled the run with evidence retained.
- Run `b65259ec-34ec-4e3b-a626-9d97163e1d24` retried the exact command using a separate local controller installation with the rebuilt helper. It reached the ordinary ten-second command deadline. The controller cancelled it with evidence retained.
- Run `43fdf53c-bb52-4f4a-9d2c-7a36f758e65e` passed. It uses the supported 120-second deterministic verification timeout for the exact approved TypeScript/Biome command. The worker, both deterministic verifications and the script falsifier exited zero. Each request records the owner's explicit approval. These three script-only runs made no additional vendor calls.

The public summary uses generic workspace paths and deterministic native-session aliases. Original recovery records remain local. The export fingerprints the CLI, agent host and sandbox helper separately because the CLI bundle identity alone does not distinguish helper builds. Raw vendor transcripts, local credentials and full workspace snapshots are excluded from the export.

## Verification

The initial offline selection passed 108 cases across three suites. After the controller's final source adjustment, scoped-capture and read/write-claim suites passed 73 cases across two suites. These use the repository's Podman boundary. TypeScript, changed-file Biome and flat-test checks passed.

The 16 scoped-capture cases check disjoint Titan run admission and peer progress across preparation and rollback, preservation of peer edits, exact and parent/child claims, missing files, replaced-parent approval hashes, dependency changes and sealed-result recovery without repeated commands. An unrelated symlink makes accidental full traversal fail deterministically. The progress assertions do not establish simultaneous kernel I/O.

The staged gate before the sandbox repair passed 7,120 tests with one skip across 362 suites and zero coverage gaps across 492 product sources. Two focused selections after the repair each passed 66 tests and failed one sandbox child startup in different cases. A separate read-only comparison of fifty starts per helper reported zero startup failures before and after the repair. The complete final staged gate and installed archive checks remain delivery requirements. Their observed outcome belongs in the commit and delivery response.

## Remaining work

Tasks 26.3, 26.4, 33.12 and 31.5 remain open under their existing acceptance maps. This bounded repair advances their shared-tree behavior. Complete managed read observation, native transcript recovery and fully unattended self-development still need their mapped acceptance. Large native events currently fail closed at the host budget and can repeat that failure after resume. The intermittent sandbox startup failures observed in focused checks remain recorded for follow-up.
