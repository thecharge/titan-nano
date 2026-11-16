# @titan/backend-codex

## Responsibilities

Owns the Codex SDK adapter and translation into Titan session, message, usage and result events. No other product package should depend directly on the Codex SDK.

## Public contract

`CodexBackend` implements the agent backend port with start and native resume. The adapter validates usage before accounting and reports operational execution failures. Workspace and output settings are supplied per invocation. Caller and session cancellation are checked before transport invocation, around streamed event handling and before accepting completion.

Each default session constructs its own client with the captured role in config.developer_instructions. New and resumed invocations keep that binding, including literal quotes, backslashes and newlines. The role remains prefixed to the task for compatibility with caller-supplied clients, which own their native configuration. Session creation does not mutate a shared client's persona. Strict SDK executable cases refuse missing or mismatched role arguments and check distinct roles across completion and peer cancellation. This is native argument evidence, not a live claim about model behavior.

## Verification

Run `bun run test` for adapter contracts and the pinned Codex 0.167.0 process transport. Versioned stubs check required arguments and schema, start and resume, fragmented lines, incomplete or malformed output, nonzero exits and cancellation. Cases assert one invocation, correct output and usage, no fallback timeout and observed child exit. Installed offline recovery now covers both graceful and forced daemon restart after a recorded checker interruption; live continuation remains an acceptance gap; live calls are outside the default test suite.

## Limits

Native session continuation, permission behavior and workspace confinement remain experimental until their full transport checks pass. A stub pass is not evidence of live vendor availability.

Parallel transport cases share one backend instance, hold the survivor process active through peer cancellation, and check separate response markers, continuation arguments and process exit. Both workspace orderings are covered. These are SDK process contracts, not installed workflow restart acceptance.

A session retains its learned native identifier across messages. Stateful transport stubs check a second turn on the same handle and continuation through a new handle, plus missing or mismatched saved state. The tests verify synthetic persisted state; vendor conversation restoration still needs live compatibility evidence.

Owner-provided launch options select a local executable. Configured files are checked before start and resume; missing programs cannot silently fall back to another installation.

An observed native identifier cannot replace a learned or resumed identifier. A mismatch raises session_unavailable before its event reaches the durable sink. Real SDK process fixtures exercise early and late replacements on the same and restored handles, then retry the original identity. Engine fixtures require the preserved checker session and candidate, one quality attempt, no refutations and no artifact publication. Codex creates each turn from Titan’s retained identity so a rejected SDK thread cannot redirect its next turn. These fixtures remain synthetic native-state evidence.

The default client explicitly disables apps, plugins, the remote plugin catalog and native lifecycle hooks on every turn. These are separate from sandboxed command networking. Transport tests construct the production client with only a stub executable override and require all four native configuration arguments on start and resume. Injected custom clients own their configuration. The default client also uses --ignore-user-config through a pinned SDK launch-option patch. Synthetic native probes confirm that home and trusted-project MCP registrations do not start while file-based authentication still uses the same Codex home. Titan supplies its own invocation settings; native home and project config.toml preferences are skipped. The preview embeds the patched SDK and declares the exact native CLI dependency from that SDK manifest. Injected clients retain responsibility for their policy. Managed policy, OS credential stores, real transcripts and complete persona tool enforcement still need acceptance evidence.

## Test ownership

Transport registrations live in testing/integration/codex-transport.test.ts. Shared cases and factories live under testing/cases and testing/factories. They import this package's public API. This product manifest carries no test framework or factory dependency; the testing aggregation owns native SDK fixtures.

## Native tool binding

An optional volatile execution binding is separate from the agent specification. It selects the bundled tool command and strict host connection. The adapter requires a configuration-owned environment factory and keeps the credential out of command arguments. Focused native binding and readiness cases live in testing/integration/native-runtime-binding.test.ts, native-runtime-readiness.test.ts and native-binding-contract.test.ts. They use pinned SDKs with versioned vendor stubs and actual local MCP processes. Automatic runner registration, checkpoint guarding, audit and installed native acceptance remain open.

Session admission copies the complete invocation specification. Later caller edits cannot replace the output schema or change the admitted directory, role and runtime policy before dispatch or resume.

## Scoped filesystem permissions

Scoped calls select the pinned native permission profile through raw overrides and omit the later sandbox-mode argument. The profile keeps the root readable and grants writes to a bounded set of existing ordinary files within the claim. Runtime omissions, protected metadata, symlinks and multiply linked files receive no write grant. Exact-file grants include the pinned launcher metadata workaround after file validation. Managed file writes handle creation and editor replacement with a version check and retained inode. Caller-supplied clients retain their own native configuration.
