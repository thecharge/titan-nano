# Native tool server

This is the connection contract for the local native tool bridge. Local service startup composes the execution owner, runner and native adapters. Each physical execution receives a volatile role binding. HTTP connects directly to the local owner; stdio starts a dedicated native-tool-host helper serving the tool-server bridge. Embedded startServer callers supply ServerOptions.nativeTools explicitly. The owner commits scoped tool audit metadata before acknowledging a call. Native SDK event bodies are projected separately after raw credential scanning. Live vendor compatibility and complete interrupted-start reconciliation remain open.

`titan tool-server` serves MCP on standard input and output. It accepts no scope arguments and refuses --json. Its host supplies an opaque execution credential and all connection settings through the environment. Configuration parsing belongs to @titan/config; strict schemas belong to @titan/types. Credentials must stay in memory and must not enter command arguments, run journals or diagnostic records.

| Environment variable          | Required value                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| TITAN_NATIVE_TOOLS_URL        | An HTTP URL on 127.0.0.1 with path /native-tools and no credentials, query or fragment |
| TITAN_NATIVE_TOOLS_TOKEN      | The host-issued opaque credential                                                      |
| TITAN_NATIVE_TOOLS_TIMEOUT_MS | A positive whole number of milliseconds, at most 60000                                 |
| TITAN_RUN_DIRECTORY           | The absolute normalized run folder                                                     |
| TITAN_RUN_ID                  | The host-bound run id                                                                  |
| TITAN_AGENT_ROLE              | worker or checker                                                                      |
| TITAN_STEP_ID                 | The host-bound step id                                                                 |
| TITAN_PART_ID                 | The host-bound part id, or an empty value for no part                                  |
| TITAN_CANDIDATE_ID            | The host-bound candidate id                                                            |
| TITAN_ATTEMPT                 | The positive logical attempt number                                                    |
| TITAN_EXECUTION_ID            | The host-bound execution UUID                                                          |

The ids describe the expected binding. The opaque credential authorizes it. The bridge checks the owner's readiness response against every scope field and checks both the reported policy and actual listed tools. A mismatch, an error readiness response or failed transport startup stops the bridge before it accepts agent requests. Startup diagnostics do not include the credential or the owner's private exception text.

Workers receive scoped private knowledge reads, search, add, update and delete. Checkers receive committed reads and search. Both receive titan_native_ready. The bridge refuses calls outside that exact role policy. Revocation and stale-execution checks belong to the owner and still apply to calls through an established bridge.

The stdio transport uses the shared one-MiB input bound. It checks outgoing JSON size, including escaping, UTF-8 bytes and the newline, before SDK serialization. Owner response collection uses the shared sixteen-MiB response ceiling before SDK JSON parsing. The same ceiling applies to each outgoing stdio frame. Owner fetches refuse redirects and apply the configured timeout through body collection, together with caller cancellation. The owner uses bounded, stateless JSON responses; this bridge does not support owner event streams. These limits bound individual messages, not total process memory or calls from other processes running as the same user.

The transport writes each bounded JSON frame with its newline and waits for the writable callback. A write error, closed pipe, transport cancellation or configured connection deadline rejects the send with a generic diagnostic. Closing cancels pending sends, removes transport listeners and notifies closure once. It preserves the caller's output stream. EOF also closes the transport. Closing the bridge closes its owner client. These checks cover individual sends; they do not establish a total budget for concurrent requests or force a caller's blocked output buffer to drain.

Run the focused offline checks with `bun run test testing/integration/native-tool-bridge.test.ts testing/e2e/native-tool-process.test.ts`. They use a local owner and actual stdio processes without vendor calls. Focused coverage does not replace the full hooks. Automatic registration, ephemeral bindings, native startup checks, scoped audit and both transports have separate source and installed stub acceptance. Full release acceptance and live vendor behavior remain open.

The optional backend binding stays separate from AgentSpec and durable launch settings. It must match the run and execution. HostedBackend forwards it through the strict IPC start envelope on starts and resumes. Codex receives a required MCP server with connection readiness and an environment-variable allowlist. Claude holds its asynchronous task input until initialization and an exact connected role inventory succeed. Deadline, cancellation and startup failure close the query without releasing the task. Both adapters require a configuration-owned environment factory. An injected Codex client is refused for bound execution.

