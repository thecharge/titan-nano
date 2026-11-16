# Shared live write boundary

The user requires the same live project tree. Private execution copies do not satisfy that contract.

[Linux 6.17 filesystem restriction documentation](https://docs.kernel.org/6.17/userspace-api/landlock.html) describes restrictions inherited by child processes. Its rights include writing, truncation and directory operations. Previously opened descriptors retain earlier rights. Restrictions accumulate rather than expanding an existing process's permissions. The documented gaps include permission, ownership, attribute and timestamp changes. These limits prevent treating this policy alone as complete protection for Titan's file contract.

A disposable offline Podman probe on Linux 6.17.0-1033-oem reported ABI 7. It allowed writing a declared existing file, denied opening another file for writing with error 13, and preserved the allowed file's device and inode. Changing the denied file's permissions still succeeded. The parent observed the same live files. No filesystem copy, namespace change or system policy change was used.

Temporary artifacts: `/tmp/titan-shared-policy-probe.c`, `/tmp/titan-shared-policy-probe` and `/tmp/titan-shared-policy-probe.ts`. Compilation enabled all compiler warnings and treated them as errors. Execution used the established offline image with no network and dropped capabilities. The probe exited zero only after observing both the content restriction and metadata counterexample.

This is exploratory evidence, not product implementation. Managed operations still need recorded read observations, negotiated scope expansion and a verified write boundary. Native and script processes need control over inherited descriptors and uncovered operations. A changed scope also needs a process/session transition; granting more access to an already restricted process is not the proposed recovery mechanism. Keep repair task 2.3 open.

## Native host admission mismatch

The original mismatch described below now has a scoped host implementation. The first hierarchical draft was independently disproved: `/tmp/titan-parent-read-probe.mjs` admitted a child writer while a parent reader was active, reporting `parentReaderBlockedDescendantWriter: false`. Existing tests had covered parent writers but missed this reader direction. Passing package acceptance did not override that counterexample.

The replacement in packages/runtime/src/host-files.ts serializes a bounded catalogue of exact canonical scopes and execution identities. Each live owner holds its own exclusive retained slot lease. An exclusive probe must succeed before a prior owner is treated as gone. Database corruption and malformed records fail closed. Slots are reused without deleting ownership files. Scoped calls share the old root lease, while unscoped calls retain exclusive root admission. Whole-project live readers now forward an explicit root read scope. Focused session 90082 passed 94 tests. Cases cover both reader/writer parent/child directions and arrival orders, inactive-slot reuse, corruption refusals and killed-owner recovery. Both pinned SDKs also shared one actual working directory. The corrected catalogue passed complete source and installed gates; exact identities and counts are retained in the repair evidence. Dynamic claims, read tracking, protected writes and reconciliation remain unfinished, so task 2.3 stays open.

The first helper run also exposed active SQLite journal companions being rejected by the retained-file inventory. The current inventory admits only regular numbered slot leases and their exact SQLite companion suffixes, within the bounded slot namespace and scan. Unknown paths, including old hashed draft leases, are refused rather than automatically removed.

Source inspection found another shared execution gap. `packages/runtime/src/host-turn.ts` opens `.titan/agent-writer.db` under the live working directory and holds `BEGIN EXCLUSIVE` until host teardown. It has no file-scope or reader-mode input. `hostLease` in `testing/factories/agent-host.ts` intentionally expects a second host in that directory to fail with `execution_interrupted`; its positive cases use different working directories. Those cases establish crash-owner exclusion, not independent agents sharing one project. The step coordinator cannot override the host lease.

Retain process-group teardown and crash ownership while replacing this whole-directory exclusion with admission bound to the negotiated claim. Required proof includes two real hosted SDK turns in one live tree and independent writes on the same inode namespace. It also needs overlapping reads, ordered writers, parent/child scopes, canonical aliases, cancellation and a surviving peer after controller interruption. A caller-supplied scope is a coordination claim, not an enforced write boundary. Cross-owner admission and stale-owner recovery must be explicit; removing the existing lease would lose an established protection. Keep task 2.3 open.

A separate offline Bun 1.3.10 probe used three connections to a new empty SQLite lease file. Two `BEGIN` transactions reading `sqlite_schema` overlapped. `BEGIN EXCLUSIVE` on the third connection was refused until both readers rolled back; it then succeeded. Output was `overlapping_readers`, `exclusive_writer_refused` and `writer_after_readers`, all true. Command used the established offline Podman image, no network and dropped capabilities. This establishes one lease primitive, not hierarchical scope admission, crash recovery or vendor filesystem enforcement.

## Pinned native filesystem profile probe

The [Codex 0.167.0 configuration schema](https://raw.githubusercontent.com/openai/codex/rust-v0.167.0/codex-rs/core/config.schema.json) includes named permission profiles. Its [CLI source](https://raw.githubusercontent.com/openai/codex/rust-v0.167.0/codex-rs/cli/src/main.rs) includes the standalone sandbox command and profile argument. The locally installed 0.167.0 binary accepted `sandbox --help` in the offline container. No model invocation or credentials were used.

A disposable probe used a temporary project, a root read grant, one exact file write grant and disabled profile networking. It invoked the real standalone sandbox command to run local file operations under the established Podman boundary, with no network, dropped capabilities and no privilege escalation. The probe script was `/tmp/titan-native-profile-probe.mjs`. The native command exited 101 before the file-operation script ran. Diagnostics reported `bwrap: setting up uid map: Operation not permitted` and a panic while inspecting a synthetic mount below the allowed file, with `Not a directory`. Both file contents and the allowed file inode were unchanged. The outer probe exited zero only because it reported that failure as structured output; it did not assert enforcement success.

This result does not establish that the native profile protects writes on this host. It also does not establish a general failure on supported environments or the cause of the mount-target panic. Do not loosen the offline boundary, change host configuration or claim protected-path acceptance from this probe.

The installed Claude 0.3.319 `sdk.d.ts` exposes sandbox filesystem allow/deny lists and fail-if-unavailable behavior. Its comments describe restrictions merging with inline settings. The [official SDK reference](https://code.claude.com/docs/en/agent-sdk/typescript) is supplementary current documentation. Those declarations alone do not prove runtime behavior, including narrowing an existing working directory or protecting metadata operations. Both native enforcement paths remain pending.

## Host probe follow-up

The same disposable probe was adapted to the host binary path and run outside Podman, without changing system configuration. Command: `bun /tmp/titan-native-profile-host-probe.mjs`. The standalone sandbox again exited 101 before the file operations ran. Its diagnostics reported `bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted` and the same synthetic mount target failure below `allowed.txt/.aws`. The outer reporting script exited zero; that does not mean the sandbox passed.

Both original contents and the allowed file inode were unchanged. This rules out describing the earlier failure as only a nested Podman uid-map problem. It does not establish a single cause or protected-write acceptance. No namespace policy, network permission, host setting, credentials or paid model calls were changed or used. The complete protected-write requirement remains open.

A second host probe used a writable directory instead of an exact file, avoiding the earlier synthetic mount target. Its sandbox profile allowed networking, but the child attempted only local file operations. No network request was made. Command: `bun /tmp/titan-native-profile-directory-probe.mjs`. The native child exited one before operations with `bwrap: setting up uid map: Permission denied`. Original contents and the allowed inode remained unchanged. This removes two probe variables without establishing the host policy cause or filesystem enforcement. The normal product and offline boundary were unchanged.

The installed `/usr/bin/bwrap` was also tested directly with `bwrap --ro-bind / / -- /usr/bin/true`. It exited one with the same uid-map permission refusal. No file operation or policy change was requested. Read-only host inspection showed unprivileged user namespaces enabled, the AppArmor unprivileged-user-namespace restriction enabled, and no effective capabilities or system call filter in the inspected process. Those values do not establish the specific denial cause. A safe supported boundary remains a delivery blocker; no host protection was disabled.

## Audit evidence for the host denial

Read-only kernel audit inspection now identifies the host policy involved in these probes. The system journal reader used arguments `-k --since '2026-11-13 14:00:00' --grep 'userns_create|uid_map|apparmor.*DENIED' -n 12 --no-pager`. Matching events show `/usr/bin/bwrap` transitioning from unconfined into unprivileged_userns. That profile then denies its user-ID-map write and a required capability. The earlier loopback probe also has a denied network-administration capability. This supports AppArmor policy as an observed host obstacle; it does not settle every nested-container or native mount issue.

[Ubuntu's AppArmor documentation](https://documentation.ubuntu.com/security/security-features/privilege-restriction/apparmor/) explains profile enforcement and audit denials. Its [user-namespace explanation](https://discourse.ubuntu.com/t/understanding-apparmor-user-namespace-restriction/58007) describes administrator-controlled allowances and the kernel attack surface involved. The host has the restrictive fallback profile but neither named bwrap profile file checked by this review. That does not prove no other installed profile attaches to the binary.

A host-policy change is outside the current authorization. Do not disable namespace restrictions, unload profiles or add an unconfined allowance automatically. Any proposed exception must first check competing attachments, retain rollback, and be reviewed separately. A successful startup afterward would still require the complete allowed/protected-operation matrix. Exact-file mount behavior, nested-container enforcement, read observation and reconciliation remain separate requirements.

## Compatibility review before any host change

The host reports Ubuntu 24.04.5 LTS and AppArmor parser 4.0.1. Its installed policy definitions include ABI 4.0, but not ABI 5.0. The current [upstream purpose-built bwrap profile](https://gitlab.com/apparmor/apparmor/-/raw/master/profiles/apparmor/profiles/extras/bwrap-userns-restrict) declares ABI 5.0. It gives the launcher namespace capabilities and stacks a child policy that denies capabilities. This is different from a broad unconfined allowance, but its presence upstream does not prove compatibility with this host.

Searching readable files under /etc/apparmor.d found no bwrap attachment. Reading the loaded profile set with aa-status was refused for lack of privilege. Therefore competing loaded attachments have not been ruled out. No profile was installed or loaded, and no host setting changed. Do not replace the declared ABI or remove child restrictions just to make parsing succeed. The next host step requires administrator inspection and a supported, compatible profile or a separately provisioned test host. This environment obstacle does not complete or excuse the unfinished runner protocol.

## Current agent execution context

A repeat on November 14 changed the observed host admission result. Direct bubblewrap with a read-only root, fresh user and PID namespaces, proc and device mounts exited zero. The process reported AppArmor context chatgpt (unconfined), with the host user-namespace restriction still enabled. No host policy or system configuration was changed. This result applies to the current execution context. It does not establish the same permission for an ordinary terminal or a nested Podman process.

The pinned Codex directory-profile probe now exited zero. Writing the allowed directory succeeded. An outside write and outside chmod both failed with the read-only filesystem error. The allowed inode was unchanged, and the denied file retained its original contents. The probe invoked the standalone sandbox command and performed local filesystem operations. It used no credentials or model calls.

The exact-file profile still exited 101 before the child operation ran. Codex tried to create protected synthetic mount targets below the file, including .git and .aws, and failed with Not a directory. Both original files and the allowed inode were unchanged. Directory admission evidence does not complete exact-file enforcement.

The next implementation can use the current context to test directory-scoped native enforcement and a separate exact-file mount strategy. Keep normal-terminal and nested-container behavior as explicit acceptance cases. The earlier blanket host-startup blocker no longer describes this context. Dynamic claims, managed read tracking and reconciliation remain unfinished.

## Exact-file live mount probe

The November 14 execution context also passed a direct exact-file bubblewrap probe. A read-only root and one writable file bind used the original shared device and inode. Writing and changing the allowed file's executable mode succeeded. An outside write, chmod, deletion, rename and new hard link each failed with read-only filesystem errors. Both original outside bytes and mode were retained. User, process and network namespaces were fresh. No host policy change, credentials or model call was used. The asserted probe exited zero. Source is /tmp/titan-exact-file-boundary-probe.mjs and its disposable project remains under /tmp/titan-exact-file-boundary-W1J060.

Renaming the mounted allowed file was also refused. This primitive therefore does not support an editor's atomic replacement of that file. It has not been integrated with hosted SDK sessions, managed writes, scope changes or scripts. Directory creation, absent-file admission, protected subdirectories, inherited descriptors and nested-container behavior still require acceptance. The Codex exact-file synthetic-mount failure remains a separate native-profile issue. Keep task 2.3 open while completing that integration.

## Repeat with the pinned native profile

The next disposable probe used the pinned Codex 0.167.0 standalone sandbox command and the documented nested workspace permission syntax. A private temporary configuration home avoided user configuration. The probe attempted only local writes and used no model, credentials or network request. Source is `/tmp/titan-nested-file-profile-probe.mjs`.

The default execution boundary refused the native child before the file operations with the app-server socket directory mode error. The [upstream nested-sandbox report](https://github.com/openai/codex/issues/53799) describes a matching fixed socket-directory masking problem. This similarity supports a candidate explanation for that refusal.

Running the same local probe with the approved tool escalation reached the native filesystem sandbox. Its child exited 101 while constructing synthetic .git and .aws mounts beneath allowed.txt, with Not a directory. The disposable project was `/tmp/titan-nested-file-profile-3aKlGT`. The original allowed file inode and both original file contents were preserved. The outer reporting script exited zero because it printed the native failure as structured evidence. Exact-file enforcement remains unverified and task 2.3 remains open. No host policy was changed.

## November 16 implementation in progress

The exact-file Codex profile passed a disposable host probe after explicitly granting its impossible metadata children beneath each validated ordinary file. The pinned native launcher otherwise tries to mount protected metadata beneath the file. The successful probe allowed an in-place change, refused an outside write and preserved the shared inode. An absent file remained unwritable. These results require a managed creation and replacement path.

A separate filesystem-only probe of Anthropic sandbox-runtime 0.0.83 passed for an existing file. The original inode remained visible to the parent. Outside writes, protected Git metadata and creation outside the writable file mount returned the read-only filesystem error. No model calls or host policy changes were used. Probe artifacts are temporary and contain disposable projects.

The current uncommitted implementation adds a version-checked managed file-write tool, exact existing-file grants for scoped Codex calls and a sandbox-runtime command wrapper for scoped Claude Bash calls. Directory scopes expand to bounded ordinary-file grants. New files use the managed writer. Runtime omissions are forwarded to the adapter scope. Native command creation, removal and atomic replacement remain unavailable through those file mounts. The role instructions direct workers to the managed writer.

This draft has not passed acceptance. Both repair tasks remain open. Next work is managed-write and sandbox regression coverage, strict vendor contract integration, package tool checks and installed acceptance. The unrelated local model probe must remain untouched. Do not archive or claim completion from the disposable probes.

## Pinned SDK and managed-write acceptance

The November 16 focused acceptance now passes through the actual server and both pinned SDK executable fixtures on the shared live project. Declared updates and creation succeed. Unlisted paths, stale versions, read-only personas, shared inode aliases and runtime-owned paths are refused with retained audit results. Dedicated workspace cases cover missing and linked parents, empty content and existing-target creation refusal. The strict Codex fixture checks exact profile grants and absence of an overriding sandbox argument.

The pinned Claude SDK control-protocol fixture passes both hook and permission callbacks, including exact reuse of wrapped input and preservation of the command timeout. Sandbox settings use literal file paths and explicitly deny the runtime's implicit non-device write locations. Count, individual-command bytes and total registry bytes are bounded. Failed scope initialization closes without dispatch. Focused final guard output observed 182 passes and zero failures across four selected files. Log /tmp/titan-native-last-guards.log.

A host probe of the final literal-path policy exited zero. The allowed file changed in place with its original inode. Outside writes, Git metadata and new-file creation returned the read-only filesystem error. Source /tmp/titan-srt-literal-probe.mjs. Disposable project /tmp/titan-srt-exact-ewtOCJ. No model call, credentials or host-policy change was used.

The first complete run observed 7,008 passes, one skip and seven failures in 755.21 seconds, with seven measured coverage findings. Log /tmp/titan-native-boundary-full-test.log. It overlapped draft edits and caught an undocumented catalog dependency, the Codex stub's old sandbox-flag worker detection and four SDK cases configured for legacy isolated execution. Those focused cases were corrected and passed. The complete gate must be repeated against the frozen staged tree. Passing focused selections does not establish complete coverage or installed acceptance.

Repair task 5.3 records the pinned documentation and offline contracts. Paid live provider evidence remains pending separate authorization. Task 2.3 remains open because approved workflow scripts still lack the required operating-system write boundary. Exact existing-file mounts cannot transparently create a missing declared file. Creating files in advance would change script and check semantics. A script boundary must preserve the supported command behavior and shared live tree. This change must remain active until that work passes acceptance.

## Script creation prototype

The downloaded primary source for Syd 3.59.0 documents syscall emulation for path-based access rules, locked policy and inherited descriptor control. Source documentation is https://docs.rs/syd/3.59.0/syd/. A pinned Cargo installation with locked dependencies produced a disposable executable under /tmp/titan-script-tools. All build state and the library alias stayed under /tmp. No system configuration changed.

The first prototype enabled the independent filesystem-type filter without granting the host filesystem type. It refused the shell loader before any writes. Removing that unrelated filter from the prototype left the requested write, creation, directory, ownership, attribute, link and asynchronous-I/O restrictions active. No unsafe-option override was enabled.

Command bun /tmp/titan-script-boundary-probe.mjs then exited zero. The shell first observed its declared missing file as absent, updated its declared existing file and created the missing file. An outside write, chmod and deletion each returned permission denied. Outside bytes remained protected and the existing allowed inode remained unchanged. The disposable project path is retained in the probe output.

The pinned executable also passed a declared missing-file creation command inside the existing offline image. Podman used no network, a read-only root, dropped capabilities and no privilege escalation. The command verified absence before creation and nonempty content afterward, then exited zero. This establishes a candidate primitive for script integration. It does not establish supported installation, path-pattern escaping, atomic replacement, protected directory rules, cancellation or production wiring. Task 2.3 remains open.
