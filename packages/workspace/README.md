# @titan/workspace

## Responsibilities

Owns filesystem snapshots, manifest hashes, verified streamed copies and candidate workspaces. Original projects remain separate from candidate and artifact directories.

## Public contract

`readTree`, `treeHash`, `writeTree` and `createWorkspace` operate on file manifests. Snapshot reads and copies accept central workspace limits; `assertManifestBounds` validates a combined manifest. Directory iteration is streamed, retained manifests have an entry ceiling, and file chunks share a byte ceiling. Depth is checked before descent. Copies reject invalid budgets and oversized manifests before creating their targets. `assertRelative` and `safeDestination` reject unsafe artifact paths. Git subprocess output is bounded and drained. Copies verify byte counts, digests and executable intent before replacement. `fileIdentity` binds content and executable intent for change detection. New copies use private mode 700 or 600 and never restore special bits. Non-executable tree hashes retain their previous format.

`readTree` and `writeTree` also accept an optional `SecretScannerFactory` after their limits argument. Use it for a credential minted only for the current execution. Each content scan gets a fresh scanner so its tail spans chunks of that file without crossing into another file. Scoped scanners also check relative file and directory paths. They add to the existing environment-secret content checks. A refused copy removes its temporary file before returning. This is a capture primitive; the runner still needs to supply and retain its current execution guard through checkpointing.

`readTree` accepts selected relative paths after its runtime omissions argument. A selected directory includes its descendants. A selected file includes that file, and a missing selection produces no manifest entry. The current-directory selector includes the complete tree. Every selector is validated before traversal. Traversal visits selected ancestors and descendants, applying entry, byte and depth limits to that evidence. Both content passes and membership/version comparisons remain active. Runtime omissions and protected path exclusions apply within the selection. This supports managed reads without reading unrelated content. Candidate capture continues to use its existing complete-view contract.

## Verification

Run the offline workspace and files integration suites. They cover empty and binary files, stream boundaries, missing or changed sources, traversal, Git metadata exclusion and persisted hash compatibility, executable copies, runnable scripts, mode-only changes and permission conflicts. The workspace-budget suite covers exact entry, byte and depth boundaries, configuration layering, candidate overflow and parallel assembly overflow without quality refutations.

The scoped-secret suite covers both capture and verified copies, credentials split across chunks, independent file scanners and credentials hidden in relative paths. Dedicated child processes check that supplying an additional guard cannot disable environment-secret content checks.

## Limits

Symbolic links and special files are rejected. Root and ancestor race hardening, injected short-write cases and broader filesystem compatibility remain open. These helpers are not an operating-system sandbox.

`readWorkspaceFile` reads a bounded regular file through validated relative paths and ordinary directory parents. Linked parents and final links are refused. Executable text remains readable. `readRetainedFile` also verifies the expected content hash before returning bytes. These checks preserve the existing host path-race limitation.

The managed file writer validates relative paths and ordinary parent directories, refuses symbolic links and multiply linked targets, and checks the observed stat version before changing existing bytes. New files use exclusive creation. UTF-8 content is size-bounded and scanned before mutation. Existing writes retain the live inode, then truncate and synchronize it. An I/O failure can leave a partial change for execution recovery to reconcile.
