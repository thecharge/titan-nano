# Approved script scope counterexample

## Source and execution

Product source matches pushed commit d66fef89b6565093a44a8ff1d70c09582720fe36. A local probe started the normal production server with a deterministic fake checker. It submitted a script worker with one declared file, then answered the real command request with human authority. No provider, credentials or network calls were used.

The worker command was `printf UNLISTED > ../outside.txt; printf allowed > allowed.txt`. Its declared files contained only `allowed.txt`. Both the project and its outside sibling were disposable files under /tmp. The outside file initially contained `Original`.

The submitted workflow was

```json
{
  "name": "script-scope",
  "goal": "Probe declared file containment",
  "personas": {
    "checker": { "description": "Checker", "role": "Check" }
  },
  "steps": [
    {
      "id": "write",
      "files": ["allowed.txt"],
      "do": {
        "script": "printf UNLISTED > ../outside.txt; printf allowed > allowed.txt"
      },
      "falsify": [{ "persona": "checker", "task": "check" }],
      "max_attempts": 1
    }
  ]
}
```

The fake checker returned a survived verdict with evidence `checked`. Configuration explicitly selected the shared live workspace. The probe waited for the command request before approving it.

## Observed failure

Command `bun /tmp/titan-approved-script-scope-probe.ts` exited two because the outside file changed. Titan reported the run passed. The saved result is /tmp/titan-approved-script-scope-result.json. Its relevant fields were

```json
{
  "run_id": "01762703-fd60-478c-8966-bc5c56e9a98b",
  "state": "passed",
  "allowed": "allowed",
  "outside": "UNLISTED",
  "declared_files": ["allowed.txt"]
}
```

The [production script service](../../../../../packages/server/src/scripts.ts) validates the execution binding and approved command before dispatch. At that revision, command capture launched the ordinary shell directly. An execution-bound approval therefore does not establish enforcement of the file claim.

## Required closure at the failing revision

Repair task 2.3 and its unlisted-write scenario remained open. The native-agent repair is pushed, with separate pinned SDK and installed acceptance evidence. Scripts still need an enforced boundary that supports declared creation and replacement on the shared live tree. Installation, protected paths, cancellation, restart and independent peer acceptance must pass before this repair is archived.

## Repair verification on 2026-11-16

The same production-server probe now exits zero. Its declared file is created on the live tree and its outside sibling retains Original. The run retains the sandbox refusal in the worker error stream. The deterministic checker still allows the script's declared result.

```json
{
  "run_id": "083f6ef1-c827-431a-b88c-372903ed0eb9",
  "state": "passed",
  "allowed": "allowed",
  "outside": "Original",
  "declared_files": ["allowed.txt"]
}
```

The production script service now wraps the approved shell through scriptSandbox. Linux uses checksum-pinned Syd 3.59.0 with a sealed syscall policy. It operates on the shared project. Declared missing files remain absent until the command creates them. Missing parent directories receive mkdir-only grants. Private temporary files support atomic replacement.

Regression cases exercise declared updates, creation, missing parents, temporary replacement, literal filename characters, shell descendants and Bun programs. Negative cases preserve outside content and mode. They cover undeclared writes, creation, deletion, rename, hard links, symbolic links, protected metadata and environment files. Cancellation and timeout cases verify that delayed descendants cannot write after release.

The focused script selection passed 73 cases before adding four lifecycle cases. The final boundary and lifecycle selection passed 35 cases. The independent native reconciliation selection passed 20 cases. Logs are /tmp/titan-script-focused-final.log, /tmp/titan-script-lifecycle-final.log and /tmp/titan-script-reconciliation-final.log. These focused commands use TITAN_TEST_FAST=1. Their printed whole-product coverage gaps are expected and do not establish complete coverage.

The first installed suite found a recovery fixture writing protected metadata and creating its own unsafe symbolic link. The fixture now injects that capture fault from the host after the worker reaches an explicit barrier. Its original no-replay, external-edit, usage and reconciliation assertions remain. A later installed attempt failed managed-update validation. Its retained log is /tmp/titan-script-installed-update-failure.log. A passing source suite does not close an installed failure.

Linux requires kernel 5.19 or newer and libseccomp 2.5 or newer. The package includes the separate GPL-3.0-only helper, license and complete locked source cache. Source builds need a C compiler. Private Rust installation is implemented and remains unverified on a host lacking Cargo. The observed cold build used installed Cargo and took 49.94 seconds.

The policy preserves approved environment variables, ordinary filenames and JIT execution. It permits anonymous pipe, event, timer and signal descriptors. These compatibility settings retain filesystem syscall mediation. Initial failures exposed those requirements before the final focused success.

macOS policy generation has offline coverage. Native macOS execution remains unverified. Nonparticipating host actors retain the separately documented host permissions limitation. No provider calls were made.

Primary implementation references are the [pinned Syd crate](https://docs.rs/crate/syd/3.59.0) and [upstream source](https://gitlab.exherbo.org/sydbox/sydbox). Private toolchain installation follows [Rustup's documented environment settings](https://rust-lang.github.io/rustup/environment-variables.html).

Installed-package acceptance subsequently exited zero in session 42391. It reports four installed script-scope cases and all 52 installed host lease-boundary cases. Repair task 2.3 is complete and the change is archived. The final staged gate and publication remain mandatory.

A final private-scratch probe reproduced a build-tool symbolic-link refusal. The repaired policy permits temporary symbolic links, while outside symbolic and hard-link write attempts remain denied. Temporary Git initialization also passes. The resulting boundary and lifecycle selection exited zero with 39 passes in /tmp/titan-script-scratch-final.log. The earlier running source gate was stopped before editing. Its partial result does not establish acceptance.

Final review reproduced a read-only proof changing its claimed project file. The service now grants no project writes for a read claim. Read-only proofs retain file reads and private scratch. Four production-server cases cover reading, scratch output, claimed-file mutation and undeclared creation. Both deterministic proof executions receive exact-command human approval.

Command env TITAN_TEST_FAST=1 bun run test testing/e2e/script-sandbox.test.ts exited zero with eight passes and zero failures. Log /tmp/titan-script-read-claim-focused-final.log retains the result. The initial regression incorrectly approved only the first deterministic execution. Its corrected fixture approves both executions and inspects retained proof evidence. The actual counterexample now preserves the original project bytes and fails its proof.

The preceding full gate was stopped before this correction. Its partial output remains in /tmp/titan-script-repair-read-claim-stopped-gate.log. The scratch-corrected installed suite exited zero in session 72680. It preceded this read-claim correction. Complete source and installed verification must pass the final frozen snapshot before publication. The commit message retains their final observed results.

The first complete final snapshot ran 7,086 tests across 360 files. It observed 7,085 passes, one skipped live gate and zero test failures in 845.03 seconds. The coverage gate then refused one unexecuted script-service function among 491 product sources. Log /tmp/titan-script-repair-complete-gate-final-2.log retains this failure. The script lifecycle fixture now supplies an excluded runtime path through the Engine service and asserts its persisted relative path. This exercises runtime exclusion conversion in the production script service. Product behavior and coverage requirements are preserved.

The final installed-package command exited zero in session 27626. Log /tmp/titan-script-repair-package-final-2.log reports four installed_script_scope_cases, four installed_script_read_claim_cases and 52 installed_host_lease_boundary_cases. All other installed assertions also completed. The subsequent coverage-fixture correction changes test support only. The complete staged gate must pass again before commit and push.
