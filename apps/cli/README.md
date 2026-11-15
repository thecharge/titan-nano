# @titan/cli

## Responsibilities

Owns command discovery, argument validation, command handlers and process output. The catalog declares accepted arguments; parsing finishes before client or filesystem work begins.

Knowledge handlers use a separate typed knowledge-client port and bounded file loader. kb add FILE imports Markdown or persona YAML; kb get ID reads one final entry. kb update ID FILE and kb delete ID require --entry-version N from the last read. Imported update identity and version must match the selected entry. There is no implicit refresh or overwrite. kb search QUESTION accepts --kind, --mode and --limit; a kind can replace the question. kb reindex rebuilds projections. The project hub is the folder .titan/knowledge in the --project folder, and the home hub is the one in --home. kb get, kb search, kb update and kb delete read both hubs and name the scope of each entry; update and delete change the hub that holds the entry. kb add FILE writes to the project hub unless --scope home is given. kb promote ID copies a project entry to the home hub, keeps the project entry and refuses an id that the home hub already has. kb list reads both hubs and accepts --kind, --scope, --tag, --state and --limit. kb stats prints, for each scope and kind, the entries, the bytes, the oldest and newest entry and the entries never read, and says whether meaning search is ready. kb show ID prints an entry with its history and its links. The dashboard page at #/knowledge shows the same lists and counts, read-only. All take --home and --json; the home hub needs the daemon. Input conflicts exit 2; malformed server replies exit 4. Persona deletion remains refused pending human approval.

## Public contract

The `titan` executable enters `src/main.ts`. `createCli` accepts service ports for HTTP clients, output, lifecycle and waiting. Invalid inputs become typed errors; watched runs return the terminal run exit code. No other package should import CLI implementation files.

## Verification

Run `bun run test testing/unit/cli-contracts.test.ts testing/integration/cli.test.ts`. These checks exercise argument rejection, lifecycle output and a separate CLI process against offline stubs.

## Updates

The managed `titan update` command selects a tagged source release or a local archive through `--from`. `--check` performs read-only discovery. Installation holds kernel-owned installation and home leases, drains an idle daemon and verifies a whole-home and project metadata backup. It installs beside earlier releases, validates the staged version and doctor, then switches the stable launcher. Retained transactions block daemon startup until recovery verifies their backup and restores the earlier launcher. `doctor --backup PATH` validates copied journals against their original paths and creating runtime.

Home-owned update.mode accepts notify, auto and off. Notify is the default behavior. Automatic installation uses idle-only shutdown and passes the original command to the selected launcher. Failed installation preserves ordinary command execution. Failed handoff reports its error. Known journal formats remain readable without rewriting their original data. Cross-version pinned-run recovery and full installed update acceptance remain pending.

## Limits

Only Codex and Claude Code are in the first delivery scope. The command catalog includes explicitly pending commands. Packaging, live adapter acceptance and complete standards verification remain open.

Request commands use a separate injected request-client port. `requests show RUN_ID REQUEST_ID` reads one exact record. `answer RUN_ID REQUEST_ID approve|deny` uses the agent credential. `approve RUN_ID REQUEST_ID` and `deny RUN_ID REQUEST_ID REASON` explicitly use the person credential. Answers require `--request-version` and `--client-id`; answer and approve also require `--reason`. Selectors and options fail before client creation. A stale or repeated answer exits 2; repeated answers name the already answered request. There is no most-recent-run inference, implicit version refresh or automatic person-token fallback. Escalation remains pending.

Request listing returns a versioned page with query, requests, unavailable, next_cursor and has_more. Use --run-id, --client-id, --harness-session-id, --project-path and --state waiting|answered as intersecting filters. Project paths must be absolute and normalized. The default count is 20, the maximum is 100, each page is limited to 1 MiB and each call reads at most 16 runs. Continue with --cursor using next_cursor and the same filters; the count may change. A filtered page may be empty while has_more is true. Follow its cursor. Unreadable runs retain their indexed identity in unavailable. Cursors survive catalog restart and exclude newer submissions from older pages. Answers may change between pages; this is not a frozen snapshot. Origin filters support navigation and do not authorize access. HTTP GET /requests and MCP titan_requests accept the same selection. Per-run journal prefix replay remains in use.

Pass a pending main-level request to the person with `titan answer RUN_ID REQUEST_ID --to-person --request-version N --client-id CLIENT --reason Reason`. Omit the decision argument. Inspect the returned human-level pending version before an explicit person approve or deny command. Scope and origin remain unchanged. Missing companion options, combined decision and escalation, stale versions and repeated escalation fail without replacing the request. The matching MCP tool is titan_request_escalate; native session continuation remains unfinished.

Use titan usage RUN_ID --home HOME --json for committed usage across every quality attempt and recovery segment. A successful read exits zero regardless of the run outcome. Unknown native measures remain incomplete; the command requires an exact run and refuses watch, backend overrides and extra selectors.

## Submission receipts

Run saves caller and submission ids in the private submissions.db ledger under --home before contacting the daemon. Generated ids are unique to that intended start. Supply --submission-id to retry a saved intent. Its unique retained caller is reused when --client-id is omitted. Supply both ids when several callers used that submission id. Source bytes, workflow, project, backend and effective settings must match the saved digest. A deliberate repeat needs a new submission id.

A lost submission response exits four with code submission_uncertain. JSON includes error.recovery.client_id, error.recovery.submission_id and error.recovery.receipt_path. Retry the same workflow, home and settings using those ids. A transport failure while observing an already accepted run follows the normal observation contract.

The home config may set client.max_submission_receipts from one through 10000, with a default of 10000. Lower settings layers reject this section. A full ledger accepts existing identical retries and refuses new identities. Receipts remain retained. Keep the ledger with the selected home when recovering interrupted submissions. The ledger contains ids and a digest, without workflow or credential contents.

## Machine output

The default renderer emits one versioned envelope for ordinary --json commands. Data retains the command payload. Operation, nullable identifiers and state describe its context. Error contains code, message, paths, retryable and nullable recovery. Run output and finite event queries retain a bounded ordered events page, next_cursor, has_more and truncated. Blocked watches exit three with resume recovery. Observation uncertainty exits four, retaining a known run id and status recovery. Submission uncertainty retains the saved receipt identity in error.recovery. An injected output port receives semantic values and typed operation/page context.

Events accepts --follow with optional --format jsonl. It drains bounded pages before polling and rejects --json while following. JSON lines include a version, run id and durable event id. Ctrl-C stops only the observer. Serve readiness and native/MCP protocol framing keep their contracts.

## Frozen configuration

`titan config show --run-id RUN_ID --home HOME --sources --json` reads the exact run's committed settings, source map, configuration hash, workflow revision and journal position. Omitting `--sources` omits the source map. A missing run fails without selecting a neighboring run. Setting and backend overrides are refused before client creation. File edits and daemon restart preserve the saved report. Current owner ceilings and revision history remain pending.

`config show --scope user --home HOME --sources --json` inspects owner settings offline. `config show --scope project --home HOME --project PROJECT --sources --json` inspects project settings with inherited owner policy. Reports include the scope, absolute file path, nullable byte version and effective configuration hash. Missing optional files remain absent. Omitting `--sources` omits the source map. An exact run selector cannot be combined with scope or project selectors.
