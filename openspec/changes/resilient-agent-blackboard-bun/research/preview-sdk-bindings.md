# First preview SDK bindings

Observed on 2026-11-07. These are implementation references, not passing live evidence.

| Component        | Pin     | Binding observed in installed declarations                                            |
| ---------------- | ------- | ------------------------------------------------------------------------------------- |
| Bun              | 1.3.10  | Workspace installation, strict checking and bundle generation ran.                    |
| Codex SDK        | 0.167.0 | startThread, resumeThread, runStreamed, outputSchema and AbortSignal.                 |
| Claude Agent SDK | 0.3.319 | query, explicit resume, outputFormat, maxTurns, mandatory PreToolUse hooks and close. |
| MCP SDK          | 1.32.2  | McpServer, stdio transport and registerTool.                                          |
| zod              | 4.6.7   | Strict objects, input JSON Schema generation and fromJSONSchema validation.           |
| Biome            | 2.6.6   | Recommended rule preset, project domain and noFloatingPromises.                       |
| TypeScript       | 5.9.3   | Strict no-emit checking with index and optional-property checks.                      |

Primary references:

- Codex SDK: https://github.com/openai/codex/tree/main/sdk/typescript
- Claude SDK: https://platform.claude.com/docs/en/agent-sdk/typescript
- Claude sessions: https://platform.claude.com/docs/en/agent-sdk/sessions
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- zod JSON Schema: https://zod.dev/json-schema

The actual installed type declarations were read before implementing adapter options. Codex sets a read-only or workspace-write sandbox, no approval bypass, disabled web search and disabled workspace network access. Its role is currently a prompt prefix. The developer-instructions and precise tool-binding probes remain pending. Codex emits per-turn token usage, with no price in this stream. Cost remains unknown rather than zero. Claude result usage can be cumulative across resumed sessions. The preview records raw result events and separate phase usage observations. It does not claim that summing these observations gives a correct run total.

Claude receives an explicit tool list and no project or user settings sources. A required PreToolUse hook checks paths even when ordinary permissions would allow a tool without asking canUseTool. It denies shell commands, external paths and symlink escapes. Its failure mode is block. These controls pass isolated contract fixtures. Live adversarial checks remain pending. An adapter decoder contract is not proof that the real vendor program enforces permissions.

Both bindings preserve an exact native session ID. Neither supplies a transactional filesystem checkpoint tied to that session in the used API. The engine saves completed worker candidates and validates their hashes. Exact interrupted session and filesystem agreement remains a readiness gate. Missing recorded sessions block continuation. There is no silent latest-session selection or reconstruction fallback.

Biome cannot resolve two MCP wildcard exports because their types pattern appends `.d.ts` after `.js`. Bun resolves those exports and TypeScript passes. Two import-line suppressions document this narrow resolver mismatch. No project rule was disabled globally.

The host denied both namespace probes:

```text
unshare --user --map-root-user --net true
unshare: write failed /proc/self/uid_map: Operation not permitted

unshare --net true
unshare: unshare failed: Operation not permitted

bwrap --unshare-user --unshare-net --ro-bind / / --dev /dev --proc /proc true
bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted
```

The initial default command failed at the same Bubblewrap boundary. Rootless Podman 4.9.3 with crun 1.14.1 resolves that host limitation. The default command now runs in Podman with `--network=none`, a read-only root and source tree, dropped capabilities and no host authentication mounts. The pinned Bun base digest is recorded in `testing/container/Containerfile`; the test image tag is derived from that file. Preparation is separate from tests. Test execution uses `--pull=never` and refuses a missing image.

Observed on this host: 36 tests passed, 195 assertions, 96.27 percent function coverage and 97.16 percent line coverage. An unmodified Bun child and a real Git hook could reach loopback but could not open an external connection. Primary boundary reference: https://docs.podman.io/en/latest/markdown/podman-run.1.html A fresh archive installation now passes the four-step mixed-plan engine probe with the fake backend. The reproducible command is `bun run check:package`. It mounts the fresh installation only, with no checkout or host authentication. No live vendor result is reported as passed. Do not set a fake boundary variable or remove the guard to work around a boundary failure.
