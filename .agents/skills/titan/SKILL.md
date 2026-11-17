---
name: titan
description: Plan, run and recover local Titan workflows with independent falsification for Codex or Claude Code.
---

# Operate Titan workflows

The person gives you a problem in plain words. The person does not write personas or the workflow file. You design them and take these steps in this order:

1. `titan lessons` reads lessons from earlier runs.
2. `titan plans` reads saved plans.
3. `titan kb search` looks for facts in the knowledge hub.
4. `titan check` validates the workflow file you wrote.
5. `titan run` runs the checked workflow.
6. `titan requests` lists what the agents ask for.
7. `titan answer` answers one request.
8. `titan resume` continues a run after the answers.

Run `titan plans KIND` before you write a workflow file to read the three saved plans of that kind with the highest rewards. Run `titan lessons WORDS` to find lessons relevant to the task.

Titan is an experimental local engine for Codex and Claude Code. Use this skill when the person asks you to plan, run or recover a Titan workflow. Other backends, approved application of results and external operations are pending.

Follow these working rules:

Run only on a backend the person named.
Search both hubs first.
Check `titan requests`.
Resume after a limit.
Read the cost and the cache share in `titan status` before a large batch.
Let runs write to the project.
List hand changes in the commit.

Use the installed `titan` executable. In a source checkout use `bun run titan` instead. Read `titan schema workflow` before writing YAML and `titan schema config` before changing settings. Run `titan doctor --project PROJECT --home HOME` to inspect prerequisites; its report does not prove live authentication.

Use `titan runs --scope project --project PROJECT --state running --home HOME` to find project work, `titan runs --scope known-home` to inspect registered homes and `titan status RUN_ID --compact --home HOME` for a bounded step, request and usage summary. Full status remains available. Unavailable homes retain their own diagnostic in the listing.

Run `titan skill list --project PROJECT` to discover repository and user skills with their origins. Project skills take precedence. Add required names to a persona's skills array. Titan retains their instructions and supported references at admission. Both native backends receive the retained instructions and can read references through titan_file_read at paths such as @titan-skills/review/references/checklist.md. Recovery uses the retained version. Links escaping the skill directory are refused.

Use `titan persona create reviewer.yaml --tool Read`, edit its instructions, then `titan kb add reviewer.yaml --scope project --project PROJECT --home HOME`. Inspect `titan persona list --scope project --project PROJECT --home HOME` before selecting a registered version. `titan workflow create workflow.yaml --template parallel --reviewer project:reviewer@1 --verify 'git diff --check' --project PROJECT --home HOME` creates parallel tasks followed by an independently reviewed script step. Edit the generated tasks and goal before checking. Creation preserves existing destinations. Scoped persona versions remain bound through admission, history and usage.

Use `titan config init --scope project --home HOME --project PROJECT --json` to create a settings file. Inspect its byte version with `titan config validate --scope project --home HOME --project PROJECT --json`, then pass it to `titan config set limits.max_parallel 2 --scope project --expected-version VERSION --home HOME --project PROJECT --json`. Use `titan config show --scope project --home HOME --project PROJECT --sources --json` to inspect current values, sources and file version offline. Select user scope for home-owner settings. After a conflict inspect again before combining edits. Successful writes replace file comments and formatting with JSON. Settings changes apply to new runs. Use `titan config show --run-id RUN_ID --home HOME --sources --json` to inspect committed settings and sources. File edits and daemon restart preserve them. Omitting `--sources` omits the source map. Current owner ceilings and revision history remain pending.

Run and control commands connect to the selected home and start an authenticated background server when needed. Keep the same home for all commands controlling that engine. Use `titan serve --home HOME` for foreground startup diagnostics. Live workers, script checks and falsifiers run in the shared project directory by default. Their writes reach that project immediately. Candidate directories retain evidence; they are not private execution workspaces. Explicit isolated mode remains a compatibility option. Claims coordinate cooperating runs. Managed reads and approved write-scope requests release the earlier claim and negotiate the combined scope. Independent scopes continue while an overlapping claim waits. Protected native process writes remain incomplete. Read project development instructions and put acceptance criteria and required checks into the worker and independent checker tasks. Give the checker concrete ways to disprove the result.

For a small code or document task, adapt this valid starting workflow. The worker must implement the person's actual request and the checker must examine delivered files. Keep independent work in parallel and put joins after their prerequisites.

Do not split work that cannot be split; steps that need the one before them, or that change the same file, run in a sequence with one agent at a time. Use parallel groups and `split` only for independent parts. Live steps share the same file tree. Overlapping write claims yield while independent scopes and overlapping readers can continue. A file list is cooperative intent, not enforced write permission. A delayed check currently validates the complete captured project view because arbitrary native reads are not observed. Changed readable files invalidate its evidence. Do not add agents to a kind of goal that one agent already passes in most runs; check this with `titan plans KIND`. Research shows that more agents made sequential tasks worse.

```yaml
name: Deliver a reviewed change
goal: Produce a reviewable change with independent counterexamples
limits:
  max_parallel: 2
approvals:
  tool: human
personas:
  worker:
    description: Implement the requested change
    role: Follow project instructions and deliver files with verification evidence
    tools: [Read, Glob, Grep, Write, Edit]
  checker:
    description: Try to disprove the result
    role: Inspect candidate files against acceptance criteria and report concrete defects
    tools: [Read, Glob, Grep]
steps:
  - id: implement
    do:
      persona: worker
      task: Implement the requested change in the shared live project
    falsify:
      - persona: checker
        task: Find counterexamples to the requested behavior and inspect the delivered files
```

Check and submit using explicit project, home and backend selectors. Choose `claude-sdk` instead of `codex-sdk` for Claude Code. For mixed backends set backend on each persona. Keep a stable client and submission identifier when retrying an uncertain submission; a new submission identifier creates a new run.

```sh
titan check workflow.yaml --project PROJECT --home HOME
titan run workflow.yaml --project PROJECT --home HOME --backend codex-sdk --client-id CLIENT --submission-id SUBMISSION --watch
titan runs --home HOME --client-id CLIENT --limit 20
titan status RUN_ID --home HOME
titan events RUN_ID --home HOME --after 0 --limit 100
titan usage RUN_ID --home HOME --json
titan requests --home HOME --harness-session-id SESSION --state waiting --limit 20
titan requests show RUN_ID REQUEST_ID --home HOME
titan answer RUN_ID REQUEST_ID approve --request-version 1 --client-id CLIENT --reason Reviewed --home HOME
titan artifacts RUN_ID --home HOME
titan resume RUN_ID --home HOME --watch
titan pause RUN_ID --home HOME
titan cancel RUN_ID --home HOME
titan kb search --kind lesson --mode words --home HOME
titan kb search --kind persona --all --mode words --home HOME
```

