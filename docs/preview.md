# Use Titan Nano

Titan Nano runs local workflows through Codex and Claude Code. This guide covers the implemented commands and their current limits. The retained [Codex self-development run](../docs/examples/self-development/README.md) used real workers, independent reviewers and scripts. Complete live permission and recovery acceptance remains open. The [delivery record](../openspec/changes/repair-harness-delivery/evidence.md) tracks verification and outstanding product requirements.

The knowledge hub has final-entry commands, operator MCP tools and host-owned private attempt storage. The runner publishes a checked private set before step success and discards refuted attempts. Native workers stage project knowledge through execution-scoped tools. Checkers read committed knowledge. The runner publishes or discards the private proposals with the checked result. Use the local daemon for the public commands below.

Use Bun 1.3.10 on Linux. Node is also needed by the vendor agent programs. Run `bun install --frozen-lockfile` from the repository. Read `bun run titan --help` and `bun run titan doctor`. Commands using `bun run titan` below assume a repository checkout. For an archive installation, use `./node_modules/.bin/titan` instead. The doctor reports programs it finds. It does not verify authentication or native sandbox behavior.

Run commands start the local engine automatically. To keep it in the foreground for development, use the following command.

```sh
bun run titan serve
```

To add a knowledge entry, create fact.md with this content:

```text
---
kind: fact
title: Time zones
tags: [clock]
---
Check time zones first.
```

Run these commands against the same home as the daemon. Replace ENTRY_ID with the returned id and use the version from get when changing or deleting an entry:

```sh
bun run titan kb add fact.md --json
bun run titan kb add fact.md --scope home --json
bun run titan kb promote ENTRY_ID --json
bun run titan kb get ENTRY_ID --json
bun run titan kb update ENTRY_ID fact.md --entry-version 1 --json
bun run titan kb search "time zones" --mode words --limit 50 --json
bun run titan kb search --kind fact --mode words --json
bun run titan kb search --kind persona --all --mode words --json
bun run titan kb reindex --json
bun run titan kb delete ENTRY_ID --entry-version 2 --json
```

Every operation accepts --home HOME. Updates and deletes refuse stale versions with exit code 2. There is no automatic refresh or overwrite. Keep the old version before editing an imported file's header: its optional id and version must match the selected entry and expected version. Persona entries use YAML. Canonical persona deletion requires the approved lifecycle request described below. Ordinary entries use Markdown with a YAML header. History preserves the original bytes under knowledge/.history; current files and INDEX.md live under knowledge in the selected home.

Persona searches hide retired and deleted entries. Add --all to inspect them with their retained state and history. Direct reads by id remain available. Saved registered definitions require a new version when their role or other definition fields change.

Search uses SQLite FTS5 and marks matching words. Each result includes id, kind, title, version, tags, path, matched and score; word scores are null. The response reports the committed revision. Both mode combines word and meaning search when the local model is ready. Missing model files leave word results available with a warning. Explicit meaning mode reports that setup is required. Use `titan doctor --fetch-model` to fetch the verified files, as described in the [installation guide](install.md). Normal meaning search uses those local files offline. Results are capped at 200, with at most 1 MiB of result metadata; truncated reports a byte cutoff. These are count and byte bounds, not a cursor API.

Set home-owned limits in HOME/config.yaml, then restart the daemon:

```yaml
server:
  knowledge:
    max_entries: 10000
    max_entry_bytes: 1048576
    max_index_bytes: 16777216
    max_total_bytes: 1073741824
    max_pending_operations: 4096
```

Optional server.knowledge.max_publication_entries, max_publication_bytes and max_publication_receipts bound the host-owned set-publication foundation at 32 entries, 16 MiB of journal bytes and 10,000 retained receipts by default. They may only be lowered. The current CLI still changes individual final entries. The runner publishes a checked private set for its supported single candidate, including proposals staged through native worker tools.

Optional server.knowledge.attempts.max_sets, max_entries and max_bytes lower private storage ceilings of 10,000 retained records, 32 mutations and 16 MiB per staged document. Published and discarded records retain their slots. Automatic retention is not implemented. Only the home owner can change these settings.

These defaults are also the schema ceilings. Values must be positive integers. The total byte allowance counts active entry files; retained history and SQLite disk allocation are not quotas. Projects and workflows cannot override these owner settings. Stop the daemon before editing or removing canonical files or knowledge.db by hand. Restart rebuilds the indexes from final files before readiness; kb reindex also rebuilds projections while the owner is running. Never delete knowledge-writer.db to clear its lock. A publication failure blocks further hub operations until restart and replay; inconsistent retained bytes require inspection.

The main-agent MCP tools are titan_kb_add, titan_kb_get, titan_kb_update, titan_kb_delete, titan_kb_search and titan_kb_reindex. They use the same owner and strict input schemas. Native worker tools use execution-scoped authorization. Meaning search uses the installed local model. Multi-candidate selection remains pending. Approved persona definitions, retirement and canonical version deletion use the retained lifecycle decision path described below. The host-owned private view supports add, get, update, delete and word search; its ids do not grant agent authority.

Titan, Codex and Claude run on the same machine using the installed vendor programs. Podman supports automated tests. Live workers and falsifiers use the shared project directory by default. Their writes change the project immediately; candidate folders retain evidence. Explicit isolated mode remains available for compatibility. Cooperative claims serialize overlapping writers and allow independent scopes or overlapping readers. Managed read observations add dependency claims. Approved worker requests can expand write scope through release and automatic admission of the combined claim. Newly admitted paths receive separate, hash-bound rollback inputs after waiting. Received results and changed dependencies can enter explicit reconciliation generations. Arbitrary native and script reads retain complete-view validation. Exact-file enforcement for native processes and approved scripts remains pending.

The server owns runs and continues when a client exits. It listens on an authenticated loopback port. It stores discovery information under `TITAN_HOME`, defaulting to `~/.titan`. Use one server per home. A home can manage runs from multiple projects and clients. Cross-home writer fencing is not implemented. The server uses its own environment; per-submission credential binding remains pending. Run commands start a detached server when the selected home has no ready owner. The server uses separate process-group and ignored standard streams so client exit can leave it running. The daemon holds a process-owned SQLite lease. A killed daemon releases that lease, and startup can replace metadata for an absent owner. Never delete `server-writer.db` to clear ownership. Missing, malformed or live legacy owner records fail closed. Offline installed SDK tests recover a checker after its stream exits, then restart the daemon with SIGKILL or SIGTERM. Active vendor subprocesses during daemon death, live transcripts and uncertain external effects still require acceptance evidence.

Backend executables normally come from the pinned SDKs. To select a local installation, set owner-only options in `TITAN_HOME/config.yaml`:

```yaml
server:
  backends:
    codex-sdk:
      executable: /absolute/path/to/codex
    claude-sdk:
      executable: /absolute/path/to/claude/cli.js
      runtime: bun
```

Every supplied path must be absolute. Codex requires a readable executable file; a Claude script needs read access and may select `bun` or `node` as its interpreter. Omit these settings to keep SDK defaults. Restart the daemon after changing them. Project files, workflows and CLI overrides cannot select server executables. A missing configured file blocks execution without silently choosing a different program. This is not an authentication check.

