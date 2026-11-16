# Script sandbox replacement evidence

## Current distribution

The root LICENSE contains Apache License Version 2.0. The current Linux preparation downloads Syd 3.59.0 and packages its executable, SYD_LICENSE and syd-source.tar.gz. Its notice declares GPL-3.0-only. The owner has rejected that bundled helper and reserved license decisions.

The affected implementation is in packages/process/src/script-sandbox.ts, packages/constants/src/script-sandbox.ts and tooling/scripts/prepare-script-sandbox.ts. tooling/scripts/pack.ts copies the prepared helper artifacts into the package.

## Candidate results

Investigation date is 2026-11-16. All file mutations used disposable directories. Candidate builds and probes occurred outside the repository. These probes establish specific observations. They do not establish complete candidate acceptance.

### Sandlock

Reviewed upstream source commit `ca0c9f1bd6707018b948dbd6b89a478ebf40f8a7`. The workspace declares Apache-2.0 and version 0.9.1. Built its command using `cargo build --locked --release -p sandlock-cli --no-default-features --features profiles`. The build exited successfully with compiler warnings. A complete redistribution dependency review remains pending.

Ordinary mode used `run --fs-read / --fs-write CLAIM --cwd PROJECT -- /bin/sh -c COMMAND`.

| Probe                                 | Exit | Observation                                                |
| ------------------------------------- | ---- | ---------------------------------------------------------- |
| Write an existing claimed file        | 0    | Claimed contents changed                                   |
| Change permissions of an outside file | 0    | Outside permissions changed from 0600 to 0777              |
| Create a missing exact claimed file   | 1    | Landlock preparation failed because the file did not exist |

Broker mode added `--chroot /`. This maps the filesystem root directly and uses no copy-on-write work directory.

| Probe                                          | Exit | Observation                                           |
| ---------------------------------------------- | ---- | ----------------------------------------------------- |
| Write an existing claimed file                 | 0    | Claimed contents changed                              |
| Change permissions of an outside file          | 1    | Permission denied and outside permissions stayed 0600 |
| Create a missing exact claimed file            | 0    | Missing file was created                              |
| Create missing parents for an exact file claim | 1    | Parent directory creation was denied                  |
| Write a claimed file from Bun                  | 0    | Claimed contents changed                              |
| Open an outside file with O_RDONLY and O_TRUNC | 0    | Outside contents changed from Original to empty       |

The truncation probe ran a Python child that called `os.open(OUTSIDE, os.O_RDONLY | os.O_TRUNC)` and then closed the descriptor. The write grant covered a different existing file. The final outside contents were empty. The command's successful exit and changed file both confirm the failure.

Source inspection located the broker open permission check in crates/sandlock-core/src/chroot/dispatch.rs. Its `is_write` condition checks O_WRONLY and O_RDWR. This observation is consistent with the truncation probe. A complete fix requires checking every mutation flag and the wider broker boundary.

The broker also uses static denied path prefixes. The existing Titan contract includes future `.env` names, protected ancestors, missing-parent creation and literal environment characters in names. Those cases remain unverified for this candidate.