Use titan kb add FILE to publish a final knowledge entry and titan kb get ID to inspect it. Updates and deletions require --entry-version with the version actually read. Use titan kb reindex to rebuild projections from the entry files. Keep the same --home as the daemon. Word search works offline. Meaning search uses the installed embedding model and reports an unavailable model explicitly. The main agent's titan_kb MCP tools expose final-entry operations. Native workers receive execution-bound private knowledge reads, search, add, update and delete. Their proposals follow candidate acceptance. Native checkers receive committed reads and search. Readiness checks verify the role's exact tool inventory before task delivery. Deleting a canonical persona version requires a human-approved delete_persona request. Titan archives the approved version and retains its history for existing runs. Later registration creates a new version.

Use titan kb prune to report exact duplicates, replaced versions and entries never read for ninety days. Use --before with a UTC date and time to choose the age cutoff. Add --apply to archive selected entries with their full text. Use titan kb consolidate to inspect duplicate groups and --apply to join them while retaining source ids, tags and archived text. Use titan kb restore ID to return an archived entry at the next version. These commands use the project hub by default. Add --scope home for the home hub. Canonical personas continue through their human-approved lifecycle. Each publication uses the existing bounded, recoverable knowledge journal.

Native personas with Read can use titan_file_read and titan_file_list. File reads return base64 content and its observed version. File lists return regular file paths recursively under the selected directory. Titan commits these observations before returning them. Changed dependencies outside worker write paths invalidate acceptance. Checkers validate every managed observation. Distinct observations share the frozen workspace entry allowance. Read content has a one-MiB limit. Listings have a one-MiB JSON limit. These records survive restart in run format seven. After a turn closes, dependencies beyond the current claim become durable read intent in format eight. Titan releases the earlier claim and queues the combined read and write scope. Waiting retains completed work and spends no vendor execution or quality attempt. Cancellation withdraws the queued scope. Read dependencies grant read access. Declared write permissions remain separately bound to execution. Arbitrary shell reads still require the complete-view consistency check. Received native results can resume through an explicit reconciliation turn using the same persona and backend. A sealed result first requires its retained candidate and manifest to match the journal hash. Format nine retains the original result and usage plus hash-bound current input. Fresh evidence and checks use a generation folder while execution keeps the shared project directory. Generations spend the existing recovery allowance. Retained input and sealed evidence are verified before dispatch and acceptance. Refutation restores the current generation input within its write scope. Private knowledge proposals belong to separate generations and only checked proposals publish. Completed native workers also reconcile changed dependencies before acceptance, retaining their sealed result and requiring fresh checks. A step may declare reconcile with a persona and task to select its recovery action. Script steps and split aggregates require that action to reconcile a received result. Titan preserves the original command output or split aggregate for downstream inputs, keeps the recovery answer separately and never repeats the command or received parts. The reconciliation persona must be independent of every falsifier, and its tools contribute to the reserved file access. Workers can request file_write resource approval for an additional relative path. Titan releases the earlier claim, negotiates the combined scope and captures the newly admitted rollback input before continuation. Protected process writes remain pending.

Codex turns skip native home and project config.toml through --ignore-user-config. Set models and runtime policy in Titan configuration and personas. Native authentication and session storage still use the existing Codex home. The private preview embeds the pinned SDK launch-option patch and installs its exact native CLI dependency. Synthetic offline probes check inherited MCP startup and file-based authentication. Complete persona tool enforcement and real vendor transcript recovery remain pending.

Use repeated --set SECTION.KEY=VALUE on check, config or run to override registered defaults, limits and recovery settings. Values use JSON numbers, null or plain enum text. For example, --set limits.max_parallel=2 --set recovery.max_retries=0. The shared schemas validate each value and the combined effective settings. Server settings remain home-only. Duplicate keys and collisions with --backend or --max-parallel fail before submission. Use titan config --set limits.max_parallel=2 --json to inspect values and sources before running.

Approval levels are part of the resolved configuration under approvals. The home owner may lower configurable kinds in HOME/config.yaml. Project files, selected configuration files, workflow approvals and --set approvals.KIND=LEVEL may keep or raise the inherited level; they cannot lower it. Levels are auto, main and human. Persona deletion, external actions, limit increases and paid compute always require human authority. Inspect titan config and the generated schema for the effective values and their sources. Each run freezes its policy and hash at submission; changing home settings does not reinterpret existing requests. Older run snapshots without an approvals field keep the original built-in policy and their original hashes. An auto level does not implement execution or an automatic decision rule by itself.

You may add --harness-session-id SESSION to run. HTTP submissions and MCP titan_run use harness_session_id. Supply one through 128 characters; Titan keeps the exact opaque label in the run header and available summaries. Retrying the same submission must keep this label; a changed label conflicts. New daemon runs use format eleven and retain the installed Titan release throughout waiting and recovery. Format four remains readable for older labelled runs. This caller label is separate from native worker and checker session ids. Request origin filters select those request origins, not the outer caller label. The label grants no authority. The CLI saves durable submission receipts before posting. Indexed caller-session filtering remains pending.

Run listing returns a versioned page with runs, before, next_before and has_more. Each row retains its submitting client_id, including an unreadable run. Filter with --client-id, --harness-session-id and --project-path; supplied filters intersect. Session labels are opaque and project paths must be absolute and normalized. Use --before with next_before to continue toward older submissions. The default count is 50 and the maximum is 200. New submissions appear on a fresh first page without changing older cursors. HTTP GET /runs and MCP titan_runs accept the same selectors. Session or project selection returns page version two and inspects at most limit catalog rows. A filtered page may have no matches while has_more is true; follow next_before until has_more is false. Ordinary listing retains version one. Missing metadata cannot match a session or project filter; unfiltered listing retains unreadable-run diagnostics. These filters grant no authority.

Request capacity is configured as requests.max_per_run. It defaults to 256 and accepts integers from 1 to 256. The home owner may lower it; project, selected-file, workflow and CLI layers may keep or lower the inherited allowance. Use --set requests.max_per_run=12 on check, config or run. Every new run freezes the value and its hash. Later file edits do not enlarge that run. All records count, including answered requests. Creation retries still return an existing record at capacity; refusal of a new request preserves the journal cursor. Legacy snapshots without requests retain their shape, hash and original 256 allowance. The ledger also keeps its fixed safety ceiling. The home-owner server.max_pending_request_operations setting separately controls outstanding request mutations.

Home-owner server.max_resident_runs separately bounds resident runs from one through 1024, with a default of 1024. Active runs keep their slots; inactive runs may be evicted and reloaded. A refused creation may already have a recorded run. Release capacity, retry the same submission, then explicitly resume its blocked run. This budget does not limit the durable catalog.

Home-owner server.max_pending_request_operations controls outstanding request mutations across runs. It defaults to 256 and accepts integers from 1 to 256, using the ledger’s central schema. The count includes active and queued mutations. Server startup validates it before admitting work and passes it to the shared engine ledger. A full queue refuses a new mutation without changing its request or journal cursor. Releasing the active operation admits an explicit retry. Project, selected-file, workflow and CLI overrides cannot change this owner setting. Restart applies a changed home allowance; individual frozen run settings do not replace that process budget. Legacy snapshots without the optional field keep their original shape and hash.