Ask your agent to read `titan guide` and `titan schema workflow`. The agent should turn your problem into a workflow, check it, run it and show the resulting files and evidence. Install the guide into a project with either command:

```sh
bun run titan install --harness codex --project /path/to/project
bun run titan install --harness claude --project /path/to/project
```

These commands create `.agents/skills/titan/SKILL.md` for Codex or `.claude/skills/titan/SKILL.md` for Claude Code and refuse to overwrite an existing skill. Load `$titan` in Codex or `/titan` in Claude Code after the harness discovers project skills. Live harness discovery is still an acceptance gate.

The installed body is the canonical `titan guide`, including a checked starter workflow and explicit project, home, backend and run selectors. Routine hooks parse the header, compile the workflow, validate command availability and prove preservation of existing files for both harnesses. The archive probe repeats installation and workflow checks outside the checkout. Harness installation registers the local MCP command when the selected vendor program is available and reports registration failures. The stdio MCP endpoint is `titan mcp --home HOME`. Connect it through your harness settings. It exposes schema, validation, submission, run queries and pause, resume and cancellation tools. The CLI starts the local server when needed before serving MCP. The MCP endpoint is a client of that server. MCP request and decision tools are described below; approved script actions use the scoped approval path described below. Broader external operations remain pending.

Validate the supplied examples without starting an agent:

```sh
bun run titan check examples/*.yaml
bun run titan check examples/*.yaml --json
```

The four scripted workflows include packaged offline answer files and exact first-use commands in examples/README.md. Multi-file checks accept up to 256 paths. Their JSON data has schema_version 1, ok and a workflows array with each path, revision, nodes and resolved configuration. Combined JSON output is capped at 1 MiB. Single-file check data retains its operation-specific shape inside the ordinary envelope. A failure identifies the offending file, exits 2 and emits one JSON error object. Human checks print ok for each preceding valid file. Checks create no run or server.

Run a workflow against a selected project:

```sh
bun run titan run examples/code-review.yaml --project /path/to/project --backend codex-sdk --watch
bun run titan run examples/code-review.yaml --project /path/to/project --backend claude-sdk --watch
```

These commands make real vendor calls using that vendor's installed authentication. They can incur usage charges. The default test command makes no vendor call. Use `--backend fake` for generated stub answers. Those answers are demonstrations, not verification of your project. Set `backend` on individual personas to mix Codex and Claude in one workflow. Use a distinct `--submission-id` for new work. Reuse the same client and submission IDs only when retrying the same submission.

The server returns a run ID. Use that exact ID:

```sh
bun run titan status RUN_ID --json
bun run titan events RUN_ID --json
bun run titan usage RUN_ID --json
bun run titan pause RUN_ID
bun run titan resume RUN_ID --watch
bun run titan cancel RUN_ID
bun run titan artifacts list RUN_ID --json
bun run titan artifacts show RUN_ID ARTIFACT_ID --offset 0 --limit 65536 --json
bun run titan runs --json
```

A submission starts asynchronously unless `--watch` is present. Read commands exit zero when the query succeeds. A watched run exits zero when passed, one for failed, cancelled or timed out, and three when blocked. Input errors exit two. Connection and authentication errors exit four. Watch interruption handling and the complete flag matrix remain pending.

Each run lives in the selected project's `.titan/runs/RUN_ID` directory. The durable board records execution starts, native session IDs, checker results and state changes. The engine saves each successful worker candidate before committing its completed phase. A restarted engine can load a run and resume its unfinished invocation using the recorded native session ID. It refuses to silently create a replacement when an interrupted invocation has no recorded session. Exact vendor session and filesystem checkpoint agreement remains unverified.

Quality attempts and recovery retries are separate. A concrete checker refutation spends a quality attempt. A vendor or protocol failure blocks or retries the same attempt. Only explicitly classified retryable errors retry automatically. Unknown vendor error strings block for inspection. Retries remain spent after restart. Resuming does not reset the recovery allowance. Claude query turns are limited by `defaults.claude_max_turns`, default 30. Codex has no equivalent turn bound in this SDK binding. The current adapters do not yet classify every vendor rate-limit response into an automatic retry.

Use `titan usage RUN_ID --home HOME --json` to inspect usage across all committed attempts. HTTP `GET /runs/RUN_ID/usage` and MCP `titan_usage` return the same versioned report. The `through` cursor binds its journal prefix. `executions` counts physical invocations, including interruptions; `reported_executions` counts final usage records and `unreported_executions` counts starts without one. `known` contains reported input tokens, output tokens and USD cost. Each measure has its own `complete` flag. Missing native values make that measure incomplete, and an unreported execution makes every measure incomplete. A zero known cost with an incomplete flag is not evidence of free execution. No price estimate is substituted. Earlier quality attempts survive refutation and reload, and unchanged snapshots contribute no duplicate usage. This query scans journal history with a bounded cursor per declared phase; it does not build an unbounded event collection. Large histories still require scan time. Indexed reports, dashboard presentation and normalization of usage from interrupted native streams remain pending.

Steps support nested sequential and parallel groups, or an explicit dependency graph. The server has a shared active-agent allowance. Each run also has its own parallel-step limit. Completed dependencies contribute their candidate files to each downstream workspace. Conflicting parallel file changes block assembly instead of selecting a winner silently. The original project is not automatically patched. `titan artifacts RUN_ID` now verifies the kept manifest, file bytes, executable intent, result text and passed journal commitment before returning review metadata. It includes workflow identity, stable file identifiers, relative paths, hashes, byte sizes and outputs. The authenticated HTTP route `/runs/RUN_ID/artifacts` and MCP tool `titan_artifacts` use the same inspection. A changed or incomplete delivery fails. Review the returned `result.md`, `artifacts.json` and artifact files first. Use `titan artifacts list RUN_ID` for the same inspection, then `titan artifacts show RUN_ID ARTIFACT_ID --offset 0 --limit 65536 --json` to read a kept file by its returned identifier. The response uses base64 for exact binary bytes and carries a byte offset, next_offset and has_more. The default and maximum page size are 65536 bytes. Continue from next_offset until has_more is false; offsets are bytes, not text characters. An offset equal to file size returns an empty final page; a larger offset fails. Each read verifies the delivery and streams the selected file hash before returning its bounded page. The HTTP route `/runs/RUN_ID/artifacts/ARTIFACT_ID` takes offset and limit query parameters; MCP tool `titan_artifact` uses the same typed fields. Local selected-file export is described below. Approved application remains pending.

Settings have one schema in `@titan/config`. Precedence is built-in defaults, home `config.yaml`, project `.titan/config.yaml`, workflow settings, then supported CLI overrides. Use `titan config [workflow.yaml] --json` to see the resolved values, hash and source of each value. Use `titan schema config` to inspect the schema. Only the home owner can configure `server.max_active_agents` and `server.max_pending_agents`. Active defaults to 8; pending defaults to 1024 and accepts 0 through 65536. Zero pending refuses waiting while allowing free active slots to start. A full queue blocks the same logical attempt before any agent execution or session starts. Resume the blocked run after capacity drains; completed phases remain intact. These server budgets cannot be overridden by a workflow. Run-level settings include `limits.max_steps`, `limits.max_parallel`, `limits.max_minutes` and bounded recovery delays. Workspace snapshots also use `limits.max_workspace_entries`, `limits.max_workspace_bytes` and `limits.max_workspace_depth`. Their defaults are 10,000 entries, 1 GiB of file content and 64 path components. Directories count as entries, including empty directories; the root does not count. Excluded metadata, dependencies and environment files are skipped. Empty directories are not delivered. Home, project and workflow files can override these values within fixed schema ceilings of 100,000 entries, 16 GiB and 128 components. These are snapshot budgets, not disk quotas for a running agent. Agent disk and operating-system confinement remain separate acceptance work. A worker exceeding a snapshot budget blocks the same quality attempt. Parallel candidates must also fit the budget after assembly. For example, put the following section in a workflow or project configuration:

