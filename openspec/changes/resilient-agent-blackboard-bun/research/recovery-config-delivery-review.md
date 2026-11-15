# Recovery, configuration and usable delivery review

Reviewed on 2026-11-07. This extends the earlier end-to-end and development-practices reviews.

These are proposed product contracts. The checkout still has no product implementation. Commands below define intended behavior and are not available yet.

## Objective and boundaries

Preserve workflow and agent progress across interruptions. Express mixed dependency plans without a fixed few-step shape. Centralize settings and complete the control and delivery surfaces.

Keep the Bun monorepo, lean hooks, independent documentation checks and vendor-stubbed default tests. Preserve prior capabilities and scenario identities. Do not run paid agents or publish packages during this review.

## Research and its limits

The [Codex SDK documentation](https://learn.chatgpt.com/docs/codex-sdk) describes continuing a thread and restoring a specific saved thread through `resumeThread(threadId)`. Its TypeScript library documents Node as its runtime requirement. Titan's Bun compatibility still needs a pinned-version probe. This supports saving thread identities; it does not establish consistent filesystem checkpoints or exactly-once external actions.

The [Claude session documentation](https://code.claude.com/docs/en/agent-sdk/sessions) distinguishes continuation, explicit session restoration and forking. It states that sessions preserve conversation history separately from the filesystem. Explicit ids matter when sessions coexist. Titan must not restore whichever session happens to be newest.

The [Claude file-checkpoint documentation](https://code.claude.com/docs/en/agent-sdk/file-checkpointing) describes tool-specific file tracking. It excludes some shell and subagent changes. Titan therefore needs its own complete workspace snapshots and action journal. Vendor conversation restoration alone cannot establish consistent recovery.

[Bun's package utility documentation](https://bun.sh/docs/pm/cli/pm) describes creating release tarballs with `bun pm pack`. Its [catalog documentation](https://bun.sh/docs/pm/catalogs) describes replacing catalog references during packing. Titan must inspect packed manifests and test installation with every runtime dependency available outside the workspace.

These sources were read during this review. The resulting checkpoint, configuration and release design is Titan's decision, not a vendor guarantee. No SDK execution or live compatibility trial ran.

## Contracts changed

| Gap                                         | Required behavior                                                      | Owner      |
| ------------------------------------------- | ---------------------------------------------------------------------- | ---------- |
| Last result attempt is lost to a rate limit | Continue the same logical attempt; retain a separate execution segment | 28.1       |
| Restored conversation sees the wrong files  | Commit and verify a session-and-file checkpoint                        | 28.2       |
| Restart refills retry allowance             | Persist recovery counters and next retry dates                         | 28.3       |
| Old worker publishes after replacement      | Fence publication by execution generation                              | 28.3       |
| Vendor session no longer exists             | Block by default; reconstruct only with explicit authorization         | 28.4       |
| Nested groups impose an unnecessary barrier | Accept explicit dependencies alongside the existing group shorthand    | 28.5, 28.6 |
| A checker outage creates a false refutation | Recover the unfinished check against its saved candidate               | 28.7       |
| Provider outage damages persona quality     | Retain usage; exclude incomplete outcomes from quality learning        | 28.8       |
| Settings disagree across packages           | Share definitions and schemas through `@titan/config`                  | 29.1–29.5  |
| CLI gives ids without usable controls       | Provide explicit selectors, lifecycle controls and stable outputs      | 30.1–30.4  |
| Agent files never reach the user            | Inspect, export and deliberately apply checked artifacts               | 30.5       |
| Daemon reuses another caller's context      | Bind project, executables and ephemeral credentials to the run         | 30.6       |
| Recovery is invisible                       | Display graph state, segments, checkpoints and recovery actions        | 30.7       |
| Checkout tests conceal distribution errors  | Install all packed runtime packages outside the workspace              | 31.1–31.3  |
| Code is assumed to represent every task     | Verify documents, research, operations and self-development too        | 31.4, 31.5 |
| Recovery passes only the happy path         | Inject faults at every execution and publication boundary              | 31.6       |

## What continuation means

A logical attempt seeks one candidate and its completed checks. Each physical invocation has an execution id. Interruption creates another execution segment within the same logical attempt.

Saved candidate results, completed falsifiers and survived predecessor steps remain reusable. An unfinished worker continues from its latest consistent checkpoint. An unfinished falsifier checks its saved candidate again.

Recovery stores the transcript position, snapshot hashes, pending requests, usage, configuration revision and action journal together. An incomplete stream remains incomplete. An inconsistent checkpoint blocks until a safe boundary is established.

A native session is restored by its explicit id. A reconstructed session is new and must say so. It receives saved task context and tool outcomes after effects are reconciled.

Exact recovery means the latest consistent durable boundary. It cannot mean restoration of unrecorded reasoning or an arbitrary interrupted instruction. External effects with unknown outcomes require reconciliation before replay.

| Observed outcome                           | Result attempt                          | Execution accounting                       | Next action                                             |
| ------------------------------------------ | --------------------------------------- | ------------------------------------------ | ------------------------------------------------------- |
| Completed valid negative check             | Reject current result                   | Retain usage and evidence                  | Next result attempt within its limit                    |
| Rate limit or interrupted stream           | Preserve current attempt                | Record interruption and usage uncertainty  | Bounded recovery or blocked state                       |
| Hard quota or missing credentials          | Preserve current attempt                | Record cause without a quality verdict     | Block until setup is repaired                           |
| Missing native session                     | Preserve current attempt                | Record session loss                        | Restore verified checkpoint or authorize reconstruction |
| Killed or timed-out checker                | Preserve candidate and attempt          | Record incomplete `not proven` observation | Recover that checker within its allowance               |
| Completed solver `unknown`                 | Reject as unproven, not logically false | Retain semantic check evidence             | Next result attempt within its limit                    |
| Explicit cancellation or hard run deadline | Preserve all evidence                   | Record terminal cancellation or timeout    | New run; no reopening                                   |
| Unknown external action outcome            | Preserve pending state                  | Retain intent and action id                | Person reconciles; no automatic duplicate effect        |

Recovery waits release slots only after owned work has stopped. Unknown remote executions retain their backend reservations. A stale process cannot publish through a superseded execution identity. A backend requiring the old absolute folder must confirm earlier writers stopped before restoring it. Otherwise recovery blocks.

## Configuration file and schema reference

`packages/config` owns definitions, defaults, scope, units, bounds, environment bindings and documentation metadata. The workflow, CLI, server and doctor use its resolved types and validation.

A config file has `schema_version: 1`. Its shared sections are `defaults`, `limits`, `recovery`, `server`, `backends`, `approvals`, `tools`, `trace`, `retention` and `learning`.

Workflow files expose the permitted shared sections directly. There is no second arbitrary settings object. Server ownership, credentials and person-only trace controls are not workflow settings.

The initial key table below fixes the new configuration surface. Other accepted settings retain their existing capability definitions and must join the same registry before implementation.

| Key                                     | Type and unit                                      | Initial default                                    | Permitted scope                                                     |
| --------------------------------------- | -------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------- |
| `schema_version`                        | Supported integer format version                   | 1                                                  | Configuration file                                                  |
| `defaults.backend`                      | Known backend id                                   | Unset; use detection after existing fallback rules | User, project, workflow; CLI fallback or explicit persona override  |
| `defaults.max_attempts`                 | Positive result-attempt count                      | 3                                                  | User, project, workflow; individual step wins                       |
| `defaults.candidates`                   | Positive candidate count                           | 1                                                  | User, project, workflow; individual step wins                       |
| `limits.max_steps`                      | Positive logical work-item count                   | 50                                                 | User, project, workflow, permitted CLI override                     |
| `limits.max_parallel`                   | Positive active-session count                      | 4                                                  | User, project, workflow, permitted CLI override                     |
| `limits.max_minutes`                    | Positive elapsed minutes or absent                 | Absent; RunPod defaults to at most 60              | User, project, workflow, permitted CLI override                     |
| `limits.max_group_depth`                | Positive integer up to 128                         | 32                                                 | User, project, workflow within parser ceiling                       |
| `recovery.max_retries`                  | Non-negative retries per logical role and phase    | 5                                                  | User, project, workflow; audited owner revision for an existing run |
| `recovery.base_delay_s`                 | Positive seconds                                   | 1                                                  | User, project, workflow                                             |
| `recovery.max_delay_s`                  | Positive seconds, at least base delay              | 60                                                 | User, project, workflow; never shorten vendor Retry-After           |
| `recovery.jitter_ratio`                 | Number from 0 to 1                                 | 0.2                                                | User, project, workflow                                             |
| `recovery.session_mode`                 | `native_only` or `allow_reconstruction`            | `native_only`                                      | User, project, explicit workflow or person decision                 |
| `server.max_active_agents`              | Positive active-session count                      | 8                                                  | Server owner only                                                   |
| `backends.<id>.max_concurrent_sessions` | Positive count or null for no adapter-specific cap | Adapter metadata; unverified if unavailable        | Owner backend ceiling; workflow cannot raise it                     |
| `retention.run_days`                    | Non-negative days or null                          | null: no automatic deletion                        | Owner; never remove active recovery inputs                          |
| `learning.enabled`                      | Boolean                                            | false: experimental learning requires opt-in       | User, project, workflow                                             |

New numeric defaults and ceilings are design choices pending measurements. Existing defaults remain those already specified. Registry metadata must distinguish defaults from protected ceilings and disclose every shadowed value.

Resolution proceeds from built-in defaults through user, project, workflow and permitted CLI overrides. `--config` replaces the project file layer only. `--home` wins over `TITAN_HOME`.

Backend choice retains its existing exception. Explicit `--backend persona=id` wins; persona and workflow choices precede `--backend-default`. Project and user backend defaults precede harness detection.

Only documented environment bindings are accepted. Existing bindings include home, vendor credential references and person-controlled tracing. Arbitrary `TITAN_*` variables must not silently become settings.

```yaml
# Proposed TITAN_HOME/config.yaml
schema_version: 1
server:
  max_active_agents: 8
limits:
  max_steps: 200
  max_parallel: 4
recovery:
  max_retries: 5
  base_delay_s: 1
  max_delay_s: 60
  jitter_ratio: 0.2
  session_mode: native_only
```

```yaml
# Proposed project .titan/config.yaml
schema_version: 1
limits:
  max_parallel: 2
recovery:
  max_retries: 8
```

The workflow may lower or otherwise change permitted run values. It cannot raise server-owned capacity or grant permissions. An existing run keeps its accepted settings snapshot despite later file edits.

Credentials remain references to allowlisted environment names. Authenticated clients may pass ephemeral bindings, never a complete environment dump. Restart requires rebinding missing values without borrowing another run's credentials.

## Mixed-plan reference

The following is the scheduling portion of a proposed workflow. Its personas and output formats must be declared in the full file.

A complete shipped example must use this graph shape with a real goal and checked persona definitions:

```yaml
graph:
  nodes:
    - id: plan
      needs: []
      do: { persona: planner, task: "Plan the requested change" }
      falsify: [{ persona: skeptic, task: "Find missing requirements" }]
    - id: code
      needs: [plan]
      do: { persona: coder, task: "Implement the accepted plan" }
      falsify: [{ script: "bun test" }]
    - id: report
      needs: [plan]
      do: { persona: writer, task: "Draft the requested report" }
      falsify: [{ persona: skeptic, task: "Check each stated claim" }]
    - id: check_code
      needs: [code]
      do: { script: "bun run check" }
      falsify: [{ persona: skeptic, task: "Review the check evidence" }]
    - id: assemble
      needs: [check_code, report]
      do: { persona: writer, task: "Assemble the checked delivery" }
      falsify: [{ persona: skeptic, task: "Check the complete delivery" }]
```

`code` and `report` may overlap. `check_code` can start before `report` ends. `assemble` waits for both predecessors. Different file changes still follow the existing conflict rules.

This is a shape reference, not an executable example or a schema-validation result. Task 31.3 must ship a complete validated example and deterministic response fixtures.

## CLI argument reference

All rows define proposed behavior. Existing specialized commands retain their capability-specific payload fields. Help must expand every operation into checked argument definitions, not leave placeholders in released documentation.

| Command                          | Target and companion arguments                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `guide`                          | Optional harness selector; plain guide text or JSON                                                  |
| `schema`                         | Workflow schema; optional output file                                                                |
| `install`                        | Explicit harness and scope; preview before changing harness files                                    |
| `check <file>`                   | Home, project, config and backend selectors; validation paths and errors                             |
| `run <file>`                     | `--detach` or `--watch`, `--dry-run`, backend selectors, repeated `--set`, origin and submission ids |
| `resume <run-id>`                | Watch or detach, session mode, credentials-from-env and approved recovery allowance revision         |
| `answer <request-id>`            | `--run-id`, typed answer payload and expected request version                                        |
| `approve <request-id>`           | `--run-id`, exact decision scope and expected version; person authority where required               |
| `deny <request-id>`              | `--run-id`, reason and expected request version                                                      |
| `requests`                       | Run, client, harness-session and project filters; limit and cursor                                   |
| `improve <run-id>`               | Explicit source run and bounded rounds; existing improvement restrictions                            |
| `lessons <query>`                | Tags and result limit; alias for lesson-kind knowledge search                                        |
| `plans <kind>`                   | Kind and result limit; source run ids and evidence                                                   |
| `policy show <kind>`             | Effective learning policy and history; changes need declared owner authority                         |
| `traces export <kind>`           | Explicit selection and destination; opt-in training export                                           |
| `persona <operation>`            | Persona name and immutable version; create, search, show, update or approved delete                  |
| `kb <operation>`                 | Kind, entry id, expected version, query or payload according to the operation                        |
| `backends`                       | Optional backend id; setup and evidence status                                                       |
| `doctor`                         | `--offline`; optional named capability and context selection                                         |
| `serve`                          | Home and owner settings; readiness output; explicit second writer fails                              |
| `mcp`                            | Home and client context; protocol stream, no --json                                                  |
| `worker`                         | Existing RunPod worker protocol arguments; no --json                                                 |
| `tool-server`                    | Host-bound session capability and context; protocol stream, no --json                                |
| `trace <run-id>`                 | Local spans output; network export remains separately controlled                                     |
| `dashboard`                      | Optional run target or origin filters; scoped one-time login link                                    |
| `proof recheck <run-id>`         | Original hashed inputs and checker versions; separate observation                                    |
| `config <operation>`             | init, show, validate, schema or set; scope, file, sources and expected version                       |
| `runs`                           | Workflow id, state, project, harness, client and session filters; limit and cursor                   |
| `status <run-id>`                | Optional step, split-part, candidate, attempt and execution ids                                      |
| `events <run-id>`                | --after, --limit; optional --follow --format jsonl                                                   |
| `pause <run-id>`                 | Expected run version; checkpoint progress or pausing state                                           |
| `cancel <run-id>`                | Expected run version; terminal cancellation and resource status                                      |
| `artifacts <operation> <run-id>` | list, show or export; artifact id required for show/export, explicit export destination              |
| `apply <run-id>`                 | --target, --dry-run or approved diff id, expected target base and run version                        |

Common context flags are `--home`, `--project-path` and `--config`. Ordinary commands accept `--json`; protocol exceptions are explicit above. Mutations require full ids.

Run origin flags are `--client-id`, `--harness-session-id` and `--submission-id`. Backend flags are `--backend persona=id`, `--backend-default id` and an explicit harness override.

Run selectors use `--run-id` where a command targets a request or saved configuration rather than accepting a positional run id. Step selectors use `--step-id`, `--split-part-id`, `--candidate-id`, `--attempt-id` and `--execution-id`.

Unknown flags, conflicting watch modes, untyped overrides and missing companions fail before work. All mutations carry an idempotency key and expected version through HTTP and MCP as well.

The JSON envelope contains `schema_version`, `operation`, identifiers, `state`, `data` and nullable `error`. Run responses also contain `events`, `next_cursor` and truncation metadata.

Error objects contain `code`, `message`, field paths, retryability and an optional recovery action. They contain no credentials. Exit code 4 means the client could not establish the operation's outcome, not that a workflow failed.

## Exact new control syntax

The following syntax is the initial command-definition contract. Angle brackets mark required values. Square brackets mark optional arguments; they are not literal shell characters.

```text
titan config init --scope <user|project> [--file <path>]
titan config show [--sources] [--run-id <full-id>]
titan config validate [--file <path>]
titan config schema [--output <path>]
titan config set <key> <typed-value> --scope <user|project> [--expected-version <version>]
titan runs [--workflow-id <id>] [--state <state>] [--project-path <path>]
           [--client-id <id>] [--harness <name>] [--harness-session-id <id>]
           [--limit <count>] [--cursor <cursor>]
titan status <run-id> [--step-id <id>] [--split-part-id <id>]
             [--candidate-id <id>] [--attempt-id <id>] [--execution-id <id>]
titan events <run-id> [--after <cursor>] [--limit <count>] [--follow --format jsonl]
titan pause <full-run-id> [--expected-version <version>]
titan cancel <full-run-id> [--expected-version <version>]
titan artifacts list <run-id>
titan artifacts show <run-id> --artifact-id <id>
titan artifacts export <run-id> --artifact-id <id> --output <path>
titan apply <full-run-id> --target <path> --dry-run
titan apply <full-run-id> --target <path> --approval-id <id> --expected-base <sha256>
titan resume <full-run-id> [--watch|--detach]
             [--session-mode <native_only|allow_reconstruction>]
             [--recovery-max-retries <total-allowance>] [--approval-id <id>]
             [--credentials-from-env]
```

All mutations accept `--idempotency-key`. Existing-object mutations also accept `--expected-version`. Omission means fetch once before mutation, not ignore version checking or blindly retry conflicts.

`config set` accepts YAML scalar or structured values validated against its named setting. It refuses secret values and owner-forbidden scopes. `--file` cannot combine with `--scope` when their targets disagree.

An events query without `--after` starts at the first retained event. Expired or unknown cursors return a conflict with the earliest available cursor, never a silent gap.

Nested status selectors must belong to the named run and selected parent identities. A mismatched candidate or execution returns a field error, never another run's data.

`--recovery-max-retries` means the new total allowance, including retries already spent. It does not grant that many additional retries. A protected change requires its scoped approval id.

`--credentials-from-env` sends only required allowlisted bindings over the authenticated local connection. It does not persist values or accept a workflow-provided environment dump.

Export refuses an existing destination unless an explicit replacement decision covers it. Apply requires the approved diff, matching base hash and expected run version. Neither operation commits or pushes a Git repository.

```json
{
  "schema_version": 1,
  "operation": "status",
  "run_id": "example-run-id",
  "workflow_id": "example-workflow-id",
  "workflow_revision": "sha256:example",
  "state": "blocked",
  "data": {
    "step_id": "code",
    "attempt_id": "attempt-3",
    "execution_id": "execution-2",
    "result_refutations": 2,
    "recovery_retries_spent": 5,
    "reason": "session_unavailable",
    "recovery_action": "restore session or authorize checkpoint reconstruction"
  },
  "error": null
}
```

This example reports two earlier completed rejections and an interrupted third attempt. Session loss adds no third refutation. A successful status query exits 0; a watched run stopping at this blocked state exits 3.

## Installed acceptance path

The first preview must be exercised from a clean directory and home. Installation uses packed release artifacts and a test registry, never workspace links.

1. Install the CLI and every reachable runtime package. Record package hashes and runtime versions.
2. Run help and offline doctor. Initialize configuration and inspect its sources.
3. Validate and dry-run the complete shipped mixed-graph example. Confirm no vendor or plug-in execution during dry-run.
4. Start it with explicit fake-backend selection and a scripted interruption. Save the submission receipt and full run id.
5. Observe overlapping branches, then terminate the test daemon at a controlled checkpoint boundary.
6. Restart and resume by id. Assert unchanged survived results and the same interrupted logical attempt.
7. Read paged events, status, recovery history and effective configuration. Verify every physical invocation and its usage.
8. Inspect and export the checked artifact. Preview its exact application; approve that diff and apply to the unchanged target base.
9. Repeat with a document, cited research and a stubbed external action whose acknowledgment is lost.
10. Record one separately authorized real-adapter rehearsal before claiming real-agent readiness.

Tests control fault injection. No public command should let a normal workflow disable checks or impersonate a person to satisfy the demo.

## Falsification and remaining evidence

The acceptance map adds 67 pending cases, retaining all 428 previously accepted scenario identities. It assigns every new case to a task, delivery stage and test level.

The adversarial cases include last-attempt throttling, missing sessions, torn checkpoints, stale workers, duplicate resume and outage-driven false learning. They also cover dependency cycles, unsafe exports, target changes, missing packed dependencies and caller credential isolation.

`recovery-config-delivery-verification.txt` records the observed verification output. Automated artifact checks verify structure, ownership and plain language. Their negative fixtures verify that broken mappings and incomplete command lists fail. They do not execute the future product.

Remaining work is explicit: implement all open tasks, run the installed stubbed acceptance path, verify pinned live adapters and collect platform evidence. Full production readiness remains blocked until those gates pass.

Historical quotation-check gaps in earlier research remain documented in `end-to-end-review.md`. This review uses the linked primary documentation and does not turn old quotations into verified evidence.