Request listing returns a versioned page with query, requests, unavailable, next_cursor and has_more. Use --run-id, --client-id, --harness-session-id, --project-path and --state waiting|answered as intersecting filters. Project paths must be absolute and normalized. The default count is 20, the maximum is 100, each page is limited to 1 MiB and each call reads at most 16 runs. Continue with --cursor using next_cursor and the same filters; the count may change. A filtered page may be empty while has_more is true. Follow its cursor. Unreadable runs retain their indexed identity in unavailable. Cursors survive catalog restart and exclude newer submissions from older pages. Answers may change between pages; this is not a frozen snapshot. Origin filters support navigation and do not authorize access. HTTP GET /requests and MCP titan_requests accept the same selection. Per-run journal prefix replay remains in use.

A persona may set request_turns: true to use structured permission waiting. It must return an object with result and requests. Completed work has its normal result and an empty requests array. Waiting has a null result and one or more descriptions containing kind, scope and expires_at. Titan assigns ids and binds them to the asking execution and native session. Independent steps continue while that phase waits. Inspect and answer every request, then explicitly resume RUN_ID. Both approval and denial reach only the asking session without spending operational recovery allowance or a quality attempt. An unanswered resume starts no native turn. A decision does not grant tools or execute an operation. Older request-turn runs use format three. New daemon runs keep format eleven and their recorded Titan release. Each run also exposes requests.json with its pending requests and the journal cursor used for publication. It is an inspection file; use the normal decision commands. Loading rebuilds it from the journal. If publication fails, repair the filesystem problem and reload before retrying, since the request or decision may already be durable. Native persona MCP registration and live vendor transcript acceptance remain unfinished.

For automatic persona help, return an ask request with scope.operation set to ask and scope.resource set to a declared persona alias or frozen version reference. Put the question in scope.arguments. At automatic approval Titan invokes that persona in the shared project with its own session, backend and permissions, retains its answer and continues the asking session. Raised approval and unknown targets wait for an external answer. A retained completed helper result survives restart. Helper calls share the normal concurrency and request allowances. titan persona show NAME --json reports asked and asked_history_complete for each version.

Approved new_persona, improve_persona and merge_personas requests can receive a definition file through --persona FILE on answer or approve. Inspect the request first. The file contains name and definition, with the normal persona fields inside definition. Titan validates and freezes the definition before recording approval, publishes a new Trial version and retains its decision receipt for recovery. Retirement preserves version history. Human-approved canonical deletion moves the version into its archive. Meaning comparison can offer a merge of similar Trial or Proven role definitions when the local model is ready. Inspect each offer before deciding.

Step script proofs run before falsifier agents. Add verify entries with kind script, run COMMAND and deterministic true. The first candidate runs its command twice and inconsistent answers are not proven. Later candidates run once. Each physical invocation needs the scoped script approval. Failed proofs feed their output to the next worker attempt. New proof runs retain proofs.json, complete checker output hashes, kept proof totals and discarded attempt totals. Read its path through titan artifacts. Artifact inspection verifies the report and checker output against committed hashes. Top-level verify entries run script checks against the final files after all steps pass. Each goal command runs twice with scoped approval, retains completed invocations across restart, and contributes to the final proof counts. A failed goal check fails the run and prevents successful artifact delivery. Live file changes during final checking block publication and preserve current files. Integrated Lean and SMT execution remain pending.

Human watched commands print durable event lines while work continues, then the settled snapshot and any result path. Each line contains its id, type and compact JSON data. Event data newlines stay escaped. The observer follows bounded cursor pages and drains the terminal tail. JSON suppresses progress lines. Ordinary JSON uses a versioned envelope. Read its data payload and nullable structured error. Run output includes a bounded events page, next_cursor, has_more and truncated. Blocked watches exit three with resume recovery. Transport uncertainty exits four and retains a known run id for status, or saved submission ids and receipt path in error.recovery. Events RUN_ID --follow --format jsonl emits one versioned event line at a time. It rejects --json while following. Ctrl-C ends observation while daemon work continues.

Event inspection returns schema_version, run_id, after, events, next_cursor and has_more. The client binds run identity, starting cursor and requested count and refuses gaps, duplicates and inconsistent continuation. Follow next_cursor with --after until has_more is false; each page is limited by count and bytes. A future cursor fails explicitly.

Usage inspection returns committed history totals for the exact run through its reported journal cursor. Read known input_tokens, output_tokens and cost_usd together with their complete flags. A zero subtotal with complete false is unknown, not free work. Executions count physical invocations across every quality attempt and operational continuation. Reported executions supplied a final usage record; unreported executions did not. An interrupted turn can therefore leave all measures incomplete. Native partial-stream usage is not yet normalized into those records. Repeating inspection and reloading preserve totals without starting agents. HTTP GET /runs/RUN_ID/usage and MCP titan_usage expose the same report. History is scanned with bounded phase cursors; report indexing and dashboard presentation remain pending.

Claude usage records are cumulative within a native session. Titan retains raw records and adds only increases in each measure within a phase and quality attempt. Codex records remain additive per turn. Backend selection uses the frozen persona, configuration default and run fallback in that order. New quality attempts retain their independent totals. An observed counter drop keeps the highest known subtotal and makes only that measure incomplete; a later report cannot restore completeness after a missing value. Interrupted starts remain unreported even when a later cumulative result includes their usage. Native USD cost is an SDK estimate, not a billing receipt. Hidden counter resets without an observed drop cannot be reconstructed from these records.

Claude system/api_retry events now enter Titan recovery when their fields are valid and their cause matches their HTTP status: rate_limit with 429, or overloaded/server_error with a server-error status. Native delay is retained alongside the configured backoff; values above 2,147,483,647 milliseconds are refused before scheduling. The frozen recovery.max_retries allowance limits physical continuations. The same phase, native session, files and quality attempt remain in use; completed peers stay complete. Unknown causes, billing errors, contradictory statuses and malformed delays block without automatic retry or a quality refutation. Ordinary rate_limit_event notices do not replace a successful final result. Native retries without final usage records remain explicit unreported starts. Codex errors still lack a verified structured classification and block for diagnosis and explicit resume.

An unsupported_run_format or unsupported_run_runtime response means the saved journal requires a compatible release. Keep its journal and incomplete tail intact. Use the installed release that created the run and read Run format recovery in docs/preview.md. Formats 1–4 lack a recorded controller release, so retain the original installed archive alongside runs that need recovery.

Stopped executions in backoff now release physical agent capacity and the per-run node slot. Independent ready branches can advance even with limits.max_parallel set to one. Their phases retain the native session, files, retry date, spent allowance and quality attempt. The run reports recovering while only retry waits remain, and running while another node executes. Pause, cancellation, reload and resume retain that checkpoint; cancellation and the hard deadline remain terminal. A retry starts only after its recorded date. No dashboard or live vendor transcript acceptance is implied.

Repeated resume while an answered request continues shares its active execution. It preserves the current origin and completed peers. A held native execution appears unreported until its final usage arrives; duplicate controls do not add physical starts. Unanswered requests still wait without a native turn. Explicit resume after answering is required.

