# Native adapter contract review

Reviewed on 2026-11-13. This is a source and documentation review, not a live vendor test. No vendor requests were made.

## Pinned dependencies

The workspace pins `@openai/codex-sdk` 0.167.0 and `@anthropic-ai/claude-agent-sdk` 0.3.319. The corresponding installed declaration files were inspected alongside each adapter. Current documentation can describe behavior newer than a pinned executable; declaration compatibility alone does not prove runtime enforcement.

## Codex

The [official SDK guide](https://learn.chatgpt.com/docs/codex-sdk) documents starting and resuming threads, streamed execution and configuration precedence. Raw overrides precede structured configuration; SDK thread and managed options apply afterward. The guide describes server-side TypeScript with Node 18 or later. Titan's offline Bun contract acceptance does not establish live vendor support for Bun.

Titan's adapter supplies the working directory, explicit workspace-write or read-only mode, disabled network and web search, and a policy that never approves escalations. It ignores user configuration and resumes only the recorded thread identifier. These options exist in the pinned SDK declarations. The adapter currently grants the workspace as a whole; it does not translate a workflow's declared file scope into an enforced vendor filesystem profile.

The [official permissions guide](https://learn.chatgpt.com/docs/permissions#define-and-select-a-profile) describes shared workspace roots and narrower protected paths within them. Shared storage does not require unrestricted writes to every path. A profile change needs pinned-runtime acceptance, including option precedence and protected-path refusal, before Titan can claim enforcement. Enterprise managed policy is an administrator configuration capability; it is not evidence of different model honesty or instruction following across account plans.

## Claude Code

The [official SDK permissions guide](https://code.claude.com/docs/en/agent-sdk/permissions) describes hooks, permission rules, modes and the tool permission callback. Titan supplies both a PreToolUse hook and canUseTool, uses the default permission mode, blocks hook failures, clears settings sources and selects strict MCP configuration. It persists sessions and explicitly resumes a recorded session identifier. These options exist in the pinned SDK declarations.

Titan's path checks reject project escapes and symlinks for supported file tools. The November 14 repair now also passes the step's declared file scope to both callbacks for Write and Edit checks. Existing write targets must be regular files with one link. Session close, cancellation and caller abort invalidate callback authorization. Its shell text policy is not an operating-system filesystem boundary. The SDK permission callbacks alone do not prove containment of arbitrary shell programs or enforcement against concurrent external processes.

## Remaining proof

Keep repair task 5.3 open. Required evidence includes strict offline assertions of the actual launch options, restart and retry identity, missing authorization before dispatch, protected paths on the pinned runtimes and explicit authorization before any paid live calls. Keep the shared live tree as the default throughout this work. Do not replace missing enforcement with isolated copies or infer an account-plan explanation from this review.
