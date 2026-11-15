# @titan/runtime

## Responsibilities

Owns CLI service composition, managed native processes and shutdown signals. It assembles backend implementations and the local service without placing orchestration in the command parser.

## Public contract

`serveUntilStopped` starts the service, publishes readiness and stops it after the lifecycle port resolves. It resolves owner-only backend launch settings before composing the adapters. `waitForStop` registers termination listeners and removes them after stopping or cancellation.

`HostedBackend` maps SDK sessions onto managed Linux turns. `hostedTurn`, `spawnAgentHost`, `hostTurn`, `serveAgentHost`, `hostFrame`, `nativeHostBackend`, `nativeHostPort` and `startAgentHost` expose the typed process, durable-event and lifecycle ports. Complete host frames are checked against a 1 MiB expanded JSON budget through shared bounded segments before spawning. Invalid JSON data is rejected. The backend validates the complete start request before the runner advances execution or retry counters. Direct transport calls also validate before spawning. An acknowledged turn waits for process-group teardown. Only config assembles the inherited environment. The installed entry is bundled separately as `agent-host.js`.

`claimHostFiles` coordinates native admission for declared live file scopes. Independent paths and overlapping readers can share the same working directory. A short admission lease serializes a bounded catalogue of exact canonical paths, access modes and execution identities. Parent/child conflicts are checked in both directions. Each active entry holds its own exclusive slot lease; dead entries are reclaimed only after that lease can be acquired. Failed acquisition releases partial claims. Canonical project aliases share the same lease root. Scoped turns retain a shared root lease; unscoped turns retain the whole-project exclusive lease. Linked ownership paths, malformed records and unknown lease files are refused. Slot files remain retained and inactive slots are reused, so a surviving owner cannot be split by deleting and recreating its lock file.

## Verification

Managed startup applies home-owner server.agent_host.worker_threads through the configuration package before spawning. It defaults to two and accepts 2–16. Native helper forwarding retains that budget alongside the GC marker setting. Workflow concurrency and owner capacity settings still control admitted work.

Run the CLI lifecycle and integration suites. They verify listener removal, actual service readiness, shutdown and an independent CLI process.

## Limits

The fake backend is present for offline verification. Installed offline tests now execute both pinned SDKs through configured vendor stubs and restart the CLI daemon. Active worker/descendant restart, cancellation, native continuation, bounded messages, delayed acknowledgments and competing leases are covered offline. The same active recovery table runs against the installed archive. Linux process-group control assumes ordinary trusted descendants. Full capability discovery and live native compatibility remain open. No live vendor validation is implied.

Scope claims coordinate participating hosts; they do not enforce tool write boundaries. The runner board orders ordinary waits within one engine. Conflicts with another coordinator or a surviving foreign host currently refuse admission. Dynamic scope expansion, external read tracking and automatic reconciliation remain open. The catalogue and slot namespace are bounded to 4,096 owners. Inactive slots are reused without deleting lease files. Unknown files, including leases from the rejected hierarchical draft, fail closed and need an explicit migration rather than automatic deletion.

Service startup supplies a strict native launch. Source execution resolves the public @titan/server/native-tool-bridge entry; installed execution resolves native-tool-host.js beside the bundle. This separate helper serves the same bridge as the CLI tool-server command. Both use the current Bun executable. The server creates and revokes execution-scoped bindings, and HostedBackend forwards those bindings separately from durable specifications. The native workflow table is reused against the installed archive; building the archive alone does not establish that acceptance.

Managed HTTP turns request readiness over acknowledged IPC. The daemon uses the original scoped connection to check scope and tool inventory before acknowledging SDK startup. The host waits for this acknowledgment through the same bounded protocol used by durable events. Missing bindings, duplicate requests and early output fail the turn. Operational readiness refusals retain retry metadata. Cancellation reaps the host and settles pending readiness. Standalone nativeHostBackend callers keep their HTTP readiness check.