Each complete task prompt and each complete host frame has an independent 1 MiB expanded JSON allowance. Host frames also include role text, output schema and launch metadata. Excessive setup data blocks before a native session or execution starts. Read the diagnostic and reduce the excessive data before resuming; unchanged excessive data stays blocked after reload.

Use the exact returned run ID. Several runs and harness clients may share one engine. An operational interruption blocks or retries the same logical attempt; it must not become a quality refutation. Read status and events before resuming. Resume the existing run after restoring its prerequisites; missing native sessions must not silently start over. Retry allowance, deadlines and owner limits still apply. A blocked state needs a diagnosis, not a fresh run that loses completed work.

If Titan MCP tools are already connected, use their advertised schemas. Use `titan_requests` to list scoped requests with the same filters and cursors as the CLI. `titan_run` submits work; use `titan_request_open`, `titan_request_read` and `titan_request_answer` for explicit scoped requests. Use `titan_request_escalate` with exact ids, observed version, client and reason to pass a pending main request to the person. It remains waiting at human authority. Opening returns a strict state/request document with state waiting until a decision exists; creation retries retain an existing answer. Answering always uses the agent credential and requires the observed version, client and reason. These tools record decisions. Explicitly resume a structured waiting run after all of its asking phase requests are answered. Installation for Claude Code writes a plug-in folder that starts `titan mcp`. Installation for Codex writes a project skill and registers `titan mcp` with `codex mcp add`. Installation for Antigravity writes the same plug-in folder and runs `agy plugin import` on it. An existing file is kept unless `--force` is given. Use the tools of `titan mcp` when they are present, and the `titan` commands otherwise.

Use artifacts to verify the kept delivery against its journal, manifest and result. It returns file identifiers, paths, hashes, sizes, executable flags and workflow identity. Use `titan artifacts list RUN_ID --json`, then `titan artifacts show RUN_ID ARTIFACT_ID --offset 0 --limit 65536 --json` with a returned file identifier. File pages contain exact base64 bytes, next_offset and has_more; continue by byte offset until has_more is false. The HTTP artifact file route and MCP `titan_artifact` expose the same bounded reads. Export a selected kept file with `titan artifacts export RUN_ID ARTIFACT_ID --output /absolute/new-review-directory --json`. The parent must already exist without links; the new destination must not exist or lie inside run storage. The file is streamed into files/ under its original relative path and artifact.json records its verified hash, mode and workflow commitment. Existing destinations are preserved and ordinary copy failures remove the incomplete export. The local client and daemon must share the kept filesystem. A host crash can leave an incomplete directory without a valid manifest; inspect it before choosing another destination. Export copies files for review and does not approve application or perform an external operation. Read result.md and artifacts.json from the returned paths as well. A changed or unfinished delivery must fail inspection. Report the run ID, exact result paths, checks performed, observed failures and remaining limits. A survived verdict is the checker's finding, not proof. Review the diff and apply files only within the person's authorized task. Do not commit, push or perform external actions unless authorized for that task.

Inspect one exact permission request with titan requests show RUN_ID REQUEST_ID. An agent can answer a main-level request with titan answer RUN_ID REQUEST_ID approve (or deny), supplying --request-version with the version actually inspected, --client-id and --reason. Do not fetch a new version merely to override a conflict. Human-level requests require the person credential through titan approve RUN_ID REQUEST_ID --request-version 1 --client-id CLIENT --reason Reviewed, or titan deny RUN_ID REQUEST_ID Reason --request-version 1 --client-id CLIENT. These commands read the private person-token file; same-user agents can read that file too, so token possession does not prove human presence. Agents must not use a person command to bypass the person's decision. Stale or repeated answers fail with exit code 2. To pass a pending main request to the person, use titan answer RUN_ID REQUEST_ID --to-person --request-version N --client-id CLIENT --reason Reason without an approve or deny argument. Inspect the returned waiting request and its next version. Scope and origin stay unchanged, and a passed_up event records the actor, reason and time. The person must use that new version when approving or denying; a new request normally advances from 1 to 2 on escalation and to 3 on the person decision. Repeated escalation and stale versions fail without overwriting the pending request. MCP request tools use the same ledger and cannot grant human authority. A recorded permission alone does not execute an operation or resume a waiting agent.

Script workers, script falsifiers and step checks run through scoped action approval. Inspect the action request, including its command, working directory, phase and configuration hash. An unanswered request waits without starting a process. The server resumes a script-waiting run after approval and revalidates its execution claim before launching the command. A changed command requires its own approval. Script actions and falsifiers default to five minutes and accept timeout_s up to one hour. Approved checks and proofs may update their declared output scope. Titan retains each changed candidate and its parent hash alongside the command receipt. Recovery verifies the chain, preserves the worker snapshot and blocks on changed evidence or a pending capture. Independent falsifiers inspect the resulting candidate. Generated caches are omitted from ordinary snapshots unless explicitly included in the step scope.

Claude supports Read, Glob, Grep, Write, Edit and writable-phase Bash when the persona lists them. Both permission callbacks check tool admission and paths. Write and Edit use the declared live file scope. Bash has command-text checks with incomplete filesystem enforcement. Codex uses its native workspace sandbox with network disabled. Complete per-tool Codex enforcement, native write fencing and live transcript recovery remain pending. Routine product tests use versioned vendor stubs. External operations still require their implemented approval and execution path.

## Workflow file format