Sources are the [Sandlock repository](https://github.com/multikernel/sandlock/tree/ca0c9f1bd6707018b948dbd6b89a478ebf40f8a7) and its [broker source](https://github.com/multikernel/sandlock/blob/ca0c9f1bd6707018b948dbd6b89a478ebf40f8a7/crates/sandlock-core/src/chroot/dispatch.rs).

### Bubblewrap

A host probe succeeded. A probe inside Titan's existing offline container, with the host executable mounted read-only, failed with `Creating new namespace failed: Operation not permitted`. The probe retained no network, a read-only root, dropped capabilities and no-new-privileges. Container restrictions were unchanged.

### Landlock

The kernel's path-based grants cover existing objects and directory hierarchies. Granting an absent exact filename requires a different mechanism to avoid granting creation throughout its parent. The replacement must support Titan's existing missing-file cases.

The reference is the [kernel Landlock documentation](https://www.kernel.org/doc/html/latest/userspace-api/landlock.html).

## Initial investigation status

No replacement has passed the complete containment contract. No runtime or license file changed during these probes. No repair commit or push has occurred. The existing main revision still bundles Syd. The active OpenSpec tasks track the remaining implementation and verification.

The earlier approval question about retaining a separately installed GPL helper was unnecessary. The existing authorization directs an Apache-2.0 replacement. The plan now applies that authorization directly. Implementation is pending a replacement that enforces the current file boundary.

## Local verification

Added regression cases for O_RDONLY combined with O_TRUNC or O_CREAT. The shared factory also checks that unlisted and protected environment files remain absent. These cases run against the existing helper and establish the baseline a replacement must preserve.

The first focused run exposed that a rejected open can produce a denial record while the Bun command exits successfully. The new cases now end explicitly after the attempted operation, and the factory independently checks the outside contents, permissions and absence of newly protected files. The successful command exit alone is insufficient evidence of a completed mutation.

The normal focused invocation ran the cases successfully after that correction, then failed the whole-product coverage check because only the focused file was selected. The repository's focused mode, `TITAN_TEST_FAST=1 bun run test testing/integration/script-sandbox.test.ts`, exited successfully with 41 passing tests and zero failures. Its coverage output still listed sources outside the focused selection. Full coverage acceptance remains pending.

Strict validation of replace-gpl-script-sandbox passed. The repository specification check reported zero errors for the new change and the other checked changes. Biome passed for both changed test files. dprint passed for the new change after formatting its evidence tables. The tracked diff passed `git diff --check`. These results do not establish replacement or release acceptance.

## Integrated replacement

The implementation now selects the pinned Apache-2.0 Sandlock source with patches/sandlock-0.9.1.patch. Source download SHA-256 is 33f957415a821cccde1616ce4e13733d6e5edd2634300bad50c67dbc62bc8d1d. The source cache identity includes the upstream identity, architecture, patch hash and component inventory hash. Preparation compares its actual normal and build dependency graph with 67 checked components. Their declared licenses permit Apache-2.0-compatible distribution. The archive includes SANDLOCK_LICENSE, SANDLOCK_NOTICES, sandlock-components.json and its patched source archive.

The child gets read-only Landlock grants. All authorized mutations are performed by the supervisor against the shared live filesystem. Exact missing file claims and missing parent creation use the private JSON policy. Mutating opens authorize stable pinned descriptors. The policy protects future environment files and metadata names. Descriptor mode, ownership, attribute and timestamp operations check the actual target. Unsupported descriptor passing, device-control and legacy mutation channels are refused. The operating system minimum is Linux 6.12. Native macOS execution has not been verified.

The first integrated run passed the existing 41 cases. Additional descriptor regression cases exposed a container compatibility failure in fchmodat2, which the unchanged container profile refuses. The implementation now updates modes through a pinned descriptor path using chmod. The next focused invocation passed 45 sandbox integration and lifecycle cases, eight distribution fixtures and eight production script and read-claim cases, with zero failures. Outside contents, permissions, modification times and change times are independently checked. Focused mode reports coverage gaps outside its selection and does not establish full product coverage.

The package preparation completed and produced a 29-file archive. The blocking distribution check rejects the removed helper, removed source cache, missing components, missing notices, missing executable and GPL-only dependency fixtures. Full installed-package and outgoing delivery gates remain pending.

The subsequent focused run passed 47 sandbox integration and lifecycle cases, including declared descriptor updates, non-overwriting atomic rename and loopback HTTP access, plus eight distribution fixtures and eight production claim cases. A nested-helper rejection fixture was added afterward and remains included in full delivery verification.

The installed-package verification command exited successfully. It reported four installed script-scope cases, four installed read-claim cases, four managed-update cases and 52 host-lease boundary cases, alongside the existing installed-package suite. No paid provider calls were used. GitHub repository Actions permissions reported enabled=false before staging. The local source tree is ready for the required staged gate. Task 3.3 remains open until the final checks and push succeed.

The first staged gate was deliberately stopped after archive inspection found build-machine paths in the compiled helper. Preparation now remaps both the dependency cache and builder home paths, uses encoded compiler flags for paths containing spaces, and normalizes source archive owner, group, ordering and timestamps. A fresh staged gate is required for this correction.

## Descendant lifetime correction

An additional host probe found a detached child writing through a previously opened descriptor after timeout. The outside policy was intact, but the child could mutate its claimed file after its execution lease ended. Earlier delayed-open cases missed this because terminating the broker prevents new opens without revoking existing descriptors. The second staged gate was stopped when this failure was found.

The native patch now establishes parent-to-child ptrace ownership before releasing execution. Kernel EXITKILL ownership follows fork, clone and vfork descendants, including children that create their own process groups or sessions. The supervisor forwards normal child signals and fails closed if ownership cannot start. The host probe now preserves the original file after timeout.

The focused offline run exited successfully with 49 sandbox integration and lifetime cases, nine distribution fixtures and eight production script and read-claim cases. Both timeout and cancellation cases include detached descendants holding writable descriptors. These cases passed under the unchanged container restrictions. Native macOS execution remains unverified.

A concurrent installed-package run failed a stale-project configuration assertion, reporting one version conflict instead of two while preserving the file. Its cause remains unverified. A focused configuration rerun passed all 57 cases, including stale concurrent process writers. The installed-package suite is being rerun separately from the full source gate.

The separate final installed-package invocation exited successfully. It passed all four configuration race cases, four managed-update cases, 52 host-lease boundary cases, four installed script-scope cases and four installed read-claim cases alongside the existing suite. No paid provider calls were used. The earlier concurrent failure remains recorded above.

Final archive inspection found 29 files and 359 normalized source entries, no removed Syd artifacts and no builder-home path in the helper. The helper SHA-256 is 3d63d087e788866ebf548e6b5a4561e2ea8ebe959fff78444c47b3e1336e2237. Source entries have numeric owner and group zero, empty owner names and timestamp zero. Full staged verification and push remain pending.
