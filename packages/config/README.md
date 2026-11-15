# @titan/config

## Responsibilities

Owns asynchronous data loading, settings layers, owner-only settings and secret scanning. It resolves defaults, user files, project files, workflow overrides and CLI overrides into one validated result.

## Public contract

`resolveConfig` returns values, source records and a hash. `settingOverrides` admits bounded repeated assignments using the central run-setting registry and leaf schemas. It rejects owner keys, unknown values and duplicate or companion assignments without changing the supplied initial object. Combined cross-field constraints remain part of effective resolution. `loadData` accepts YAML or JSON. `workflowSettings` selects the central workflow settings sections from one parsed document for CLI, HTTP and MCP resolution. `createSecretScanner` accepts buffered chunks and retains enough boundary data to detect a value split between chunks. Explicitly selected missing files fail. Home-only `server.backends` settings select absolute Codex and Claude executable paths and the optional Claude interpreter; lower layers cannot change them. File inputs are streamed into buffers with a 1 MiB ceiling before parsing.

## Verification

Run the offline configuration and secret suites. Cases cover absent optional files, explicit-file failures, owner setting rejection and chunk boundaries. `titan schema config` exposes the input schema, including bounded workspace entry, content-byte and path-depth settings. These defaults and fixed ceilings apply consistently to home, project and workflow layers. Owner-only `server.max_active_agents` and `server.max_pending_agents` separately bound active agent calls and waiting callbacks. Pending defaults to 1024, accepts zero to refuse waiting, and cannot exceed 65536. Project, workflow and CLI settings cannot change the server budgets.

## Limits

Home-owner server.agent_host settings bound managed Bun overhead: gc_markers defaults to one and accepts 1–16, worker_threads defaults to two and accepts 2–16, and startup_timeout_ms defaults to 10000 and accepts 1–60000. Lower layers cannot override them. agentHostEnvironment applies the budgets before managed startup. nativeAgentEnvironment and nativeToolEnvironment validate and retain those thread budgets for native helpers. nativeToolEnvironment also accepts explicit validated host settings. The shared forwarding list includes both runtime variables for Codex. These settings do not establish automatic parallel workflow readiness or replace workflow concurrency limits.

The current secret-value scanner is an additional input guard, not a replacement for repository secret scanning. Remaining environment and limit ownership gaps are tracked in the active OpenSpec change.

Verification tooling also uses this package to construct an isolated user-configuration environment. Each caller supplies a fresh temporary home and owns its cleanup; the helper preserves other inherited settings while replacing the platform configuration-home variables.

Approval policy lives under `approvals` in the central configuration and generated schema. Defaults cover all request kinds. The home owner can lower configurable kinds; project files, explicitly selected files, workflows and CLI overrides can only keep or raise inherited levels. `delete_persona`, `action`, `raise_limit` and `paid_compute` always require `human`. Use `--set approvals.tool=human` on check, config or run to raise that kind through the same registry. Each run captures the effective map and its configuration hash. New requests and replay use that frozen policy, so later home changes do not reinterpret history. Legacy snapshots without the optional map keep the original defaults and unchanged hashes. An `auto` level alone does not create an automatic decision or execute an operation.

Request capacity is configured as requests.max_per_run. It defaults to 256 and accepts integers from 1 to 256. The home owner may lower it; project, selected-file, workflow and CLI layers may keep or lower the inherited allowance. Use --set requests.max_per_run=12 on check, config or run. Every new run freezes the value and its hash. Later file edits do not enlarge that run. All records count, including answered requests. Creation retries still return an existing record at capacity; refusal of a new request preserves the journal cursor. Legacy snapshots without requests retain their shape, hash and original 256 allowance. The ledger also keeps its fixed safety ceiling. The home-owner server.max_pending_request_operations setting separately controls outstanding request mutations.

Home-owner server.max_pending_request_operations controls outstanding request mutations across runs. It defaults to 256 and accepts integers from 1 to 256, using the ledger’s central schema. The count includes active and queued mutations. Server startup validates it before admitting work and passes it to the shared engine ledger. A full queue refuses a new mutation without changing its request or journal cursor. Releasing the active operation admits an explicit retry. Project, selected-file, workflow and CLI overrides cannot change this owner setting. Restart applies a changed home allowance; individual frozen run settings do not replace that process budget. Legacy snapshots without the optional field keep their original shape and hash.

Home-owner server.max_pending_run_operations and server.max_pending_submissions separately bound run operations and submission serialization. Both default to 4096 and accept integers from 1 through 4096. Counts include active and waiting entries. A submission uses one entry from each separate queue, allowing both limits to be one. Saturation refuses admission; explicit retry after release retains the original submission identity. Lower layers cannot override these owner settings. Legacy stored shapes remain unchanged. These queues are in memory and do not establish durable scheduling fairness.