This JSON schema is the same text that `titan schema` prints.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1
    },
    "goal": {
      "type": "string",
      "minLength": 1
    },
    "workflow_id": {
      "type": "string",
      "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$"
    },
    "harness": {
      "type": "string",
      "enum": [
        "claude",
        "codex",
        "antigravity",
        "auto"
      ]
    },
    "personas": {
      "type": "object",
      "propertyNames": {
        "anyOf": [
          {
            "type": "string",
            "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$"
          },
          {
            "type": "string",
            "pattern": "^(?:project:)?[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}@[0-9]+$"
          }
        ]
      },
      "additionalProperties": {
        "anyOf": [
          {
            "type": "object",
            "properties": {
              "request_turns": {
                "type": "boolean"
              },
              "description": {
                "type": "string",
                "minLength": 1
              },
              "role": {
                "type": "string",
                "minLength": 1
              },
              "tags": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "backend": {
                "type": "string",
                "enum": [
                  "codex-sdk",
                  "claude-sdk",
                  "fake"
                ]
              },
              "model": {
                "type": "string"
              },
              "tools": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "Read",
                    "Glob",
                    "Grep",
                    "Write",
                    "Edit",
                    "Bash"
                  ]
                }
              },
              "skills": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "tool_servers": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "inputs": {
                "type": "object",
                "propertyNames": {
                  "type": "string"
                },
                "additionalProperties": {
                  "type": "object",
                  "propertyNames": {
                    "type": "string"
                  },
                  "additionalProperties": {}
                }
              },
              "outputs": {
                "type": "object",
                "propertyNames": {
                  "type": "string"
                },
                "additionalProperties": {
                  "type": "object",
                  "propertyNames": {
                    "type": "string"
                  },
                  "additionalProperties": {}
                }
              }
            },
            "required": [
              "description",
              "role"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "use": {
                "type": "string",
                "pattern": "^(?:project:)?[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}@[0-9]+$"
              },
              "backend": {
                "type": "string",
                "enum": [
                  "codex-sdk",
                  "claude-sdk",
                  "fake"
                ]
              }
            },
            "required": [
              "use"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "mutates": {
                "type": "string",
                "pattern": "^(?:project:)?[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}@[0-9]+$"
              },
              "request_turns": {
                "type": "boolean"
              },
              "description": {
                "type": "string",
                "minLength": 1
              },
              "role": {
                "type": "string",
                "minLength": 1
              },
              "tags": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "backend": {
                "type": "string",
                "enum": [
                  "codex-sdk",
                  "claude-sdk",
                  "fake"
                ]
              },
              "model": {
                "type": "string"
              },
              "tools": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "Read",
                    "Glob",
                    "Grep",
                    "Write",
                    "Edit",
                    "Bash"
                  ]
                }
              },
              "skills": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "tool_servers": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "inputs": {
                "type": "object",
                "propertyNames": {
                  "type": "string"
                },
                "additionalProperties": {
                  "type": "object",
                  "propertyNames": {
                    "type": "string"
                  },
                  "additionalProperties": {}
                }
              },
              "outputs": {
                "type": "object",
                "propertyNames": {
                  "type": "string"
                },
                "additionalProperties": {
                  "type": "object",
                  "propertyNames": {
                    "type": "string"
                  },
                  "additionalProperties": {}
                }
              }
            },
            "required": [
              "mutates"
            ],
            "additionalProperties": false
          }
        ]
      }
    },
    "plugins": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1
      }
    },
    "verify": {
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "kind": {
                "type": "string",
                "const": "lean"
              },
              "statement": {
                "type": "string",
                "minLength": 1
              },
              "theorems": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "solution": {
                "type": "string",
                "minLength": 1
              },
              "paranoid": {
                "type": "boolean"
              },
              "timeout_s": {
                "type": "number",
                "exclusiveMinimum": 0,
                "maximum": 3600
              }
            },
            "required": [
              "kind",
              "statement"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "kind": {
                "type": "string",
                "const": "smt"
              },
              "statement": {
                "type": "string",
                "minLength": 1
              },
              "values": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "timeout_s": {
                "type": "number",
                "exclusiveMinimum": 0,
                "maximum": 3600
              }
            },
            "required": [
              "kind",
              "statement"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "kind": {
                "type": "string",
                "const": "script"
              },
              "run": {
                "type": "string",
                "minLength": 1
              },
              "deterministic": {
                "type": "boolean",
                "const": true
              },
              "timeout_s": {
                "type": "number",
                "exclusiveMinimum": 0,
                "maximum": 3600
              }
            },
            "required": [
              "kind",
              "run",
              "deterministic"
            ],
            "additionalProperties": false
          }
        ]
      }
    },
    "improve": {
      "type": "object",
      "properties": {
        "persona": {
          "type": "string",
          "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$"
        },
        "rounds": {
          "type": "integer",
          "minimum": 0,
          "maximum": 9007199254740991
        },
        "lessons": {
          "type": "boolean"
        }
      },
      "required": [
        "rounds"
      ],
      "additionalProperties": false
    },
    "policy": {
      "type": "object",
      "properties": {
        "kind": {
          "type": "string",
          "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$"
        },
        "w_time": {
          "not": {}
        },
        "w_agent": {
          "not": {}
        }
      },
      "additionalProperties": false
    },
    "steps": {
      "minItems": 1,
      "type": "array",
      "items": {
        "$ref": "#/$defs/__schema0"
      }
    },
    "graph": {
      "type": "object",
      "properties": {
        "nodes": {
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$"
              },
              "do": {
                "anyOf": [
                  {
                    "type": "object",
                    "properties": {
                      "persona": {
                        "anyOf": [
                          {
                            "type": "string",
                            "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$"
                          },
                          {
                            "type": "string",
                            "pattern": "^(?:project:)?[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}@[0-9]+$"
                          }
                        ]
                      },
                      "task": {
                        "type": "string",
                        "minLength": 1
                      }
                    },
                    "required": [
                      "persona",
                      "task"
                    ],
                    "additionalProperties": false
                  },
                  {
                    "type": "object",
                    "properties": {
                      "script": {
                        "type": "string",
                        "minLength": 1
                      },
                      "timeout_s": {
                        "type": "number",
                        "exclusiveMinimum": 0,
                        "maximum": 3600
                      }
                    },
                    "required": [
                      "script"
                    ],
                    "additionalProperties": false
                  },
                  {
                    "type": "object",
                    "properties": {
                      "call": {
                        "type": "object",
                        "properties": {
                          "tags": {
                            "minItems": 1,
                            "type": "array",
                            "items": {
                              "type": "string",
                              "minLength": 1
                            }
                          },
                          "task": {
                            "type": "string",
                            "minLength": 1
                          }
                        },
                        "required": [
                          "tags",
                          "task"
                        ],
                        "additionalProperties": false
                      }
                    },
                    "required": [
                      "call"
                    ],
                    "additionalProperties": false
                  }
                ]
              },
              "reconcile": {
                "type": "object",
                "properties": {
                  "persona": {
                    "anyOf": [
                      {
                        "type": "string",
                        "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$"
                      },
                      {
                        "type": "string",
                        "pattern": "^(?:project:)?[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}@[0-9]+$"
                      }
                    ]
                  },
                  "task": {
                    "type": "string",
                    "minLength": 1
                  }
                },
                "required": [
                  "persona",
                  "task"
                ],
                "additionalProperties": false
              },
              "needs": {
                "type": "array",
                "items": {
                  "type": "string",
                  "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$"
                }
              },
              "inputs": {
                "default": {},
                "type": "object",
                "propertyNames": {
                  "type": "string"
                },
                "additionalProperties": {
                  "type": "string"
                }
              },
              "falsify": {
                "default": [],
                "type": "array",
                "items": {
                  "anyOf": [
                    {
                      "type": "object",
                      "properties": {
                        "persona": {
                          "anyOf": [
                            {
                              "type": "string",
                              "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$"
                            },
                            {
                              "type": "string",
                              "pattern": "^(?:project:)?[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}@[0-9]+$"
                            }
                          ]
                        },
                        "task": {
                          "type": "string",
                          "minLength": 1
                        }
                      },
                      "required": [
                        "persona",
                        "task"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "object",
                      "properties": {
                        "script": {
                          "type": "string",
                          "minLength": 1
                        },
                        "timeout_s": {
                          "type": "number",
                          "exclusiveMinimum": 0,
                          "maximum": 3600
                        }
                      },
                      "required": [
                        "script"
                      ],
                      "additionalProperties": false
                    }
                  ]
                }
              },
              "checks": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "verify": {
                "default": [],
                "type": "array",
                "items": {
                  "oneOf": [
                    {
                      "type": "object",
                      "properties": {
                        "kind": {
                          "type": "string",
                          "const": "lean"
                        },
                        "statement": {
                          "type": "string",
                          "minLength": 1
                        },
                        "theorems": {
                          "default": [],
                          "type": "array",
                          "items": {
                            "type": "string",
                            "minLength": 1
                          }
                        },
                        "solution": {
                          "type": "string",
                          "minLength": 1
                        },
                        "paranoid": {
                          "type": "boolean"
                        },
                        "timeout_s": {
                          "type": "number",
                          "exclusiveMinimum": 0,
                          "maximum": 3600
                        }
                      },
                      "required": [
                        "kind",
                        "statement"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "object",
                      "properties": {
                        "kind": {
                          "type": "string",
                          "const": "smt"
                        },
                        "statement": {
                          "type": "string",
                          "minLength": 1
                        },
                        "values": {
                          "type": "array",
                          "items": {
                            "type": "string",
                            "minLength": 1
                          }
                        },
                        "timeout_s": {
                          "type": "number",
                          "exclusiveMinimum": 0,
                          "maximum": 3600
                        }
                      },
                      "required": [
                        "kind",
                        "statement"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "object",
                      "properties": {
                        "kind": {
                          "type": "string",
                          "const": "script"
                        },
                        "run": {
                          "type": "string",
                          "minLength": 1
                        },
                        "deterministic": {
                          "type": "boolean",
                          "const": true
                        },
                        "timeout_s": {
                          "type": "number",
                          "exclusiveMinimum": 0,
                          "maximum": 3600
                        }
                      },
                      "required": [
                        "kind",
                        "run",
                        "deterministic"
                      ],
                      "additionalProperties": false
                    }
                  ]
                }
              },
              "split": {
                "type": "object",
                "properties": {
                  "parts": {
                    "type": "string",
                    "minLength": 1
                  },
                  "width": {
                    "type": "integer",
                    "exclusiveMinimum": 0,
                    "maximum": 9007199254740991
                  }
                },
                "required": [
                  "parts"
                ],
                "additionalProperties": false
              },
              "files": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string",
                  "pattern": "^[^\\0]+$"
                }
              },
              "max_attempts": {
                "type": "integer",
                "exclusiveMinimum": 0,
                "maximum": 9007199254740991
              },
              "candidates": {
                "type": "integer",
                "exclusiveMinimum": 0,
                "maximum": 9007199254740991
              },
              "candidate_backends": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "codex-sdk",
                    "claude-sdk",
                    "fake"
                  ]
                }
              },
              "judge": {
                "type": "string",
                "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$"
              }
            },
            "required": [
              "id",
              "do",
              "needs"
            ],
            "additionalProperties": false
          }
        }
      },
      "required": [
        "nodes"
      ],
      "additionalProperties": false
    },
    "defaults": {
      "type": "object",
      "properties": {
        "backend": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "codex-sdk",
                "claude-sdk",
                "fake"
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "model": {
          "anyOf": [
            {
              "type": "string",
              "minLength": 1
            },
            {
              "type": "null"
            }
          ]
        },
        "max_attempts": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "maximum": 9007199254740991
        },
        "claude_max_turns": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "maximum": 9007199254740991
        },
        "candidates": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "maximum": 1
        }
      },
      "additionalProperties": false
    },
    "limits": {
      "type": "object",
      "properties": {
        "max_workspace_entries": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "maximum": 100000
        },
        "max_workspace_bytes": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "maximum": 17179869184
        },
        "max_workspace_depth": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "maximum": 128
        },
        "max_steps": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "maximum": 9007199254740991
        },
        "max_parallel": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "maximum": 9007199254740991
        },
        "max_group_depth": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "maximum": 128
        },
        "max_minutes": {
          "anyOf": [
            {
              "type": "number",
              "exclusiveMinimum": 0
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "additionalProperties": false
    },
    "recovery": {
      "type": "object",
      "properties": {
        "max_retries": {
          "type": "integer",
          "minimum": 0,
          "maximum": 9007199254740991
        },
        "base_delay_s": {
          "type": "number",
          "exclusiveMinimum": 0
        },
        "max_delay_s": {
          "type": "number",
          "exclusiveMinimum": 0
        },
        "jitter_ratio": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "session_mode": {
          "type": "string",
          "enum": [
            "native_only",
            "allow_reconstruction"
          ]
        }
      },
      "additionalProperties": false
    },
    "approvals": {
      "type": "object",
      "properties": {
        "ask": {
          "type": "string",
          "enum": [
            "auto",
            "main",
            "human"
          ]
        },
        "add_step": {
          "type": "string",
          "enum": [
            "auto",
            "main",
            "human"
          ]
        },
        "replan": {
          "type": "string",
          "enum": [
            "auto",
            "main",
            "human"
          ]
        },
        "new_persona": {
          "type": "string",
          "enum": [
            "auto",
            "main",
            "human"
          ]
        },
        "improve_persona": {
          "type": "string",
          "enum": [
            "auto",
            "main",
            "human"
          ]
        },
        "merge_personas": {
          "type": "string",
          "enum": [
            "auto",
            "main",
            "human"
          ]
        },
        "retire_persona": {
          "type": "string",
          "enum": [
            "auto",
            "main",
            "human"
          ]
        },
        "delete_persona": {
          "type": "string",
          "const": "human"
        },
        "tool": {
          "type": "string",
          "enum": [
            "auto",
            "main",
            "human"
          ]
        },
        "skill": {
          "type": "string",
          "enum": [
            "auto",
            "main",
            "human"
          ]
        },
        "tool_server": {
          "type": "string",
          "enum": [
            "auto",
            "main",
            "human"
          ]
        },
        "resource": {
          "type": "string",
          "enum": [
            "auto",
            "main",
            "human"
          ]
        },
        "action": {
          "type": "string",
          "const": "human"
        },
        "raise_limit": {
          "type": "string",
          "const": "human"
        },
        "paid_compute": {
          "type": "string",
          "const": "human"
        },
        "lock_statement": {
          "type": "string",
          "enum": [
            "auto",
            "main",
            "human"
          ]
        }
      },
      "additionalProperties": false
    },
    "requests": {
      "type": "object",
      "properties": {
        "max_per_run": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "maximum": 256
        }
      },
      "additionalProperties": false
    },
    "workspace": {
      "type": "object",
      "properties": {
        "mode": {
          "type": "string",
          "enum": [
            "live",
            "isolated"
          ]
        }
      },
      "additionalProperties": false
    },
    "backends": {
      "type": "object",
      "properties": {
        "fake": {
          "type": "object",
          "properties": {
            "script": {
              "type": "object",
              "properties": {
                "version": {
                  "type": "number",
                  "const": 1
                },
                "answers": {
                  "maxItems": 1024,
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "persona": {
                        "anyOf": [
                          {
                            "type": "string",
                            "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$"
                          },
                          {
                            "type": "string",
                            "pattern": "^(?:project:)?[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}@[0-9]+$"
                          }
                        ]
                      },
                      "task": {
                        "type": "string",
                        "minLength": 1
                      },
                      "attempt": {
                        "default": 1,
                        "type": "integer",
                        "exclusiveMinimum": 0,
                        "maximum": 9007199254740991
                      },
                      "execution": {
                        "default": 1,
                        "type": "integer",
                        "exclusiveMinimum": 0,
                        "maximum": 9007199254740991
                      },
                      "answer": {
                        "$ref": "#/$defs/__schema1"
                      }
                    },
                    "required": [
                      "persona",
                      "task",
                      "answer"
                    ],
                    "additionalProperties": false
                  }
                }
              },
              "required": [
                "version",
                "answers"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "script"
          ],
          "additionalProperties": false
        }
      },
      "additionalProperties": false
    }
  },
  "required": [
    "name",
    "goal",
    "personas"
  ],
  "additionalProperties": false,
  "$defs": {
    "__schema0": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$"
            },
            "do": {
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "persona": {
                      "anyOf": [
                        {
                          "type": "string",
                          "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$"
                        },
                        {
                          "type": "string",
                          "pattern": "^(?:project:)?[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}@[0-9]+$"
                        }
                      ]
                    },
                    "task": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "required": [
                    "persona",
                    "task"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "script": {
                      "type": "string",
                      "minLength": 1
                    },
                    "timeout_s": {
                      "type": "number",
                      "exclusiveMinimum": 0,
                      "maximum": 3600
                    }
                  },
                  "required": [
                    "script"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "call": {
                      "type": "object",
                      "properties": {
                        "tags": {
                          "minItems": 1,
                          "type": "array",
                          "items": {
                            "type": "string",
                            "minLength": 1
                          }
                        },
                        "task": {
                          "type": "string",
                          "minLength": 1
                        }
                      },
                      "required": [
                        "tags",
                        "task"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "required": [
                    "call"
                  ],
                  "additionalProperties": false
                }
              ]
            },
            "reconcile": {
              "type": "object",
              "properties": {
                "persona": {
                  "anyOf": [
                    {
                      "type": "string",
                      "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$"
                    },
                    {
                      "type": "string",
                      "pattern": "^(?:project:)?[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}@[0-9]+$"
                    }
                  ]
                },
                "task": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "persona",
                "task"
              ],
              "additionalProperties": false
            },
            "needs": {
              "type": "array",
              "items": {
                "type": "string",
                "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$"
              }
            },
            "inputs": {
              "default": {},
              "type": "object",
              "propertyNames": {
                "type": "string"
              },
              "additionalProperties": {
                "type": "string"
              }
            },
            "falsify": {
              "default": [],
              "type": "array",
              "items": {
                "anyOf": [
                  {
                    "type": "object",
                    "properties": {
                      "persona": {
                        "anyOf": [
                          {
                            "type": "string",
                            "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$"
                          },
                          {
                            "type": "string",
                            "pattern": "^(?:project:)?[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}@[0-9]+$"
                          }
                        ]
                      },
                      "task": {
                        "type": "string",
                        "minLength": 1
                      }
                    },
                    "required": [
                      "persona",
                      "task"
                    ],
                    "additionalProperties": false
                  },
                  {
                    "type": "object",
                    "properties": {
                      "script": {
                        "type": "string",
                        "minLength": 1
                      },
                      "timeout_s": {
                        "type": "number",
                        "exclusiveMinimum": 0,
                        "maximum": 3600
                      }
                    },
                    "required": [
                      "script"
                    ],
                    "additionalProperties": false
                  }
                ]
              }
            },
            "checks": {
              "default": [],
              "type": "array",
              "items": {
                "type": "string",
                "minLength": 1
              }
            },
            "verify": {
              "default": [],
              "type": "array",
              "items": {
                "oneOf": [
                  {
                    "type": "object",
                    "properties": {
                      "kind": {
                        "type": "string",
                        "const": "lean"
                      },
                      "statement": {
                        "type": "string",
                        "minLength": 1
                      },
                      "theorems": {
                        "default": [],
                        "type": "array",
                        "items": {
                          "type": "string",
                          "minLength": 1
                        }
                      },
                      "solution": {
                        "type": "string",
                        "minLength": 1
                      },
                      "paranoid": {
                        "type": "boolean"
                      },
                      "timeout_s": {
                        "type": "number",
                        "exclusiveMinimum": 0,
                        "maximum": 3600
                      }
                    },
                    "required": [
                      "kind",
                      "statement"
                    ],
                    "additionalProperties": false
                  },
                  {
                    "type": "object",
                    "properties": {
                      "kind": {
                        "type": "string",
                        "const": "smt"
                      },
                      "statement": {
                        "type": "string",
                        "minLength": 1
                      },
                      "values": {
                        "type": "array",
                        "items": {
                          "type": "string",
                          "minLength": 1
                        }
                      },
                      "timeout_s": {
                        "type": "number",
                        "exclusiveMinimum": 0,
                        "maximum": 3600
                      }
                    },
                    "required": [
                      "kind",
                      "statement"
                    ],
                    "additionalProperties": false
                  },
                  {
                    "type": "object",
                    "properties": {
                      "kind": {
                        "type": "string",
                        "const": "script"
                      },
                      "run": {
                        "type": "string",
                        "minLength": 1
                      },
                      "deterministic": {
                        "type": "boolean",
                        "const": true
                      },
                      "timeout_s": {
                        "type": "number",
                        "exclusiveMinimum": 0,
                        "maximum": 3600
                      }
                    },
                    "required": [
                      "kind",
                      "run",
                      "deterministic"
                    ],
                    "additionalProperties": false
                  }
                ]
              }
            },
            "split": {
              "type": "object",
              "properties": {
                "parts": {
                  "type": "string",
                  "minLength": 1
                },
                "width": {
                  "type": "integer",
                  "exclusiveMinimum": 0,
                  "maximum": 9007199254740991
                }
              },
              "required": [
                "parts"
              ],
              "additionalProperties": false
            },
            "files": {
              "minItems": 1,
              "type": "array",
              "items": {
                "type": "string",
                "pattern": "^[^\\0]+$"
              }
            },
            "max_attempts": {
              "type": "integer",
              "exclusiveMinimum": 0,
              "maximum": 9007199254740991
            },
            "candidates": {
              "type": "integer",
              "exclusiveMinimum": 0,
              "maximum": 9007199254740991
            },
            "candidate_backends": {
              "minItems": 1,
              "type": "array",
              "items": {
                "type": "string",
                "enum": [
                  "codex-sdk",
                  "claude-sdk",
                  "fake"
                ]
              }
            },
            "judge": {
              "type": "string",
              "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$"
            }
          },
          "required": [
            "id",
            "do"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "sequential": {
              "minItems": 1,
              "type": "array",
              "items": {
                "$ref": "#/$defs/__schema0"
              }
            }
          },
          "required": [
            "sequential"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "parallel": {
              "minItems": 1,
              "type": "array",
              "items": {
                "$ref": "#/$defs/__schema0"
              }
            }
          },
          "required": [
            "parallel"
          ],
          "additionalProperties": false
        }
      ]
    },
    "__schema1": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "number"
        },
        {
          "type": "boolean"
        },
        {
          "type": "null"
        },
        {
          "type": "array",
          "items": {
            "$ref": "#/$defs/__schema1"
          }
        },
        {
          "type": "object",
          "propertyNames": {
            "type": "string"
          },
          "additionalProperties": {
            "$ref": "#/$defs/__schema1"
          }
        }
      ]
    }
  },
  "oneOf": [
    {
      "required": [
        "steps"
      ],
      "not": {
        "required": [
          "graph"
        ]
      }
    },
    {
      "required": [
        "graph"
      ],
      "not": {
        "required": [
          "steps"
        ]
      }
    }
  ]
}
```

## Examples

### Example code-fix.yaml

```yaml
name: Diagnose and fix a reproducible code defect
goal:
  Produce a small candidate fix and regression test in the shared live project. Record the demonstrated
  defect, changed files and the evidence available for review.