```yaml
limits:
  max_workspace_entries: 20000
  max_workspace_bytes: 2147483648
  max_workspace_depth: 64
```

Use repeated `--set SECTION.KEY=VALUE` on `check`, `config` and `run` for registered defaults, limits and recovery fields. For example, `--set limits.max_parallel=2 --set recovery.max_retries=0`. Values accept JSON numbers, null and plain enum text such as `defaults.backend=codex-sdk`. Quoted JSON numbers remain strings and fail numeric fields. Each entry is capped at 1024 characters and each invocation at 64 entries. Unknown keys, owner settings, duplicate keys and collisions with `--backend` or `--max-parallel` fail before file loading or submission. The combined effective configuration still validates cross-field constraints. `titan config --set limits.max_parallel=2 --json` shows the resulting value and CLI source. The server validates submitted overrides again and freezes them in the run. Other dedicated companion flags remain pending.

Use `titan config init --scope project --home HOME --project PROJECT --json` to create the project settings file. Use `titan config validate --scope project --home HOME --project PROJECT --json` to validate it and read its exact byte version. Then call `titan config set limits.max_parallel 2 --scope project --expected-version VERSION --home HOME --project PROJECT --json` with that returned version. Select user scope for home-owner settings. Concurrent writers receive a version conflict or bounded lock refusal and must inspect again. Successful writes replace YAML formatting and comments with JSON. Read the [configuration package contract](../packages/config/README.md#scoped-file-changes) for file ownership, limits and recovery. `titan config schema --json` exports the input schema offline. `titan config show --scope project --home HOME --project PROJECT --sources --json` inspects the current project file and inherited owner settings without a daemon. Select user scope to inspect owner settings alone. The report includes its absolute path and nullable byte version. Missing optional files remain absent. Use the returned file version for a later set command. Run and file selectors cannot be combined. Use `titan config show --run-id RUN_ID --home HOME --sources --json` to inspect a committed run, including its saved settings, source map, hash, workflow revision and journal position. Omit `--sources` to omit the source map. HTTP `GET /runs/RUN_ID/config` and MCP `titan_config` return the same saved report with sources. File edits and daemon restart preserve it. Current owner ceilings and revision history remain pending.

Personas are local definitions with a role, tools and optional model and backend. Inputs and outputs are named JSON Schema descriptions. Output objects must match the declared fields. Only one candidate is supported per step in this preview. Each step needs a separate falsifier persona. Persona definitions support inline values, saved references and mutations. The run pins immutable saved versions before execution. Mutations inherit omitted tools and tags. Use `titan persona show NAME` to inspect saved versions. Script workers, script falsifiers and step checks use scoped action approval. Inspect the exact command, working directory, phase and configuration hash in the pending request. After approval, resume the same run. The server validates the current execution claim and approval before launch. Missing approval starts no process. Changed commands need their own approval.

Default personas are read-only. Listing Write or Edit permits candidate edits by the worker. Claude supports Read, Glob, Grep, Write, Edit and writable-phase Bash when listed by the persona. Both permission callbacks use the native tool's own path fields. Write and Edit additionally require a writable declared live file scope. Glob patterns and Grep glob filters must be relative. Parent markers, home expansion and extended glob syntax are refused. Recursive patterns and flat extension alternatives work. Bash uses command-text checks with incomplete filesystem enforcement. Codex uses its native read-only or workspace-write sandbox with network access disabled. Complete per-tool Codex enforcement, native write fencing and same-user authority isolation remain open. Both adapters require live adversarial acceptance. External operations, human-only approval enforcement and secrets as tool inputs remain pending.

Snapshot limitations remain: symlinks and special files are rejected. New snapshots retain executable intent with private mode 700 for executables and 600 for ordinary files. Group/world permissions, ownership and special mode bits are not restored. Mode-only changes participate in dependency assembly, candidate hashes and parallel conflicts. Historical non-executable hashes remain valid; executable metadata discarded by an older run cannot be recovered automatically. Snapshots exclude `.git`, `.titan`, harness settings, dependencies, build outputs and `.env` files. Known credential values in ordinary files or records cause rejection without printing the value. This is not a complete detector for credentials unknown to the current process. Old worktrees and run folders are retained for review. Automatic retention and cleanup remain pending.

Build a private local archive with `bun run pack:preview`. It bundles Titan's runtime and includes pinned vendor dependencies, guide, schemas and examples. No registry publishing is performed. Package ownership and public distribution remain pending. A fresh archive installation outside the repository passes a four-step mixed-plan run with the fake backend on Linux x64, Bun 1.3.10, inside rootless Podman. Installed Codex and Claude SDK checks use versioned executable stubs. They cover checker recovery after daemon restart and two independent eight-step mixed file-delivery graphs, including live parallel barriers, swapped backend assignments, reversed graph presentation and isolated file failures. Live vendor programs remain unverified. To install the generated private archive in a new directory, run `bun add /absolute/path/to/titan-cli-0.1.0-alpha.1.tgz`, then `./node_modules/.bin/titan --help`. Do not install it over an existing application without reviewing dependency changes.

From the checkout, run `bun run check:package` to rebuild, install into a fresh temporary directory and check the installed CLI with no checkout mounted into its container. Dependency preparation can use the registry. The installed engine runs without external networking. It checks a fake mixed workflow and both pinned SDK libraries with versioned executable stubs. The check compares shipped schemas and guide with CLI output. It starts the server, runs the mixed dependency example and inspects events and artifacts. It confirms the original project file stays unchanged and stops the server. It removes only the temporary installation it created. This separate packaging check is not part of routine `bun run check`.

Run `bun run check` for lint, types, the isolated default suite with coverage, the scenario map and documentation checks. The test command requires Linux and rootless Podman. Prepare its image once:

```sh
podman pull docker.io/oven/bun@sha256:367842b35abbdf23f39e23c71f3a08eee940ff2679a14e08a5afcf4a1436cd89
bun run test:prepare
bun run check
```

Image preparation can download its pinned Bun base and Git dependencies. The test command never pulls an image. It refuses to run when the prepared image or boundary is unavailable. Tests run with no external network, with loopback available, a read-only source mount and a temporary writable home. Only coverage output is written back to the checkout. No host home, credentials or container socket is mounted. The boundary covers native child processes and Git hooks as well as the test process. Every product source must be loaded with complete measured line and function coverage. The offline suite includes child-process and Git-hook network escape attempts, bounded I/O, concurrent sessions and SDK-backed engine recovery. See the implementation record for measured results. These are stubbed checks; they do not establish live vendor permissions or recovery behavior. Documentation checks run separately with `bun run check:docs` and start no engine or vendor.

The offline engine suite also checks a 40-node graph with eight sequential, parallel and join waves in ordinary and reversed presentation. Every completed worker and checker runs once, joins receive ancestor files and live worker barriers prove overlap within the configured limit. A completed refutation skips all descendants without changing their original checkpoints, while its independent peer completes. These larger cases use the fake backend; the installed native tests above retain their separate scope. See the [graph evidence](../openspec/changes/resilient-agent-blackboard-bun/research/long-mixed-graphs.md).

The local knowledge hub, persona register, quality history, sampling, automatic helper turns and approved persona changes are implemented. Step script proofs run before falsifier agents. Goal proof execution, Lean and SMT execution, the full improvement loop, cloud workers, other adapters and remaining approval operations stay open in the product backlog. Production readiness remains unestablished.

## Workflow inputs

Inspect a saved persona with `titan persona show investigator --json`. A name selects its saved versions, newest first. The default page holds up to fifty versions. Use --limit and follow next_version through --before when has_more is true. Use `titan persona show investigator@2 --json` for an exact version. The result includes the definition, state, counters and retained quality history. The counters include completed uses, worker survival and refutation totals, checker refutations and checker passes that a later persona or script check refuted. Add `--home HOME` to select the engine home. This read-only command works while the daemon is stopped.

Each saved version also exposes usage with physical executions, reported and unreported execution counts, known input tokens, output tokens and USD cost, and completeness flags. Terminal journal delivery retains one replaceable report per run, so replay leaves totals unchanged. Interrupted starts remain visible. Older versions without retained usage expose incomplete historical measures. These reports use the same Claude cumulative and Codex additive policies as run usage. History and canonical entry byte limits apply. Helper-request counts and automatic history compaction remain pending.

`titan check FILE` prints `ok` for a valid workflow. Add `--json` for one object containing the checked plan and resolved settings. Invalid workflows exit with code 2. Diagnostics name required fields and retain complete nested paths, including array indexes and quoted persona names. Human diagnostics use stderr. JSON diagnostics use one stdout value. Validation starts no agents and creates no run directory.

An input such as `inputs: { plan: b.plan }` requires b to finish before its consumer in every group order or through a transitive graph dependency. Parallel peers cannot exchange an unfinished result. Declared input and output formats must have the same structure. Object property order does not affect that comparison. A mismatch reports the input path, source output and both formats. `titan check FILE` and `titan run FILE` reject these errors with exit code 2 before starting agents or writing a run.

## Failed parallel branches

A completed refutation stops dependent steps and later items in its sequential group. Independent parallel branches finish. The CLI returns exit code 1 for the failed run. Its run directory contains result.md with the workflow identity, goal and each step's outcome, attempt count, refutation count and evidence. The report uses versioned JSON inside a Markdown code block. The engine writes it atomically before committing terminal failure. A failed run has no published artifact manifest.

### Run records

File-based CLI runs retain the exact workflow bytes in workflow.yaml, including comments and line endings. The local server reads the absolute source path within a 1 MiB allowance and validates it against the submitted plan before admission. HTTP and MCP callers select this behavior with preserve_source and workflow_path. Source bytes bind the submission identity, so changing a comment requires a new submission. Inline submissions retain the validated workflow with resolved defaults as YAML. The events.jsonl and board.jsonl names point to the same durable journal, so event history and persona requests share one committed sequence. A missing event-log name is restored during replay. A replaced file, directory or symbolic link is refused. Step folders retain task inputs, candidate workspaces, kept candidate hashes and phase answers in the journal. Successful and failed result.md reports contain versioned JSON with workflow identity, goal and every step's outcome, attempt count, refutation count and evidence. Successful reports also contain the final outputs. Human-readable terminal CLI output prints the report path. Machine output remains one JSON value.

Artifact inspection verifies the report against the committed node state. New manifests and passed journal records carry the report-format version together. Existing deliveries that omit both markers retain their original report format and size limit.

## Event inspection

`titan events RUN_ID --home HOME --after 0 --limit 100` returns a JSON object with `schema_version`, `run_id`, `after`, `events`, `next_cursor` and `has_more`. The client binds the run, starting cursor and requested count, and refuses inconsistent sequence, continuation or byte size. Continue with `--after` set to the last returned cursor until `has_more` is false. The default and maximum count is 1000 events; each complete page is at most 1 MiB. An individual event too large for that budget fails explicitly. An empty page retains the requested cursor. A cursor beyond the latest committed id fails; HTTP returns 409. Invalid, repeated or unknown HTTP selectors fail rather than silently selecting a different range.

HTTP uses `GET /runs/RUN_ID/events?after=0&limit=100`. MCP `titan_events` accepts the same numeric selectors. This changes the earlier preview's unbounded event array into an explicit page object. Paging streams the journal and retains only the bounded event view. It still scans earlier records to validate sequence and cursor ownership; a byte-offset index and live server-sent event subscriptions remain pending.

## Durable status

Status, submission, control responses and run-list rows return detached committed snapshots. They wait for writes already queued for that run. A failing journal or projection write returns an error rather than acknowledging pending state. Restore the storage prerequisite and explicitly reload the journal through engine restart; failed writer chains are not silently cleared. Event pages capture a committed version for each request. Later commits appear on later pages or requests.

## Per-run failures

`titan runs` retains an indexed run whose journal cannot be read as `read_unavailable`, with its run id and diagnostic. A missing initial journal is `initialization_incomplete`. These are catalog availability states, not successful workflow outcomes. Other runs remain visible and queryable. Direct inspection of a failed writer still returns an error; the list does not clear its failed state. Initial background starts and resumes share rejection handling so one storage failure does not become an unhandled execution rejection.

## Managed agent processes

The native Codex and Claude preview currently requires Linux. Agents stay on the same machine and operate on their candidate files. Each native turn has a managed process group and workspace lease; daemon loss or cancellation stops that group before explicit recovery. The archive includes the required `agent-host.js` asset beside the CLI. Keep both files together.

Home-owner settings can tune host overhead:

```yaml
server:
  agent_host:
    gc_markers: 1
    worker_threads: 2
    startup_timeout_ms: 10000
```

GC marker counts accept 1–16, worker pools accept 2–16 and startup deadlines accept 1–60000 ms. These settings bound managed Bun overhead; workflow concurrency still controls admitted agents. Project and workflow files cannot override these server settings. Offline tests cover partial-file and native-id recovery with both vendor stubs; real vendor transcripts and programs that escape their process group remain outside that evidence.

Claude file tools reject linked invocation roots and symlink components, including dangling and inside links. Parent components are refused before normalization. New files under ordinary directories remain supported. This path policy retains filesystem race limitations and does not enable shell tools.

## Find runs by caller

Use `titan runs --client-id CLIENT --limit 20 --json`. Omit the caller filter to see all callers sharing this home. Rows include `client_id` and preserve unavailable runs as diagnostics. The response is a versioned page object instead of the earlier unbounded array: `runs`, `before`, `next_before` and `has_more`. Continue with `--before NEXT_BEFORE`; the cursor excludes that indexed submission and moves toward older rows. The default count is 50 and the maximum is 200. Start a fresh first page to see newer submissions. Insertion and server restart preserve older cursors. Each row describes its own committed state; a page is not a shared snapshot of every run's state. HTTP `GET /runs` and MCP `titan_runs` accept `before`, `limit` and `client_id`. Caller identity is a filter, not separate authorization.

## Export a selected file

After `titan artifacts list RUN_ID --json`, choose a returned file identifier and run `titan artifacts export RUN_ID ARTIFACT_ID --output /absolute/new-review-directory --json`. This local command requires the client and daemon to share the kept filesystem. The parent must exist without links, and the selected new directory must not already exist or lie in run storage. Titan verifies the passed journal, manifest, result and file evidence before creating the output. It streams the file into `files/` under its relative path, retaining executable intent, and writes `artifact.json` with its workflow and delivery identity, selected hash, size and outputs. Existing destinations remain intact. Ordinary copy failures remove the incomplete output; a host crash can leave an incomplete directory, so inspect it before retrying with a new destination. This path is not a sandbox against a hostile same-user filesystem race. The original project and kept delivery stay unchanged. Exporting a proposal does not perform its external operations. Approved diff application remains pending.

## Review and answer one permission request

Inspect the exact run and request before deciding:

```sh
titan requests show RUN_ID REQUEST_ID --home HOME --json
titan answer RUN_ID REQUEST_ID approve --request-version 1 --client-id CLIENT --reason Reviewed --home HOME --json
```

Use the version returned by inspection, rather than assuming 1. An agent answer uses the agent token and cannot answer a human-level request. A person may deliberately use:

```sh
titan approve RUN_ID REQUEST_ID --request-version 1 --client-id CLIENT --reason Reviewed --home HOME --json
titan deny RUN_ID REQUEST_ID Reason --request-version 1 --client-id CLIENT --home HOME --json
```

`answer` also accepts `deny` with `--reason`. All answers require an explicit client label and observed request version. A stale or repeated answer exits 2; inspect again instead of automatically replacing the version. The person token stays in the private `person-token` file under HOME and survives server restart. It is separate from the rotating agent token. A missing, linked or unsafe person-token file is refused. Same-user agents may read this file, so token possession does not prove a person is present. Do not use a person command to bypass a required decision.

A main agent can also answer with the scoped choices below. Use the observed version and client label from inspection.

```sh
titan answer RUN_ID REQUEST_ID --yes --request-version 1 --client-id CLIENT --home HOME --json
titan answer RUN_ID REQUEST_ID --deny Reason --request-version 1 --client-id CLIENT --home HOME --json
```

### Supply a persona definition

Save the proposed definition in a YAML or JSON file. The name identifies its version history. The definition uses the workflow persona fields.

```yaml
name: reviewer
definition:
  description: Reviews changes to the project
  role: Check each change against the requested outcome
  tags:
    - code-review
```

```sh
titan answer RUN_ID REQUEST_ID --persona persona.yaml --request-version 1 --client-id CLIENT --home HOME --json
```

An approved new persona enters trial and becomes eligible for a matching open call. Resume that run after answering. An approved improvement saves a new version with its original parent. An approved merge saves the supplied definition and preserves both source versions. The durable answer retains the complete supplied definition. Restart recovers publication through its stored decision receipt.

A new definition must cover the requested tags. An improvement must keep the requested persona name. A merge names two distinct registered versions. Conflicting answer choices fail before changing the request. A human-level request uses titan approve with the same persona option.

After a run, Titan compares the role texts of saved trial and proven personas when the local meaning model is available. Different names with a similarity of at least 0.9 produce a merge request containing both saved versions. Answer that request with the combined persona definition. Restart preserves the offer and prevents duplicate requests for the same run. An unavailable optional model leaves this comparison for a later run. Invalid vectors or an oversized offer batch block terminal history delivery for recovery.

### Delete a saved persona version

A delete_persona request names the saved version, such as worker@1, and requires human approval. Approval archives the definition and its decision receipt under HOME/knowledge/.history/persona. The version leaves current search and open-call selection. Existing frozen runs retain their definition. Their later quality and usage records append to archived history without restoring the deleted version. New registrations continue with the next version number.

Use titan kb history with the saved knowledge entry identifier to read its earlier revisions. Denial preserves the current version. Interrupted approval and history publication recover on server restart. Approval of legacy unversioned persona files remains pending.

Pass a pending main-level request to the person with:

```sh
titan answer RUN_ID REQUEST_ID --to-person --request-version 1 --client-id CLIENT --reason Review --home HOME --json
```

Do not combine --to-person with approve or deny. Version, client and reason are required. The same request stays unanswered at human level, with unchanged scope, origin and expiry. A passed_up journal event records the actor, reason and time. Inspect its returned version before the person answers; escalation normally advances version 1 to 2 and the person decision advances 2 to 3. Repeated or stale escalation fails without replacement. Agent answers remain forbidden after escalation. Server restart retains the pending escalation and its audit.

These commands inspect and record a scoped decision. Structured request turns support explicit continuation as described below. Execution of approved external actions remains unfinished. The installed package verification tests these commands offline with actual server and CLI processes; it does not establish live vendor acceptance.

## MCP permission requests

Start the stdio bridge with `titan mcp --home HOME` through your harness's MCP configuration. Installation of the Titan skill does not register this bridge. The bridge advertises five request tools:

| Tool                   | Required input                                                 | Result                                            |
| ---------------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| titan_requests         | optional run, origin, project, state, count and cursor filters | versioned bounded request page                    |
| titan_request_open     | run_id and the strict scoped request input                     | state waiting or answered, plus the request       |
| titan_request_read     | run_id and request_id                                          | the current state and request                     |
| titan_request_escalate | run_id, request_id, version, reason and client_id              | waiting human-level request with escalation audit |
| titan_request_answer   | run_id, request_id, version, decision, reason and client_id    | the first accepted answer                         |

Use the version returned by inspection. A creation retry must use the same id and identical scope and origin; it returns the retained decision when already answered. Answering always uses the agent credential. A human-level request remains waiting until an explicitly selected person command answers it. Supplying authority in a tool call is an error. Never switch to a person command to bypass that refusal. These controls record permission decisions. Explicitly resume a structured waiting run after answering its requests; decisions do not execute an external operation.

## Request listing

Request listing returns a versioned page with query, requests, unavailable, next_cursor and has_more. Use --run-id, --client-id, --harness-session-id, --project-path and --state waiting|answered as intersecting filters. Project paths must be absolute and normalized. The default count is 20, the maximum is 100, each page is limited to 1 MiB and each call reads at most 16 runs. Continue with --cursor using next_cursor and the same filters; the count may change. A filtered page may be empty while has_more is true. Follow its cursor. Unreadable runs retain their indexed identity in unavailable. Cursors survive catalog restart and exclude newer submissions from older pages. Answers may change between pages; this is not a frozen snapshot. Origin filters support navigation and do not authorize access. HTTP GET /requests and MCP titan_requests accept the same selection. Per-run journal prefix replay remains in use.

```sh
titan requests --home HOME --harness-session-id SESSION --state waiting --limit 20 --json
titan requests --home HOME --harness-session-id SESSION --state waiting --limit 20 --cursor NEXT_CURSOR --json
```

## Approval policy

Approval policy lives under `approvals` in the central configuration and generated schema. Defaults cover all request kinds. The home owner can lower configurable kinds; project files, explicitly selected files, workflows and CLI overrides can only keep or raise inherited levels. `delete_persona`, `action`, `raise_limit` and `paid_compute` always require `human`. Use `--set approvals.tool=human` on check, config or run to raise that kind through the same registry. Each run captures the effective map and its configuration hash. New requests and replay use that frozen policy, so later home changes do not reinterpret history. Legacy snapshots without the optional map keep the original defaults and unchanged hashes. An `auto` level alone does not create an automatic decision or execute an operation.

For example, the person can put this in HOME/config.yaml:

```yaml
approvals:
  lock_statement: main
  tool: human
```

A workflow can raise `tool` to `human` but cannot undo that owner choice. Inspect values and sources before submitting:

```sh
titan config --home HOME --project PROJECT --set approvals.resource=human --json
titan check workflow.yaml --home HOME --project PROJECT --set approvals.tool=human --json
```

Configuration failures name their source, field and plain error text. The fixed human floor applies before backend loading. These configuration checks do not establish native permission interception or approved action execution.

## Structured agent waiting

Set request_turns: true on a worker or checker persona to opt into a result/requests envelope. Complete work returns its normal result and an empty requests array. To wait, return a null result and one or more strict request descriptions containing kind, scope and expires_at. Titan assigns request ids and the asking session origin. The complete batch must fit 1 MiB and the frozen requests.max_per_run allowance.

For automatic persona help, return an `ask` request with `scope.operation` set to `ask`. Set `scope.resource` to a declared workflow persona alias or its frozen version reference. Put the question in `scope.arguments`. Titan runs that persona in the shared project with its own backend and tool permissions, records its result, and supplies the answer to the asking session. The request must have automatic approval. Raised approval and unknown targets wait for an external answer. An answer already supplied by an authorized client takes precedence. Completed helper results survive restart without another helper execution.

`titan persona show NAME --json` includes each version's `asked` count and `asked_history_complete` flag. These counts update after the run. Older records retain an incomplete-history flag when their earlier questions cannot be reconstructed. Helper executions contribute to that version's reported usage.

The step releases its agent slot while independent work continues. The run reports waiting with exit code three. List and inspect its requests using the commands above, record approval or denial, then use titan resume RUN_ID --home HOME --watch. Unanswered requests start no native turn. Answers continue only the asking phase in its retained session, without spending operational recovery allowance or a quality attempt. Decisions do not grant tools or execute operations.

Older pending turns use run format three. New daemon runs start in format eleven with pinned persona references. Supplied persona definitions upgrade runs to format thirteen. New step script proof runs use format fifteen for retained proof reports. Format fourteen remains readable. Each retains its installed release pin when worker receipts are saved. Use the recorded compatible runtime to inspect and resume a pinned run. Offline SDK process cases exercise both Codex and Claude Code with synthetic native state. The installed archive check also exercises waiting through daemon restart and SIGKILL, with CLI, HTTP and MCP decisions. Native persona MCP registration and real vendor transcript restoration remain separate checks.

Each run also exposes requests.json in its run root. It contains schema_version, run_id, through and the complete unanswered request set. The cursor identifies the journal prefix used for publication; unrelated later execution events need not rewrite it. Answered requests disappear, and pending escalation keeps its audit. Use normal request commands to inspect decisions and their current versions. Editing this file cannot answer a request or authorize an operation.

The engine rebuilds the file from validated history whenever it loads a run, ignoring missing, stale or malformed file contents. If storage prevents publication, the request or decision may already have reached the journal. Repair the filesystem problem and restart the owner to reload history before retrying. A failed writer does not clear itself or acknowledge further changes. Loading fails until the projection can be rebuilt. Offline installed tests delete or corrupt this file before restarting Codex and Claude waiting workflows, and verify independent pending requests in a parallel wave.

## Caller session labels

You may add --harness-session-id SESSION to run. HTTP submissions and MCP titan_run use harness_session_id. Supply one through 128 characters; Titan keeps the exact opaque label in the run header and available summaries. Retrying the same submission must keep this label; a changed label conflicts. New installed daemon runs use format eighteen and retain the installed Titan release and exact bundle hash throughout waiting and recovery. Format four remains readable for older labelled runs. This caller label is separate from native worker and checker session ids. Request origin filters select those request origins, not the outer caller label. The label grants no authority. The CLI saves durable submission receipts before posting. Indexed caller-session filtering remains pending.

## Resident run allowance

The home owner can set a process memory allowance in HOME/config.yaml:

```yaml
server:
  max_resident_runs: 32
```

The default and ceiling are 1024; the minimum is one. Restart the server after changing this value. Project and workflow settings cannot override it. Active runs retain their slots. Inactive runs may leave memory and reload from their journals. A full active set refuses another run without executing it. That creation may already be recorded: after capacity is released, retry its submission and explicitly resume its blocked run. The allowance does not limit the durable catalog.

## Codex native configuration

Codex turns skip native home and project config.toml through --ignore-user-config. Set models and runtime policy in Titan configuration and personas. Native authentication and session storage still use the existing Codex home. The private preview embeds the pinned SDK launch-option patch and installs its exact native CLI dependency. Synthetic offline probes check inherited MCP startup and file-based authentication. Complete persona tool enforcement and real vendor transcript recovery remain pending.

Repeated resume during an answered permission continuation preserves the active native session and completed peers. The offline and fresh-install checks hold Codex and Claude continuations, issue concurrent HTTP and stdio MCP controls, verify current-origin admission and check usage before and after release. Unanswered resumes still start no native execution. These fixtures do not prove real vendor transcript recovery.

Use titan runs --client-id CLIENT --harness-session-id SESSION --project-path /absolute/project --limit 20 --json to narrow run navigation. Filters intersect across CLI, HTTP GET /runs and MCP titan_runs. Session labels remain opaque. Projects must be absolute and normalized. Session or project selection returns page version two; ordinary listing retains version one. Count limits inspected catalog rows, so a filtered page can be empty while has_more is true. Follow next_before until has_more is false. Missing metadata cannot match a session or project selection; use unfiltered listing to inspect unavailable runs. These filters grant no authority. Indexed lookup and dashboard filtering remain pending.

Claude usage records are cumulative within a native session. Titan retains raw records and adds only increases in each measure within a phase and quality attempt. Codex records remain additive per turn. Backend selection uses the frozen persona, configuration default and run fallback in that order. New quality attempts retain their independent totals. An observed counter drop keeps the highest known subtotal and makes only that measure incomplete; a later report cannot restore completeness after a missing value. Interrupted starts remain unreported even when a later cumulative result includes their usage. Native USD cost is an SDK estimate, not a billing receipt. Hidden counter resets without an observed drop cannot be reconstructed from these records.

Claude system/api_retry events now enter Titan recovery when their fields are valid and their cause matches their HTTP status: rate_limit with 429, or overloaded/server_error with a server-error status. Native delay is retained alongside the configured backoff; values above 2,147,483,647 milliseconds are refused before scheduling. The frozen recovery.max_retries allowance limits physical continuations. The same phase, native session, files and quality attempt remain in use; completed peers stay complete. Unknown causes, billing errors, contradictory statuses and malformed delays block without automatic retry or a quality refutation. Ordinary rate_limit_event notices do not replace a successful final result. Native retries without final usage records remain explicit unreported starts. Codex errors still lack a verified structured classification and block for diagnosis and explicit resume.

Stopped executions in backoff now release physical agent capacity and the per-run node slot. Independent ready branches can advance even with limits.max_parallel set to one. Their phases retain the native session, files, retry date, spent allowance and quality attempt. The run reports recovering while only retry waits remain, and running while another node executes. Pause, cancellation, reload and resume retain that checkpoint; cancellation and the hard deadline remain terminal. A retry starts only after its recorded date. No dashboard or live vendor transcript acceptance is implied.

Home configuration also accepts optional server.backend_limits, for example {claude-sdk: 1, codex-sdk: 3}. Each value is a positive safe integer or null. Missing and null entries add no backend ceiling. Restart the daemon after changing owner settings. The shared agent limit and each workflow's limits.max_parallel still apply. Waiting for one backend leaves active slots available to another backend, across runs and within a mixed plan. These are owner budgets; workflows cannot raise or replace them. Queue telemetry and live budget changes remain unfinished.

Home server.knowledge.attempts may lower max_sets, max_entries and max_bytes from 10,000 private records, 32 mutations and 16 MiB per staged record. These owner settings cannot be raised by workflows. Closed records retain their slots; there is no automatic cleanup. This store survives restart and excludes private changes from final search. Native Codex and Claude workers use execution-scoped project proposals. Checkers read committed knowledge. The runner publishes checked proposals for the supported single candidate. Multi-candidate selection remains pending.

### Resume a refused native setup

If owner capacity or bound turn validation refused setup before backend startup, Titan retains prepared delivery proof on the same logical result attempt. It records no model start for that refusal. Once the cause is resolved, use `bun run titan resume RUN_ID --home HOME --watch`. The original recovery allowance still applies; resume and daemon restart cannot refill it. Completed peer steps and checked files remain in place.

An uncertain delivery or an older record without proof cannot authorize a fresh start when its native session id is missing. That run stays blocked against duplicate work. This version does not reconstruct an unavailable native conversation or reconcile every native-process startup failure. The source and installed checks for this path use vendor stubs.

## Scripted offline answers

Use `--harness fake --fake-script /absolute/path/answers.yaml` with `run`, `check` or `config`. For workflow commands, `--harness codex`, `--harness claude` and `--harness fake` select the `codex-sdk`, `claude-sdk` and `fake` backends. Supplying both selectors fails. Skill installation keeps its separate `--harness codex` or `--harness claude` meaning.

A script is a strict version-1 document with at most 1,024 replies and one MiB of encoded JSON. For example, adapt these task names and answers to the workflow.

```yaml
version: 1
answers:
  - persona: worker
    task: Implement the requested change
    answer:
      summary: A deterministic offline answer
  - persona: checker
    task: Try to disprove the result
    answer:
      verdict: survived
      evidence: Scripted acceptance evidence
```

Each reply matches its persona and exact task. `attempt` and `execution` default to 1. Set them explicitly for quality retries and subsequent physical executions. Duplicate coordinates fail validation. A missing reply blocks before execution accounting, preserves the quality attempt and names the unscripted task.

The CLI loads the answer file once and submits its parsed contents in the run overrides. The resolved `backends.fake.script` is frozen with the run configuration and its hash. The same setting can be defined in home, project or workflow configuration. Later edits to the answer file leave that saved script intact. Concurrent workflows retain their own scripts. These answers exercise Titan's offline execution contracts. Real Codex and Claude acceptance remains required.

## Run observation

`titan run FILE` watches the accepted run until it passes, fails or needs intervention. Successful completion exits zero. A terminal negative outcome exits one and a blocked, waiting or paused run exits three. The human result includes the result.md path for passed and failed runs. JSON output remains one value.

Use `titan run FILE --detach --json` to return the accepted run identity immediately. Detached exit zero means submission was accepted. Continue with `titan status RUN_ID --watch --json`. The daemon keeps executing independently of the client. Use `--watch` to request observation explicitly. Combining `--watch` and `--detach` fails before loading the workflow or starting a server. Dry run accepts neither flag.

## Automatic local startup

Run, inspection, recovery, request and knowledge commands connect after their input checks. When the selected home has no authenticated ready owner, they start the installed CLI bundle or checkout entry as a detached local server. Concurrent startup attempts use the existing process-owned SQLite lease and converge on the ready owner. Discovery is read as bounded data, and the authenticated health response must match its shared schema. No submission is retried by this connection step.

Set server.startup_timeout_ms in the selected home's config.yaml to reduce the built-in 5000 ms startup deadline. The schema accepts positive integer milliseconds up to 5000. This owner setting follows the server configuration boundary. Startup probes have a 250 ms cap and a 25 ms polling interval within the remaining deadline. A failed startup exits 4 and stops the child that invocation launched. Use titan serve with the same home for foreground startup diagnostics.

### Recovering a lost submission response

Before posting work, run saves caller and submission ids in submissions.db under the selected home. A lost response exits four and reports submission_uncertain. JSON exposes error.recovery.client_id, error.recovery.submission_id and error.recovery.receipt_path. Retry the same workflow, home and settings with the reported --submission-id and --client-id. When exactly one saved caller has that submission id, --client-id may be omitted. Different callers may use the same submission id, in which case both flags are required. Use a fresh submission id for intentional new work.

The receipt digest binds the validated workflow, exact source bytes, absolute paths, backend, resolved settings and optional harness session. Changed input fails before network work. Keep the receipt ledger with its home during recovery. The home config may set client.max_submission_receipts from one through 10000. The default is 10000. Project, workflow and command override layers reject client settings. Full storage retains old identities, accepts identical retries and refuses new submissions. The ledger contains ids and a digest. Submission uncertainty exposes these receipt fields inside error.recovery.

## Machine output and event following

Ordinary --json commands return one schema-version-one envelope. Read the command result from data. Operation identifies the command, including a nested command name. Identifiers contains run_id, workflow_id, client_id, submission_id and harness_session_id, using null when unavailable. State is the observed run state or null. Error is null or an object with code, message, paths, retryable and recovery. Human output and protocol streams retain their own framing. Serve --json retains its readiness object.

Run output includes the first bounded event page as events, after, next_cursor, has_more and truncated. Finite events queries use the same envelope and retain their typed page in data. Continue with events RUN_ID --after NEXT_CURSOR. A watched blocked run exits three and error.recovery names resume and the retained run id. Resolve the missing prerequisite before resuming. Queries exit zero when their read succeeds. Terminal negative watches exit one, input errors two and transport errors four. An observation transport failure keeps a known run id and status recovery. A lost submission response instead exposes the saved client, submission and receipt path in error.recovery.

Use events RUN_ID --follow for human event lines or events RUN_ID --follow --format jsonl for one versioned event per line. Each JSON line carries run_id and its durable event id. The observer drains bounded pages before polling. It rejects --json while following and rejects unsupported formats before contacting the daemon. Ctrl-C ends the observer and leaves daemon work running.

## Run format recovery

This release reads saved run formats 1 through 18. A complete journal record naming another positive integer format fails with unsupported_run_format. The diagnostic lists supported formats and directs you to the installed release that created the run. Status, events and controls retain this diagnostic. Replay and append refuse the record before repairing an incomplete tail, writing the state projection or scheduling work.

Keep the original installed release and its archive with runs you need to resume. Formats 1–4 lack a recorded controller release. Use the original release in a separate installation with the same project and home, and stop the other daemon before transferring ownership. Retain a backup of the full run directory before any planned migration. Editing schema_version alone cannot establish compatibility. New installed daemon runs use format eighteen and record runtime_version and runtime_build from the installed release. Recovery, status, event inspection and append require that exact Titan release. Another release returns unsupported_run_runtime before changing saved bytes. A pin cannot be removed or changed in later records. Formats 1–4 remain readable without fabricated release metadata. Format eighteen pins the SHA-256 hash of the creating runtime bundle. A same-version replacement build cannot resume that run. Automatic recovery selects a retained release matching both version and hash. Missing matching releases preserve the original diagnostic and saved bytes. Source-only controllers retain the version-based formats. Automated migration and shared live self-development acceptance remain open.

The mixed graph has its own named offline answers in tests/mixed-graph.answers.yaml. Run titan run examples/mixed-graph.yaml --harness fake --fake-script tests/mixed-graph.answers.yaml --watch from the installed package directory, or use absolute paths. Unconfigured fake runs block with the missing task name. These supplied answers exercise execution and delivery without asserting travel facts or prices.

A validated worker result is retained in a phase_received event before native session cleanup and file checkpoint capture. This promotes the journal to format six and preserves its existing release and caller identity; legacy records do not gain an invented release pin. A pending capture cannot be marked completed or attached to a checker. After capture, phase_captured durably binds its candidate hash before phase completion. Restart can finish this sealed receipt only when the retained files, hash manifest and current live view still agree. It reuses the answer and usage without repeating worker execution, then runs fresh checks. A changed live view requires the native reconciliation generation described below. Script and split seals retain their existing refusal. Later live contents require fresh evidence and checks.

## Inspect retained knowledge

Use the selected project or home scope to inspect an entry and its retained versions:

```sh
titan kb show ENTRY_ID --scope project --limit 50 --json
titan kb show ENTRY_ID --scope project --before VERSION --limit 50 --json
titan kb stats --json
```

The show result includes current content and history.page. Historical entries descend from the exclusive before version. Omit before to start below the current version. Use next_before from the response for the next page; null means the oldest version was reached. Limits range from one through 200, with a default of 50 and an 8 MiB history budget. Future cursors fail. History reads leave usage counters unchanged. Statistics expose scope and per-kind oldest and newest dates. The dashboard offers the same historical content and earlier-version navigation through read-only inspection.

## Managed file observations

Native personas with Read can use titan_file_read and titan_file_list through their execution-bound tool service. Reads return base64 content, a content hash and file metadata version. Missing files have a retained absence observation. Lists return regular file paths recursively under the selected directory. They describe file names and preserve the existing protected-path exclusions. Workers with an active Write or Edit grant can use titan_file_write with a relative path, UTF-8 content and expected_version from titan_file_read. Use null for a missing file. The managed writer preserves the live inode, checks the active claim and refuses stale versions, runtime paths and writes outside the declared scope. Calls retain their audit result before returning. Scoped native shells grant bounded existing files. Use the managed writer for creation and replacement. Approved workflow scripts still require their separate operating-system write boundary.

The engine commits observations before the tool response is acknowledged. Dependencies outside worker write paths are checked before capture, later checks and publication. Checkers validate every managed observation. Replaced files with identical bytes still invalidate a file read. Changed, deleted and newly created dependencies retain the existing result for reconciliation. Distinct observations share the run's frozen workspace entry allowance. Read content has a one-MiB limit. Listings have a one-MiB JSON limit.

The first managed observation promotes its run to format seven. Worker receipts preserve that newer format and the existing runtime pin. Earlier formats remain readable. Older runtimes refuse the new format before modifying its journal. Arbitrary native and shell reads retain the complete-view consistency check. Managed read observations can expand cooperative read claims after releasing the earlier claim. Explicit reconciliation retains the earlier result and creates a separate checked generation. Approved worker requests can expand cooperative write scope through release and readmission. Physical enforcement of native and script writes remains pending.

## Received-result reconciliation

A native worker receipt can now resume through an explicit reconciliation generation. Titan retains the original phases and usage, captures a hash-bound current input and records reconciliation_started before dispatch. The original persona and backend receive the retained result and original task with a reconciliation instruction. Execution stays in the live project. Fresh candidate evidence and checks use a generation folder. Each generation spends the existing recovery allowance and preserves the quality attempt and refutation counts. Format nine fences older readers. Changed retained input blocks before dispatch. A sealed receipt first requires its retained candidate, journal hash and manifest to agree. Changed live files then require a fresh generation. Every retained input and sealed candidate is verified before dispatch and acceptance. Refutation restores the current generation input within its declared write scope, preserving the intervening external edit. Private knowledge proposals use separate generation identities. Only the checked generation can publish. Completed native workers also reconcile changed dependencies before acceptance, retaining their original sealed result and requiring fresh checks. Script and split receipts retain their separate reconciliation work.

## Step script proofs

Add a script entry to a step's verify list when an executable check provides the acceptance decision. The script runs in the step's working directory through the scoped approval service. Its first candidate runs the check twice. Later candidates run it once. Each execution waits for approval of its exact command, directory, phase and attempt. Use the request commands above to approve or deny it.

```yaml
verify:
  - kind: script
    run: node scripts/check-result.mjs
    deterministic: true
    timeout_s: 30
```

A nonzero exit or inconsistent pair of answers refutes that candidate and sends its evidence to the next builder attempt. Falsifier agents run after the proof succeeds. Completed commands and combined answers survive engine replacement. The dashboard counts combined proof answers. A process interruption blocks for recovery without recording a quality verdict.

The run folder contains proofs.json with each executed script check's identity, candidate and result hashes, command hash, answer, elapsed time and full output path. Each first-candidate entry retains both command captures. New runs retain exact stdout and stderr bytes in separate, hash-verified capture files. Run checkpoints hold bounded references to these files. Earlier text and base64 captures remain readable during recovery. The report separates checks on kept results from discarded attempts. Earlier answers without complete report metadata expose incomplete history. New result documents show proven N of M for kept results. GET /runs/RUN_ID returns those same totals in proofs. Artifact inspection verifies the report against the journal's committed hash and validates each retained output file against its recorded hash.

Goal-level script verification, Lean execution, SMT execution and proof recheck remain pending. The full proof acceptance tasks remain open.

## Maintain retained knowledge

Use titan kb prune to report exact duplicates, replaced versions and entries never read for ninety days. Use --before with a UTC date and time to choose the age cutoff. Add --apply to archive selected entries with their full text. Use titan kb consolidate to inspect duplicate groups and --apply to join them while retaining source ids, tags and archived text. Use titan kb restore ID to return an archived entry at the next version. These commands use the project hub by default. Add --scope home for the home hub. Canonical personas continue through their human-approved lifecycle. Each publication uses the existing bounded, recoverable knowledge journal.

Prune reports earlier versions already kept in history. Applying a plan preserves every archived source. Exact duplicate grouping compares the entry kind and complete body text. Consolidation keeps the source ids in the new body and combines their tags. Restore refuses an active identity collision and retains earlier versions for later inspection. Atomic consolidation is bounded by the configured publication entry and byte allowances.
