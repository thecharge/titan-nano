## Context

The owner requires Apache-2.0 and reserves license decisions. Titan's current Linux package includes Syd, its GPL-3.0-only license and its source cache. The package preparation script downloads and builds it. Merely changing a notice would leave those components in the archive.

Word list

- A file claim records the paths an agent may change on the shared live filesystem.
- A broker is a supervising process that handles restricted operating-system calls for a child process.
- A containment probe runs a command against disposable files and checks both its result and the resulting file state.
- An installed-package check exercises the archive a user would install.

The research record contains source identities, observed results and remaining gaps. The replacement uses the pinned Sandlock source with the tracked Titan policy patch. The focused integration and production claim cases have passed in the unchanged offline container. Full delivery acceptance remains pending.

## Goals / Non-Goals

The delivery must meet the owner's Apache-2.0 requirement and preserve the script containment contract. The work includes preparation, installation, update behavior, package contents and documentation.

The existing shared filesystem, negotiated claims, approvals and descendant cleanup remain required. Every candidate must support the existing script boundary cases.

## Decisions

### Apply the owner's license requirement

Apache-2.0 is fixed by the owner. Replace the rejected GPL helper and remove its packaged artifacts. The earlier question about retaining a separately installed GPL helper introduced an unnecessary approval dependency. The repair proceeds under the existing replacement authorization.

### Verify the boundary before integration

Use the existing positive and negative script cases as replacement acceptance criteria. Include a truncation attempt using a read-only file open, which exposed a candidate failure during investigation. Observe file contents, permissions and existence after each refused operation.

Plain Landlock, a Linux file-access restriction mechanism, cannot grant creation of one missing filename without broader parent permissions. Bubblewrap requires namespaces that the unchanged offline container refused to create. Sandlock's ordinary mode failed missing-file creation and allowed an outside permission change. Its broker mode supported those cases, but a later probe erased an outside file. The tracked patch adds exact missing-parent creation, future protected-name checks, stable descriptor authorization and mutation-flag handling. The child receives read-only Landlock grants. Its supervisor performs authorized mutations on the shared live tree. A per-supervisor lock serializes its filesystem operations.

### Check delivered components

Inspect the actual archive and the dependency graph used to build its helper. Keep required notices for each redistributed component. Add positive and negative fixtures to the release check so reintroducing Syd fails visibly. Match that inventory to checksum-pinned source and build identities.

## Risks / Trade-offs

- A replacement can pass ordinary writes while allowing another mutation operation. Expand adversarial probes and retain the full existing boundary suite.
- Removing the helper before a working replacement would disable approved scripts. Integrate a verified replacement with its package changes as one repair.
- A source-only check can miss a helper still copied into an archive. Inspect installed-package contents and execute its script cases.
- Updating a license label cannot change third-party terms. Preserve attribution and inspect the actual redistributed graph.

## Migration Plan

Verify a replacement on the shared live filesystem and under the existing offline container restrictions. Replace the preparation and execution paths together. Remove Syd and its source cache from the new archive. Update notices and installation instructions. Run source and installed-package checks, inspect the final diff and complete the normal local delivery gates before pushing. Verify GitHub Actions is disabled before a push.

### Pin and audit the native build

Use Sandlock 0.9.1 at commit ca0c9f1bd6707018b948dbd6b89a478ebf40f8a7. Verify the downloaded archive checksum and include the tracked patch hash and inventory hash in the build cache identity. Build with default features disabled and only profiles enabled. Compare the actual normal and build dependency graph with the checked 67-component inventory, validate its permissive license expressions and include upstream and dependency notices in the package. The prepared source archive includes the applied patch and Cargo.lock.

### Require Linux 6.12 or newer

The replacement uses Sandlock's default Landlock ABI v6 minimum. Refuse unsupported kernels. Linux script execution previously documented a 5.19 minimum. Document the new requirement in both installation and archive guides. macOS continues to use its operating system sandbox.

### Refuse unsupported mutation channels

Refuse descriptor passing through recvmsg and recvmmsg, hard-link creation, unknown device-control operations, legacy timestamp syscalls and newer unsupported attribute syscalls. Support normal path and descriptor mode, ownership, attribute and timestamp updates inside claims. Read-only opens carrying creation or truncation flags require write authorization. The supervising process pins target descriptors and authorizes their resolved paths before mutation.

### Own descendant lifetime

Attach the supervisor to its child with parent-to-child ptrace before releasing execution. Trace fork, clone, vfork and exec events, and apply the kernel EXITKILL option to the complete descendant tree. Killing a process group alone leaves detached children holding writable descriptors alive. Closing the syscall broker cannot revoke descriptors already opened for writing. Kernel tracing ownership kills those children when the supervisor exits. Refuse execution when tracing ownership cannot be established. The unchanged offline container permits this operation.

## Open Questions

- Can the replacement preserve native macOS behavior? Native verification remains required before claiming that platform is verified.
