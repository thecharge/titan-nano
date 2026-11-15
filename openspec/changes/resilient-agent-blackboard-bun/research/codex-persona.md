# Codex persona controls

## Evidence checked

The pinned SDK is `@openai/codex-sdk` 0.167.0. Its installed README and declarations expose client `config`, raw `configOverrides`, environment overrides and thread sandbox, working-directory, model, network and approval settings. They expose no thread-level allowlist matching Titan's Read, Glob, Grep, Write and Edit names. This is source inspection, not a live vendor test.

The [official configuration reference](https://developers.openai.com/codex/config-reference/) was fetched on 2026-11-07. It documents `developer_instructions`, the `features.shell_tool` command-execution switch and separate switches for apps and plugins. It also explains that command-network restrictions do not cover every other capability. The page does not establish a direct mapping from Titan's per-tool list to the pinned SDK.

## Current implementation

Titan binds the captured role to developer_instructions on a default client constructed for each session and also retains the role prefix in the prompt. Starts and native resumes use the session's own client. Injected clients own their configuration. It selects the native read-only or workspace-write sandbox, disables command networking and web search, and disables apps, plugins, remote plugin discovery and hooks. It skips user and trusted-project configuration through the pinned SDK patch. These boundaries have strict executable evidence; they do not establish a complete inherited-capability boundary or an exact per-tool allowlist. See [the role binding evidence](codex-role-binding.md). A native sandbox does not prove Titan's finer persona policy.

## Required acceptance

Do not claim task 1.5 complete. First establish the effective configuration for the pinned program, including inherited hooks, plugins, skills and MCP servers. Check initial and resumed turns. Prove denied commands, paths and capabilities with controlled executable fixtures, then verify native enforcement separately. A prompt instruction is insufficient evidence of enforcement. Disabling command tools also needs a tested replacement for authorized file reads and edits before the adapter can support ordinary code delivery.

No vendor call, user configuration change or Titan skill invocation was performed for this research.