personas:
  author:
    description: Develops a focused candidate patch.
    role:
      Inspect the available source and existing project rules. Use file tools to produce a minimal
      patch and a regression test. Write REVIEW.md with the reproduction and the checks actually performed.
      Return a summary of the kept candidate.
    tools:
      - Read
      - Glob
      - Grep
      - Write
      - Edit
    outputs:
      summary:
        type: string
  reviewer:
    description: Independently challenges the proposed diagnosis and patch.
    role:
      Read the candidate and supplied inputs. Seek a concrete counterexample, a violated project rule
      or a missing regression case. Return refuted with evidence for a demonstrated defect, otherwise
      survived with the checks performed.
    tools:
      - Read
      - Glob
      - Grep
steps:
  - id: cause
    do:
      persona: author
      task: Identify one reproducible defect and record its cause in REVIEW.md.
    falsify:
      - persona: reviewer
        task: Try to disprove the stated defect using the source and a concrete input.
  - id: fix
    do:
      persona: author
      task: Apply the smallest fix for the diagnosed defect and add a regression test.
    falsify:
      - persona: reviewer
        task: Seek a concrete regression or an input that defeats the proposed fix.
    inputs:
      cause: cause.summary
limits:
  max_parallel: 2
  max_minutes: 10
```

### Example science-claim.yaml

```yaml
name: Challenge a probability claim
goal:
  Evaluate the claim that six heads from a fair independent coin make tails more likely on the next
  flip. State assumptions, derive the next-flip probability and give a counterexample to any unsupported
  conclusion.
