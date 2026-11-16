# Native adapter contract review

Reviewed on 2026-11-16 against the pinned installed SDK declarations, executable fixtures and primary documentation. No model requests were made.

## Pinned dependencies

The workspace pins `@openai/codex-sdk` 0.167.0 and `@anthropic-ai/claude-agent-sdk` 0.3.319. The corresponding installed declaration files were inspected alongside each adapter. Current documentation can describe behavior newer than a pinned executable; declaration compatibility alone does not prove runtime enforcement.

## Codex

The official SDK guide documents starting and resuming threads and streamed execution. In the pinned installed launcher, structured configuration arguments precede raw overrides. Thread arguments follow them. Scoped calls therefore omit the later sandbox-mode argument that would replace their named profile. The guide describes server-side TypeScript with Node 18 or later. Live vendor support for Bun remains unverified. [Official SDK guide](https://learn.chatgpt.com/docs/codex-sdk).

Titan supplies the working directory, disabled network and web search, and a policy that never approves escalations. It ignores user configuration and resumes only the recorded thread identifier. Unscoped calls retain their workspace-write or read-only mode. Scoped calls select a named profile with a readable root and bounded exact existing-file grants. Protected metadata, runtime omissions, symlinks and multiply linked files receive no write grant. The strict executable fixture checks profile selection, absence of the overriding sandbox argument, disabled networking and exact expected grants for the managed-write workflow. [Pinned native configuration schema](https://raw.githubusercontent.com/openai/codex/rust-v0.167.0/codex-rs/core/config.schema.json).

The [official permissions guide](https://learn.chatgpt.com/docs/permissions#define-and-select-a-profile) describes shared workspace roots and narrower protected paths within them. Shared storage does not require unrestricted writes to every path. A profile change needs pinned-runtime acceptance, including option precedence and protected-path refusal, before Titan can claim enforcement. Enterprise managed policy is an administrator configuration capability; it is not evidence of different model honesty or instruction following across account plans.

## Claude Code

The [official SDK permissions guide](https://code.claude.com/docs/en/agent-sdk/permissions) describes hooks, permission rules, modes and the tool permission callback. Titan supplies both a PreToolUse hook and canUseTool, uses the default permission mode, blocks hook failures, clears settings sources and selects strict MCP configuration. It persists sessions and explicitly resumes a recorded session identifier. These options exist in the pinned SDK declarations.

Titan's path checks reject project escapes and symlinks for supported file tools. Both callbacks limit Write and Edit to declared paths and refuse runtime omissions. Existing targets require one hard link. Session close, cancellation and caller abort invalidate callback authorization. Scoped Bash commands are replaced with a per-session sandbox-runtime 0.0.83 launcher. Literal exact-file grants avoid glob expansion. Explicit denials close the runtime's implicit non-device writable paths. Missing prerequisites refuse execution. A separate strict executable fixture exercises the actual pinned SDK control protocol for both callbacks and verifies unchanged wrapped input between them.

The managed titan_file_write tool requires an active worker claim, a Write or Edit grant and an expected file version. It supports declared creation and in-place replacement. Successful writes retain an observation, while refused calls retain audit evidence. Actual-server executable fixtures exercise both pinned SDKs against the shared live tree. Outside-scope and stale writes are refused. Checkers receive no write-tool registration. Exact-file native mounts preserve the host inode and refuse creation, deletion and atomic replacement. Scoped role instructions direct workers to the managed writer for creation and replacement.

## Remaining proof

Focused offline contracts pass for scoped launches, the SDK hook protocol, native start and resume, runtime omissions, managed writes and permission refusals. Host filesystem-only probes of the pinned launchers preserve the shared inode, allow an in-place declared update and refuse outside writes. The complete local gate and installed-package acceptance must pass for the delivered revision.

Paid live provider evidence remains pending separate authorization. Approved workflow scripts still call the existing process service without an operating-system write boundary. Repair task 2.3 therefore remains open. Direct file-tool checks and path admission also retain the documented race with nonparticipating host changes. These limits remain visible through release readiness checks.