Home-only server.backend_limits accepts codex-sdk, claude-sdk and fake keys with positive safe integers or null. Missing and null entries add no backend ceiling. Global max_active_agents and each run's limits.max_parallel still apply. Unknown backend names, zero and fractional limits fail validation. Project, workflow and CLI layers cannot change these owner budgets. Restart the daemon to apply an owner file edit. The optional map stays absent in legacy snapshots.

The `./native-tools` export provides narrow connection and environment validation for native clients. Home-only `server.native_tools.transport` selects `http` by default or `stdio`. Unknown transports and lower-layer server overrides fail validation. Runtime defaults apply to legacy snapshots without inserting a transport into their frozen data.

The optional home-owner client.max_submission_receipts setting accepts integers from one through 10000. The built-in layer supplies 10000 and records its source. Older frozen configurations without the section retain their original shape. Project, workflow and CLI override layers reject the client section. The receipt owner enforces the count before network submission and retains existing identities when full.

## Scoped file changes

The `./files` export exposes `inspectConfigFile` and `writeConfigFile`. Select user or project scope with explicit home and project paths. Inspection validates the selected document and inherited owner policy, then returns its path and exact byte hash. An absent optional document has a null version. Writes require that version, merge a partial settings object and validate the complete result through the existing layer resolver. Project writes retain owner-only settings, approval floors and request ceilings.

A private SQLite lease beside the selected file serializes cooperating writers across processes. Admission uses ten yielding retries spaced 25 milliseconds apart. Exhausted admission reports config_locked. A changed byte hash reports config_conflict. Closing the connection releases the lease, including after a failed edit. Process exit releases SQLite ownership. The lease database holds no configuration values. File replacement uses the shared durable atomic writer with a private temporary file, file synchronization, rename and parent synchronization. Successful writes store JSON with a final newline in the YAML file. Existing comments and formatting are replaced. Settings values are preserved by the validated merge.

Use `titan config init --scope project --home HOME --project PROJECT --json` to create an empty private document. Existing files cause a conflict. `titan config validate --scope project --home HOME --project PROJECT --json` returns its current path and version. Copy that version into `titan config set limits.max_parallel 2 --scope project --expected-version VERSION --home HOME --project PROJECT --json`. Values accept YAML or JSON. Select user scope for owner settings. Reinspect after a conflict and decide how to combine the edits. The version covers raw bytes, so a formatting-only manual change also makes a saved version stale. Concurrent writers must use this lease protocol.

`titan config schema --json` exports the same input schema as `titan schema config`. Schema export needs no vendor credentials. The existing `titan config [workflow file]` still inspects effective layered settings. Scoped mutation commands return file metadata and omit settings values. Revision history and format upgrades remain tracked in task 29.5.

## Frozen run inspection

`readRunConfiguration` validates the versioned report, exact selected run and saved effective-value hash. `describeRunConfiguration` builds that report from the committed run snapshot. The report retains workflow identity and revision, journal position, saved settings and their source map. Reading it leaves the run unchanged. Configuration-file edits and daemon restart preserve those saved values.

Use `titan config show --run-id RUN_ID --home HOME --sources --json` for the committed report. Omitting `--sources` omits the source map. This command requires an exact run and accepts no setting or backend overrides. HTTP `GET /runs/RUN_ID/config` and MCP `titan_config` expose the same report with sources. Current owner ceilings and configuration revision history remain open requirements under task 29.5.

## Current scoped inspection

The `./files` export provides `describeConfigFile`. Its report contains the selected user or project scope, absolute path, nullable exact byte version and effective configuration with hash and source map. User inspection combines built-in defaults with the selected user file. Project inspection adds the home-owner layer before the selected project file and retains owner policy. An absent selected optional file has a null version and contributes no value sources. Reads create no configuration file, writer lease or daemon.

Use `titan config show --scope user --home HOME --sources --json` or `titan config show --scope project --home HOME --project PROJECT --sources --json`. Omitting `--sources` omits the source map. Combining a run id with scope or project selectors fails before reading files or connecting. Existing exact-run inspection retains its saved report. File versions describe raw selected bytes; effective configuration hashes also reflect inherited settings. These two versions serve different purposes.

## Installed build identity

`runtimeBuild(entry)` hashes the exact runtime bundle within the central package byte limit. Source TypeScript entries return null and retain development discovery. Missing or oversized bundles fail before advertising an identity. Managed daemon discovery compares this hash after version validation.

`matchesClaudeRegistration` reads bounded native Claude configuration without changing it. It resolves the project through its nearest Git marker and requires the exact enabled stdio command and arguments. Environment overrides, malformed configuration and missing entries retain failure.