personas:
  author:
    description: Explains the claim from stated premises.
    role:
      Use the stated fair-coin and independence assumptions. Write CLAIM.md with the claim, reasoning,
      assumptions and conclusion. Distinguish logical deductions from observations. Return a summary.
    tools:
      - Read
      - Glob
      - Grep
      - Write
      - Edit
    outputs:
      summary:
        type: string
  reviewer:
    description: Searches for a mathematical counterexample.
    role:
      Challenge each inference against the fair independent coin assumptions. Give a concrete counterexample
      for a false inference. Return survived only with the reasoning you checked.
    tools:
      - Read
      - Glob
      - Grep
steps:
  - id: claim
    do:
      persona: author
      task: Derive the probability of tails after the given sequence and write CLAIM.md.
    falsify:
      - persona: reviewer
        task: Try to refute the derivation or expose an unstated independence assumption.
limits:
  max_parallel: 2
  max_minutes: 10
```

### Example business-plan.yaml

```yaml
name: Plan a small fictional repair service
goal:
  Produce PLAN.md for a fictional repair service with a starting budget of 5000 EUR. Label every price
  and demand estimate as an assumption. Keep the startup budget within the limit and identify a measurable
  decision to test demand.
personas:
  author:
    description: Writes an explicit assumption-based plan.
    role:
      Write only the file named by the current task. Use the goal and supplied inputs. Record assumptions
      and arithmetic, keep estimates distinct from observed facts and return a summary of your contribution.
    tools:
      - Read
      - Glob
      - Grep
      - Write
      - Edit
    outputs:
      summary:
        type: string
  reviewer:
    description: Challenges the budget and demand reasoning.
    role:
      Seek a numerical contradiction, unsupported factual claim or violated budget. Return refuted
      with a concrete counterexample, otherwise survived with the checks performed.
    tools:
      - Read
      - Glob
      - Grep
