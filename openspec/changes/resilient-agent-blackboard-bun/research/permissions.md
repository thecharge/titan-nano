# Native agent permissions

## Evidence boundary

Reviewed on 2026-11-14 against Titan's pinned Codex SDK 0.167.0 and Claude Agent SDK 0.3.319. Repository inspection and controlled vendor fixtures establish Titan's configured decisions. Authenticated native permission behavior remains unverified. Owning live task 1.6 remains open. Repair task 5.3 is complete for pinned documentation and offline contracts.

## Claude Code

The current vendor documentation evaluates hooks before permission rules and the fallback callback. A tool-name allow rule can approve a call before `canUseTool` runs. `allowedTools` adds approval rules while other tool definitions remain available. A `PreToolUse` denial can prevent an automatically approved call. These documented interactions justify checking both the hook and callback. Current documentation may describe behavior added after the pinned package. [Official permission evaluation](https://code.claude.com/docs/en/agent-sdk/permissions)

Titan explicitly selects default permission mode, supplies the selected tools, clears native settings sources and requires its MCP configuration. Its pre-tool hook decides each supported call. The fallback callback immediately returns allow or deny from the same policy. This code path supplies no unanswered human prompt. Unknown tools and paths rejected by the workspace policy receive a denial. Inspect `packages/backend-claude/src/index.ts`, `options.ts` and `permissions.ts`.

Write and Edit callbacks now also check the invocation's declared file scope. Exact paths and descendants are admitted only under a write claim. Both callback paths use a session-owned copy on start and resume. Controlled cases cover outside files, similar prefixes, read claims, protected paths and mutation after session creation.

The shell callback checks command text, while Bash wrapping now applies an exact-file sandbox policy. Managed tools support version-checked creation and updates. Hostile external path replacement retains its documented host permissions limitation. The existing policy cases exercise callbacks and hooks with controlled inputs. They leave real executable enforcement, restart and inherited-capability acceptance pending.

## Codex

The pinned TypeScript thread contract exposes approval policy, sandbox mode, working directory, network access and additional directories. It defines four approval policies, including `never`. That contract exposes no Titan-style per-tool permission callback. [Pinned thread options](https://raw.githubusercontent.com/openai/codex/rust-v0.167.0/sdk/typescript/src/threadOptions.ts)

Titan explicitly selects `never`, disables network and web search, and selects read-only or workspace-write sandbox mode from the worker's writable flag. It uses captured developer instructions and its patched native configuration isolation. Inspect `packages/backend-codex/src/options.ts` and the pinned SDK patch. This configuration avoids waiting for an approval through a Titan callback. The contract alone cannot establish the native program's behavior when a sandbox operation is refused.

Exact-file enforcement now uses the pinned native permission profile and managed creation. The initial exact-file probe failed during protected mount setup. Later standalone filesystem probes and installed managed-write cases passed. See [the recorded write-boundary investigation](../../archive/2026-11-16-repair-harness-delivery/research/shared-write-boundary.md). No authenticated model turn was used for these probes.

## Remaining acceptance

Exercise each pinned native program with an allowed operation, a denied operation and no interactive approver. Record observed denial, timeout and cancellation behavior. Repeat after resume. Prove that a denied request cannot invoke another backend or expand its filesystem authority. Retain the original error and physical usage. The pending account-use approval governs live turns. Offline implementation can continue independently.
