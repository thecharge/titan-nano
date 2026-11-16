# Pinned adapter contract review

Reviewed on 2026-11-13 during shared live review verification. This is source and documentation evidence. It does not prove live vendor behavior, account policy, complete filesystem protection or model compliance. Task 5.3 remains open.

## Primary sources and identity

The repository pins Codex SDK 0.167.0 and Claude Agent SDK 0.3.319. Installed package declarations and implementation are the version-specific authority. Current primary web documentation can explain the API, but may describe a different release.

| Installed primary file  | SHA-256                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| Codex `dist/index.d.ts` | `223dc3a3460d43e2228e0c8f49cceb6b2b4903a84eb96ed49a53966ba814b78e` |
| Codex `dist/index.js`   | `318570d84550928754bc1333f14ffd78a84e1de276898628a93a38ce1bf59a72` |
| Claude `sdk.d.ts`       | `89b188a33abd97ed31fdaaee8e78b3b73855b0d8cec9d349d21141cae4941182` |

These files are under `packages/backend-codex/node_modules/@openai/codex-sdk` and `packages/backend-claude/node_modules/@anthropic-ai/claude-agent-sdk`. Codex includes the repository's declared launch-option patch. Preserve that distinction when comparing an upstream package.

## Codex contract

The pinned declarations expose `startThread`, `resumeThread`, `runStreamed`, streamed events, structured output and cancellation. Titan passes the saved session identifier to resume and retains its learned identity. Its default thread options select the invocation directory, disable command network access and web search, and select workspace-write or read-only mode. Client options disable inherited user configuration and bind the persona role. The [official SDK guide](https://learn.chatgpt.com/docs/codex-sdk) documents thread continuation. Versioned source and installed-process tests exercise argument mapping, malformed streams, identity substitution, cancellation and restart. Stub acceptance cannot establish real conversation restoration or model behavior.

## Claude contract

The pinned declarations expose `query`, resume identifiers, persistent sessions, output schemas, strict MCP configuration, setting sources, hooks and tool permission callbacks. Titan supplies the invocation directory, role, tools and model; retains the saved session identifier; closes the active query; and uses both a pre-tool hook and a callback. The [official TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript) describes an empty settings-source list and strict MCP server selection. Titan supplies those options explicitly. Pinned transport stubs require their native arguments; live installation behavior remains unverified.

The [official permission guide](https://code.claude.com/docs/en/agent-sdk/permissions) explains that earlier permission decisions can bypass a callback and that script file access needs an operating-system boundary for enforcement. Titan therefore retains its pre-tool hook. Its current shell-text guard and direct file-path checks are not proof that arbitrary shell programs or broad recursive searches cannot reach other files. Declared step-file restrictions and person-token protection still need acceptance evidence. This limitation is independent of whether execution uses the shared live tree.

## Remaining proof

Keep immutable checkpoints and exact execution-origin auditing while using the live project as cwd. Verify changed checker dependencies and file-scope expansion through the blackboard before claiming complete shared-fabric recovery. Backend retries must retain the authorized selection; an explicit caller-authorized switch is a separate operation. Paid live calls, real session restoration, persona tool-server registration and complete protected-path enforcement remain open. No paid vendor call was made for this review.