steps:
  - id: scope
    do:
      persona: author
      task: Define the fictional service, customer and budget assumptions in ASSUMPTIONS.md.
    falsify:
      - persona: reviewer
        task: Find an assumption that conflicts with the stated goal.
  - parallel:
      - id: demand
        do:
          persona: author
          task: Propose a measurable low-cost demand test in DEMAND.md.
        falsify:
          - persona: reviewer
            task: Find a demand-test outcome that would invalidate the proposal.
        inputs:
          scope: scope.summary
      - id: costs
        do:
          persona: author
          task: Allocate the 5000 EUR startup budget with an explicit reserve in BUDGET.md.
        falsify:
          - persona: reviewer
            task: Recompute the budget and seek a sum above 5000 EUR.
        inputs:
          scope: scope.summary
  - id: plan
    do:
      persona: author
      task: Combine the demand test and budget into PLAN.md with a decision rule.
    falsify:
      - persona: reviewer
        task: Seek a contradiction between the final plan, demand test and budget.
    inputs:
      demand: demand.summary
      costs: costs.summary
limits:
  max_parallel: 2
  max_minutes: 10
```

### Example everyday-problem.yaml

```yaml
name: Organize a small apartment move
goal:
  Write MOVE.md for a two-day apartment move using two people and a total assumed budget of 200 EUR.
  State task dependencies, rest periods, uncertain estimates and a fallback for transport cancellation.
personas:
  author:
    description: Produces a practical dependency-aware plan.
    role:
      Use the stated people, time and budget constraints. Make assumptions explicit and check arithmetic.
      Write MOVE.md with a schedule and fallback. Return a summary.
    tools:
      - Read
      - Glob
      - Grep
      - Write
      - Edit
    outputs:
      summary:
        type: string
  reviewer:
    description: Challenges feasibility under everyday disruptions.
    role:
      Seek overlapping commitments, missing dependencies or a budget contradiction. Check the transport
      cancellation fallback. Return refuted with a concrete conflict, otherwise survived with checks performed.
    tools:
      - Read
      - Glob
      - Grep
steps:
  - id: schedule
    do:
      persona: author
      task: Draft a two-day move schedule with its assumptions and budget.
    falsify:
      - persona: reviewer
        task: Find overlapping commitments or a dependency that makes the schedule impossible.
  - id: fallback
    do:
      persona: author
      task: Complete MOVE.md with a transport cancellation fallback.
    falsify:
      - persona: reviewer
        task: Try to break the fallback within the stated people, time and budget.
    inputs:
      schedule: schedule.summary
limits:
  max_parallel: 2
  max_minutes: 10
```