Run `bun run test testing/integration/native-runtime-binding.test.ts testing/integration/native-runtime-readiness.test.ts testing/integration/native-binding-contract.test.ts` for focused adapter acceptance. Actual pinned SDKs use versioned vendor stubs and real local tool-server processes. The cases cover worker and checker inventories, search and read, start and resume, direct and isolated hosts, scope substitution, credential arguments, missing environment composition and Claude readiness failures. This adapter evidence does not establish live vendor compatibility; separate workflow cases below cover automatic delivery with stubs.

The runner can receive an optional native execution owner. It opens a lease after the physical start is committed, guards events and complete answers before recording them, and keeps file scanners active through checkpoint capture. Backend and cleanup failures pass through the value guard. Every lease closes before phase completion or publication. Events arriving after closure begins are ignored. Explicit recovery retains the native session and logical attempt while receiving a fresh physical binding. Run `bun run test testing/integration/native-phase-guard.test.ts` for these lifecycle cases; the same native workflow cases are also registered in the installed preview probe. A build alone does not establish installed acceptance.

Home-owner settings control native resource limits:

```yaml
server:
  native_tools:
    transport: http
    max_bindings: 1024
    max_pending_operations: 4096
    timeout_ms: 10000
```

The owner selects `http` (the default) or `stdio`. HTTP uses the same local credentialed endpoint directly from each vendor. Before starting the vendor, runtime checks the full scope and exact role inventory through a bounded local client. The adapters refuse HTTP bindings without that readiness port. Codex receives the credential environment variable name; Claude receives a header environment reference. Neither receives the credential value in arguments. Stdio retains the bundled helper and its startup checks. Frozen settings without a transport retain their original shape and hash. Restart the daemon to apply an owner edit.

These are the defaults. Registrations accept one through 65536, pending operations one through 4096, and the timeout one through 60000 milliseconds. Project, workflow and command overrides cannot change these server limits. The native endpoint accepts only its execution credential; ordinary agent and person credentials do not grant that role. Closing drains admitted native calls and refuses obsolete credentials. Shutdown pauses active execution before stopping the listener and closing authority and knowledge.

Run `bun run test testing/integration/native-execution-owner.test.ts testing/e2e/native-workflow.test.ts` for owner and automatic daemon coverage. The eight workflow cases use actual pinned SDKs with versioned vendor stubs. Both HTTP and stdio run for each backend. Worker and checker search/read must find the seeded entry before delivery. An absent required entry must block without a refutation. Run `bun run check:package` for the clean installed preview, which reuses those eight cases. No live vendor result is implied.

## Audit and vendor events

The owner records every admitted tool call, including readiness and refused calls, before returning its response. Each strict audit contains trusted run, step, attempt, physical execution, role and persona, a declared tool name, outcome and returned or changed entry ids. Queries, arguments, entry bodies, credentials and private exception details are excluded. Unknown tool names use a fixed marker. If the audit write fails, the lease refuses more calls and phase completion, drains admitted work and frees its slot. Ignoring a failed tool response cannot permit checkpoint or private knowledge publication.

The runner scans the original SDK event for scoped credentials before recording its projection. Codex native tool events retain call identity, declared tool name, status and activity. Claude native tool-use messages retain call identity, declared tool name and activity. Claude result messages can lack server identity after recovery, so all tool-result and partial messages in native-enabled executions are projected; unassociated results use the unknown marker. This also omits unrelated result bodies from the board, while preserving the results delivered to the agent. Ordinary text and unrelated assistant tool uses retain their existing behavior. Invalid metadata and excessive tool-block counts block operationally with a safe message.

After type checking, run `bun run test testing/unit/native-events.test.ts testing/integration/native-audit.test.ts testing/integration/native-phase-guard.test.ts testing/e2e/native-workflow.test.ts` for the focused contract. Source and installed workflows inspect event pages and require native audit plus safe projections. These cases use stubbed vendors and do not prove real vendor transcript recovery. A proven runner-owned setup refusal can resume the same logical attempt with its remaining recovery allowance; an uncertain dispatch without a saved session still blocks against duplicate work.
