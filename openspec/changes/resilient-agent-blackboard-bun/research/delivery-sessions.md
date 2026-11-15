# Product delivery sessions

Updated on 2026-11-16 from the owning task file and acceptance map. This plan covers all 195 open parent tasks. Completed parents retain their existing evidence. The repair change owns its remaining shared-file work before archival.

## Delivery order

Complete shared-file coordination and native permission acceptance before closing the repair change. Research that establishes an execution boundary precedes its implementation. Within each cluster, follow the dependencies in the repair product backlog. Finish a prerequisite before a dependent session. Independent work can proceed while a platform-specific case needs another supported environment.

Every session retains its parent task and named acceptance scenarios. A session covers one requirement and at most four pending scenarios. These boundaries are planning estimates and may be split further after source inspection. Passing a session does not close its parent while other required cases remain pending. A parent with no pending map rows still needs its written completion criteria checked against actual implementation and installed evidence.

For each implementation session, inspect the existing normal entry points, implement the missing behavior, add regression cases for the gap, run focused acceptance, review the diff, run the complete normal gate and installed-package acceptance, then commit and push. Record source identity, commands, failures and limitations in delivery evidence. Verify Actions is disabled immediately before each push. Preserve the shared live filesystem and unrelated work.

Paid live calls require their existing explicit authorization. Other-backend deferrals remain visible below and retain all specifications. Cross-platform scenarios need the named platforms. Offline contracts preserve their existing distinction from real vendor execution.

The source acceptance map remains the authority for scenario status. This session plan adds delivery order and implementation boundaries without changing those statuses. See [owning tasks](../tasks.md), [acceptance ownership](acceptance-map.tsv) and [repair dependencies](../../repair-harness-delivery/research/product-backlog.tsv).

## 1. Shared files and native permissions

### Task 26.1

Parent 26.1 retains its completion criteria. Persist caller context and idempotent submission ids.

Prerequisites — durable identities; project write boundaries; bounded scheduler.

- Implement and verify Run submission identifies its caller and retry in titan-server. Retain acceptance for “One harness submits two workflows”.
- Implement and verify Detection belongs to each submitting client in harness-detection. Retain acceptance for “Codex submits to a Claude-started server”, “Daemon restarts in another harness”.

### Task 26.2

Parent 26.2 retains its completion criteria. Resolve concurrent daemon startup through the winning writer.

Prerequisites — durable identities; project write boundaries; bounded scheduler.

- Implement and verify Concurrent clients converge on one server in titan-server. Retain acceptance for “Two clients start an absent server”, “One invalid workflow among valid submissions”.

### Task 26.3

Parent 26.3 retains its completion criteria. Implement server-wide slots and durable round-robin admission.

Prerequisites — durable identities; project write boundaries; bounded scheduler.

- Implement and verify Runs share capacity without sharing an execution lock in hive-collaboration. Retain acceptance for “Three workflows genuinely overlap”, “All roles share the server cap”, “Waiting run releases shared capacity”, “Simultaneous admissions reserve one slot”.
- Implement and verify Ready runs receive fair admission in hive-collaboration. Retain acceptance for “Busy run cannot monopolize newly free slots”, “Restart preserves queued turns”, “Queued run reaches its deadline”.

### Task 26.4

Parent 26.4 retains its completion criteria. Isolate adapter sessions and same-project run folders.

Prerequisites — durable identities; project write boundaries; bounded scheduler.

- Implement and verify Sessions remain independent across runs in harness-adapters. Retain acceptance for “Same adapter runs two conversations”, “Cancel one of two adapter sessions”, “One backend is saturated”.
- Implement and verify Projects can host independent concurrent runs in workflow-run. Retain acceptance for “Two runs edit the same project path”, “Cleanup while another run is active”.

### Task 26.5

Parent 26.5 retains its completion criteria. Bind messages, answers and approvals to explicit execution identities.

Prerequisites — durable identities; project write boundaries; bounded scheduler.

- Implement and verify Messages carry complete run and session identity in persona-board. Retain acceptance for “Identical step names in different runs”, “Two watches reconnect”.
- Implement and verify Answers and approvals cannot leak across runs in approvals. Retain acceptance for “Approval for an identical second run”.

### Task 26.6

Parent 26.6 retains its completion criteria. Expose origin filters and independent run handles through CLI, HTTP, MCP and guide examples.

Prerequisites — durable identities; project write boundaries; bounded scheduler.

- Implement and verify Run and request lists support explicit origin filters in backend-selection. Retain acceptance for “Requests filtered to one harness session”, “Unfiltered list spans harnesses”.
- Implement and verify Main-agent tools keep multiple run handles in tool-servers. Retain acceptance for “One connection manages three runs”.
- Implement and verify The guide teaches concurrent workflow ownership in main-agent-guide. Retain acceptance for “Guide demonstrates both concurrency paths”.

### Task 26.7

Parent 26.7 retains its completion criteria. Build the global dashboard and queue telemetry.

Prerequisites — durable identities; project write boundaries; bounded scheduler.

- Implement and verify The overview makes concurrent work visible in run-dashboard. Retain acceptance for “See two harnesses and several workflows”, “Overview changes without opening a run”, “Switch between live run pages”.
- Implement and verify Queue and trace records explain shared capacity in workflow-run. Retain acceptance for “One run waits behind another”.

### Task 26.8

Parent 26.8 retains its completion criteria. Preserve committed hub snapshots and resolved persona choices across concurrent runs.

Prerequisites — durable identities; project write boundaries; bounded scheduler.

- Implement and verify Concurrent runs share only committed knowledge in knowledge-hub. Retain acceptance for “Another run publishes during a search”, “Persona updated while another run uses it”.

### Task 26.9

Parent 26.9 retains its completion criteria. Add deterministic concurrency falsification tests.

Prerequisites — durable identities; project write boundaries; bounded scheduler.

- Implement and verify Concurrency tests must defeat serial implementations in test-strategy. Retain acceptance for “Serial scheduler fails the overlap test”, “Swapped callback fails the isolation test”.

### Task 28.2

Parent 28.2 retains its completion criteria. Extend session ports with ordered events and checkpoint operations. Commit and restore consistent workflow, session and filesystem checkpoints.

Prerequisites — durable executions; retry accounting; native restoration.

- Implement and verify Checkpoints preserve agent and workflow progress together in workflow-run. Retain acceptance for “Resume edited files and conversation”, “Torn checkpoint manifest”, “Two saved vendor sessions”.

### Task 28.3

Parent 28.3 retains its completion criteria. Persist recovery allowances, backoff, execution generations and stale-result rejection.

Prerequisites — durable executions; retry accounting; native restoration.

- Implement and verify Recovery has finite independent allowances and execution ownership in workflow-run. Retain acceptance for “Restart cannot refill retries”, “Stale worker answers after recovery”, “Vendor wait exceeds retry cap”.

### Task 28.4

Parent 28.4 retains its completion criteria. Implement native restoration and explicitly authorized reconstruction per adapter.

Prerequisites — durable executions; retry accounting; native restoration.

- Implement and verify Session restoration capabilities are explicit and tested in harness-adapters. Retain acceptance for “Native session has disappeared”, “Authorized reconstructed agent”, “Old writer still owns required path”.

### Task 28.7

Parent 28.7 retains its completion criteria. Recover interrupted falsifiers, judges and proof tools without regenerating candidates.

Prerequisites — durable executions; retry accounting; native restoration.

- Implement and verify Checker outages never become candidate refutations in step-falsification. Retain acceptance for “Falsifier rate limit”, “Proof process was killed”, “Completed counterexample still rejects”.

### Task 28.8

Parent 28.8 retains its completion criteria. Separate quality outcomes from operational accounting and learning eligibility.

Prerequisites — durable executions; retry accounting; native restoration.

- Implement and verify Operational outcomes do not train quality measures in persona-lifecycle. Retain acceptance for “Outage does not retire a persona”.
- Implement and verify Incomplete runs are ineligible for quality learning in self-training-orchestration. Retain acceptance for “Provider outage cannot teach poor quality”, “Recovered result updates once”.

### Task 33.12

Parent 33.12 retains its completion criteria. Add `workspace.mode` and direct writes to the project. Add a restore point per step and rollback of a refuted step. Run steps on the same file one after another. List the changed files per step.

Prerequisites — repair file safety and production services before broader feature delivery.

- Implement and verify Steps change the real project as they run in workflow-run. Retain acceptance for “A step writes to the project”, “Isolated mode stays available”.
- Implement and verify Every step has a restore point and a refuted step rolls back in workflow-run. Retain acceptance for “Refuted step is rolled back”, “Outside changes stay”.
- Implement and verify Steps that touch the same file run one after another in workflow-run. Retain acceptance for “Same file”, “Different files”.

### Task 33.19

Parent 33.19 retains its completion criteria. Let a step list `allow_folders` for harness folders, bounded by the home setting `workspace.allow_folders`.

Prerequisites — repair file safety and production services before broader feature delivery.

- Implement and verify A step can be allowed into a harness folder in workflow-run. Retain acceptance for “A step writes a skill”, “A folder that was not listed stays closed”, “Git and Titan folders cannot be allowed”, “The owner bounds the request”.

## 2. Pinned backend research and contracts

### Task 1.1

Parent 1.1 retains its completion criteria. Run `env` inside Claude Code, Codex and Antigravity, and save each output with secrets removed in `research/harness-env/`.

Prerequisites — primary documentation; separate live authorization where required.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 1.2

Parent 1.2 retains its completion criteria. Install `@openai/codex-sdk` and run one `thread.run("Say yes")` under Bun.

Prerequisites — primary documentation; separate live authorization where required.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 1.5

Parent 1.5 retains its completion criteria. Find out how Codex sets a persona's tools, skills and system prompt, through `config` or `configOverrides`. Check whether the config key `developer_instructions` sets the role text, and whether `config.mcp_servers` starts a tool server.

Prerequisites — primary documentation; separate live authorization where required.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 1.6

Parent 1.6 retains its completion criteria. Check how each SDK behaves when an agent asks for a permission and nobody answers.

Prerequisites — primary documentation; separate live authorization where required.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 1.7

Parent 1.7 retains its completion criteria. Find out how Codex and Antigravity load a guide like a Claude Code skill.

Prerequisites — primary documentation; separate live authorization where required.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 1.9

Parent 1.9 retains its completion criteria. Load `sqlite-vec` with `bun:sqlite` on macOS and Windows.

Prerequisites — primary documentation; separate live authorization where required.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 1.11

Parent 1.11 retains its completion criteria. Check in each agent tool whether a permission rule can stop the main agent from reading `~/.titan/person-token`.

Prerequisites — primary documentation; separate live authorization where required.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 6.1

Parent 6.1 retains its completion criteria. Write the port `AgentBackend` in `@titan/core`, with `specificationVersion` and the capability flags, and the fake adapter with answer scripts.

Prerequisites — workflow schemas; vendor contract research; native broker.

- Implement and verify One interface for every agent tool in harness-adapters. Retain acceptance for “Same call, any adapter”, “Adapter for another version of the port”.
- Implement and verify Each adapter states what it can do in harness-adapters. Retain acceptance for “Codex adapter flags”.

### Task 6.2

Parent 6.2 retains its completion criteria. Add the schema check with one retry to the shared adapter code.

Prerequisites — workflow schemas; vendor contract research; native broker.

- Implement and verify Answers that break the schema are not used in harness-adapters. Retain acceptance for “Agent answers with the wrong shape twice”.

### Task 6.3

Parent 6.3 retains its completion criteria. Write the Claude adapter with `query()`, passing role text, tools, skills and model, and resuming sessions.

Prerequisites — workflow schemas; vendor contract research; native broker.

- Implement and verify A persona's tools and skills reach its agent in harness-adapters. Retain acceptance for “Claude persona with two tools”.
- Implement and verify An agent's session can continue in harness-adapters. Retain acceptance for “Answer reaches the same session”.
- Implement and verify Claude adapter uses the Claude Agent SDK in harness-adapters. Retain acceptance for “Live Claude agent”.

### Task 6.4

Parent 6.4 retains its completion criteria. Write the Codex adapter with `startThread()` and `run()`, using the findings of tasks 1.2 and 1.5.

Prerequisites — workflow schemas; vendor contract research; native broker.

- Implement and verify Codex adapter uses the Codex SDK in harness-adapters. Retain acceptance for “Codex persona with a tool server”, “Live Codex agent”, “Folder is not a Git repository”.

### Task 6.6

Parent 6.6 retains its completion criteria. Make `titan check` fail for persona fields that an agent tool cannot apply.

Prerequisites — workflow schemas; vendor contract research; native broker.

- Implement and verify A persona's tools and skills reach its agent in harness-adapters. Retain acceptance for “Field an agent tool cannot apply”.

### Task 6.8

Parent 6.8 retains its completion criteria. Write backend choice and `titan backends`.

Prerequisites — workflow schemas; vendor contract research; native broker.

- Implement and verify Each persona can have its own backend in backend-selection. Retain acceptance for “Mixed backends in one run”, “Flag overrides the file”.
- Implement and verify List the backends that are ready in backend-selection. Retain acceptance for “Only the Claude SDK and one key”, “Run with a backend that is not ready”.
- Implement and verify A persona on a model API gets tool servers only in backend-selection. Retain acceptance for “Model API persona with Bash”.

### Task 6.9

Parent 6.9 retains its completion criteria. Check that no API key is written anywhere.

Prerequisites — workflow schemas; vendor contract research; native broker.

- Implement and verify API keys are never stored in backend-selection. Retain acceptance for “Key not in the record”.
- Implement and verify The RunPod key comes only from the environment in runpod-backends. Retain acceptance for “Key not in the record”.

### Task 6.10

Parent 6.10 retains its completion criteria. Write `titan tool-server` with the knowledge hub tools, started for every agent with the run folder and step id.

Prerequisites — workflow schemas; vendor contract research; native broker.

- Implement and verify Every agent gets titan's own tool server in tool-servers. Retain acceptance for “Agent searches the hub during its turn”, “Tool server knows the step”.
- Implement and verify Calls to titan's tool server are logged on the board in tool-servers. Retain acceptance for “Search logged”.
- Implement and verify The bundled bridge verifies its owner before serving in tool-servers. Retain acceptance for “A source CLI process serves scoped tools”, “A bridge receives a substituted execution”, “A readiness inventory changes”, “Standard input ends during bridge use”.
- Implement and verify Native bridge messages and body reads stay bounded in tool-servers. Retain acceptance for “An owner sends an oversized body”, “An owner stalls after sending headers”, “JSON expansion exceeds the stdio budget”, “An owner redirects a credentialed request”.
- Implement and verify Output failure cannot retain a native bridge send in tool-servers. Retain acceptance for “A frame completes under backpressure”, “An output pipe fails or closes”, “An output write stops making progress”, “A bridge closes with an output write pending”.
- Implement and verify Native adapters receive volatile execution bindings in tool-servers. Retain acceptance for “Both SDKs use native tools across resume”, “A native binding substitutes execution scope”, “Claude startup never reaches its role inventory”, “Native credentials would enter launch arguments”.
- Implement and verify Native execution guards last through checkpoint capture in tool-servers. Retain acceptance for “A native worker resumes on the same attempt”, “A credential reaches the checkpoint boundary”, “A native result or diagnostic contains its credential”, “A closed execution sends a late event”.
- Implement and verify The local service composes automatic native tools in tool-servers. Retain acceptance for “Both native backends use automatic scoped tools”, “A scripted native result has no source entry”, “A registration rejects invalid connection data”, “An installed workflow uses the bundled native command”.
- Implement and verify The local service composes automatic native tools in tool-servers. Retain acceptance for “An operator tries the native execution route”.
- Implement and verify Native HTTP startup preserves execution proof in tool-servers. Retain acceptance for “HTTP native bindings retain both backend roles”, “HTTP native binding lacks its readiness port”.
- Implement and verify Native tool audit acknowledgement is durable in tool-servers. Retain acceptance for “Tool response waits for audit”, “Audit write refuses completion”, “Refused calls retain safe metadata”, “Metadata belongs to its execution”.
- Implement and verify Native tool audit acknowledgement is durable in tool-servers. Retain acceptance for “Installed native audit”.
- Implement and verify Native vendor events contain only bounded tool metadata in tool-servers. Retain acceptance for “Vendor events repeat private tool content”, “Projection cannot conceal a credential”, “Invalid vendor metadata fails safely”, “Installed vendor event projection”.

### Task 6.11

Parent 6.11 retains its completion criteria. Pass the persona's `tool_servers` to every adapter and stop a step whose tool server does not start.

Prerequisites — workflow schemas; vendor contract research; native broker.

- Implement and verify A persona can list more tool servers in tool-servers. Retain acceptance for “Same tool server on two backends”, “Name already used”.
- Implement and verify A tool server that does not start stops the step in tool-servers. Retain acceptance for “Command not found”.

### Task 6.12

Parent 6.12 retains its completion criteria. Write the plug-in loader with the version check and the check for a backend id that is already used.

Prerequisites — workflow schemas; vendor contract research; native broker.

- Implement and verify A plug-in package adds backends and embedders in backend-plugins. Retain acceptance for “New vendor from a plug-in”.
- Implement and verify Plug-ins are named, never found by themselves in backend-plugins. Retain acceptance for “Plug-in installed in the project”, “Plug-in not installed”.
- Implement and verify Plug-ins must match the version of the port in backend-plugins. Retain acceptance for “Plug-in for an older port”.
- Implement and verify A backend id is used only once in backend-plugins. Retain acceptance for “Two plug-ins with the same backend”.

### Task 6.13

Parent 6.13 retains its completion criteria. Measure the start time of the tool servers in a run of the code-fix example with the fake adapter.

Prerequisites — workflow schemas; vendor contract research; native broker.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 7.1

Parent 7.1 retains its completion criteria. Write detection from the variables found in task 1.1, the `--harness` flag and the file's `harness` field.

Prerequisites — harness environment research.

- Implement and verify Detect the agent tool from the environment in harness-detection. Retain acceptance for “Started from Claude Code”, “Started from Codex”, “Started from Antigravity”.
- Implement and verify The flag wins over detection in harness-detection. Retain acceptance for “Flag and environment disagree”.
- Implement and verify The workflow file can name the agent tool in harness-detection. Retain acceptance for “Workflow file names Antigravity”.
- Implement and verify Stop with a clear message when no agent tool is found in harness-detection. Retain acceptance for “Run from a plain shell”.
- Implement and verify The detected agent tool gives the default backend in harness-detection. Retain acceptance for “No backend set anywhere”.

## 3. Workflow admission and execution

### Task 3.1

Parent 3.1 retains its completion criteria. Write the zod schema for the goal, personas in three forms, `backend`, steps, groups, `inputs`, limits, judge and `improve`.

Prerequisites — workflow contracts before runner behavior.

- Implement and verify The file states the goal in workflow-file. Retain acceptance for “Goal reaches every agent”.
- Implement and verify Each step defines how to falsify it in workflow-file. Retain acceptance for “Invalid limits fail before work starts”.
- Implement and verify The file sets limits on the work in workflow-file. Retain acceptance for “Defaults apply”.

### Task 3.6

Parent 3.6 retains its completion criteria. Add `call`, `split`, `limits`, `policy` and `approvals` to the schema, and save the full plan as `plan.yaml`.

Prerequisites — workflow contracts before runner behavior.

- Implement and verify The file sets limits on the work in workflow-file. Retain acceptance for “Run limits in the file”.
- Implement and verify The file is the starting plan in workflow-file. Retain acceptance for “Plan after added steps”.

### Task 8.6

Parent 8.6 retains its completion criteria. Write `--dry-run` with the agent count formula and the room left under `max_steps`.

Prerequisites — workflow and workspace contracts.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 8.7

Parent 8.7 retains its completion criteria. Run added steps like the others, with their own folders.

Prerequisites — workflow and workspace contracts.

- Implement and verify Steps added during a run are run like the others in workflow-run. Retain acceptance for “Added step in the record”.

### Task 10.3

Parent 10.3 retains its completion criteria. Retry a refuted step with the evidence, up to `max_attempts`.

Prerequisites — runner attempts; private candidate state.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 10.4

Parent 10.4 retains its completion criteria. Run candidates in parallel and judge the survivors two at a time.

Prerequisites — runner attempts; private candidate state.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 11.8

Parent 11.8 retains its completion criteria. Give the improver the reward and the alarms, and keep kept files as `plan` entries.

Prerequisites — falsification; policy limits; hub publication.

- Implement and verify The improve loop and the policy learn from the same run in self-improving-loop. Retain acceptance for “Improver sees the reward”.

### Task 33.8

Parent 33.8 retains its completion criteria. Run script, agent and improvement steps in one workflow and show each kind in the run record.

Prerequisites — repair file safety and production services before broader feature delivery.

- Implement and verify A workflow can mix agent, script and suggestion stages in workflow-run. Retain acceptance for “Mixed workflow”.

### Task 33.13

Parent 33.13 retains its completion criteria. Run listed checks inside the loop and send failures back to the same builder.

Prerequisites — repair file safety and production services before broader feature delivery.

- Implement and verify Checks run inside the loop in workflow-run. Retain acceptance for “Failing check goes back to the builder”, “Check never passes”.

## 4. Knowledge and persona lifecycle

### Task 4.1

Parent 4.1 retains its completion criteria. Write entry files, ids, versions, `.history/` and `INDEX.md`, with `titan kb add`, `get`, `update` and `delete`.

Prerequisites — entry storage and scoped ownership before consumers.

- Implement and verify Changes from many processes at once are not lost in knowledge-hub. Retain acceptance for “Crash between file and index changes”, “Pending change conflicts with a newer entry”.

### Task 5.4

Parent 5.4 retains its completion criteria. Keep the measures of each persona version and write `titan persona show`.

Prerequisites — persist per-version measures from actual run outcomes; CLI and transport composition.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 5.5

Parent 5.5 retains its completion criteria. Write the six states and the Wilson rules, with each move in the history.

Prerequisites — daemon persona state publication; effective approval; completed result counts.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 5.6

Parent 5.6 retains its completion criteria. Keep old and new versions in use, leave out retired ones, and move deleted ones to `.history/`.

Prerequisites — production lifecycle request handling; durable knowledge publication.

- Implement and verify An update runs next to the old version in persona-lifecycle. Retain acceptance for “Old and new versions both picked”.
- Implement and verify A delete needs the person and keeps the file in persona-lifecycle. Retain acceptance for “Person approves a delete”.

### Task 15.1

Parent 15.1 retains its completion criteria. Start steps from board entries, as soon as their inputs survived and a place is free.

Prerequisites — runner dependencies; bounded capacity; request ledger.

- Implement and verify Limits stop a runaway hive in hive-collaboration. Retain acceptance for “Helper can run with one place”, “Split cannot bypass the work limit”, “Circular help request”.

### Task 15.6

Parent 15.6 retains its completion criteria. Write `max_steps` and `max_parallel`, with one `raise_limit` request.

Prerequisites — runner dependencies; bounded capacity; request ledger.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 15.7

Parent 15.7 retains its completion criteria. Give each worker the step list of its run.

Prerequisites — runner dependencies; bounded capacity; request ledger.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 33.1

Parent 33.1 retains its completion criteria. Add the project hub in the project's `.titan/knowledge`, search both hubs and `titan kb promote`.

Prerequisites — repair file safety and production services before broader feature delivery.

- Implement and verify The hub has a project scope and a home scope in knowledge-hub. Retain acceptance for “A run saves a lesson in the project”, “Search reads both hubs”, “Promote an entry”, “Clone brings the project hub”.

### Task 33.2

Parent 33.2 retains its completion criteria. Make every run read the hub first, give every persona `kb_search` and `kb_add`, and save a lesson for each pass and refutation.

Prerequisites — repair file safety and production services before broader feature delivery.

- Implement and verify The swarm always uses the hub in knowledge-hub. Retain acceptance for “Run reads and writes the hub”, “Persona has hub tools”, “Hub tools are missing”.

## 5. Requests, approvals and orchestration

### Task 9.1

Parent 9.1 retains its completion criteria. Write the board and the request kinds.

Prerequisites — durable board; authenticated request ledger.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 9.4

Parent 9.4 retains its completion criteria. Pause only the asking step, exit with code 3 and write `requests.json`.

Prerequisites — durable board; authenticated request ledger.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 9.5

Parent 9.5 retains its completion criteria. Write `titan answer` and resume with answers.

Prerequisites — durable board; authenticated request ledger.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 9.6

Parent 9.6 retains its completion criteria. Make knowledge hub changes from the tool server private to their candidate attempt until that candidate is kept.

Prerequisites — durable board; authenticated request ledger.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 9.7

Parent 9.7 retains its completion criteria. Add `--yes` and `--to-person` to `titan answer`.

Prerequisites — durable board; authenticated request ledger.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 16.4

Parent 16.4 retains its completion criteria. Make the request tool of `titan mcp` return at once and continue the session later.

Prerequisites — request identities; authenticated authority; durable decisions.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 16.5

Parent 16.5 retains its completion criteria. Write every decision to the board.

Prerequisites — request identities; authenticated authority; durable decisions.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 17.1

Parent 17.1 retains its completion criteria. Write the policy files, the kind of goal and the reward.

Prerequisites — bounded scheduling; verified quality outcomes.

- Implement and verify titan keeps a policy for each kind of goal in self-training-orchestration. Retain acceptance for “Kind from the workflow file”.
- Implement and verify A reward for each run in self-training-orchestration. Retain acceptance for “Reward in the run record”.
- Implement and verify The person sets the price of time and of agents in self-training-orchestration. Retain acceptance for “Weights in the workflow file”.

### Task 17.2

Parent 17.2 retains its completion criteria. Write the split width learner with groups of 4.

Prerequisites — bounded scheduling; verified quality outcomes.

- Implement and verify The policy learns the split width in self-training-orchestration. Retain acceptance for “Width that does better is picked more”.

### Task 17.3

Parent 17.3 retains its completion criteria. Write the two alarms.

Prerequisites — bounded scheduling; verified quality outcomes.

- Implement and verify An alarm for serial collapse in self-training-orchestration. Retain acceptance for “Policy collapsed to one agent”.
- Implement and verify An alarm for empty agents in self-training-orchestration. Retain acceptance for “Too many agents for the parts”.

### Task 17.4

Parent 17.4 retains its completion criteria. Write the trails that fade.

Prerequisites — bounded scheduling; verified quality outcomes.

- Implement and verify Choices that worked leave trails that fade in self-training-orchestration. Retain acceptance for “Trail fades”.

### Task 17.6

Parent 17.6 retains its completion criteria. Keep the policy inside the limits, and write `titan policy show`.

Prerequisites — bounded scheduling; verified quality outcomes.

- Implement and verify The learned policy stays inside the rules in self-training-orchestration. Retain acceptance for “Policy cannot go over the parallel limit”.
- Implement and verify The policy can be read and explained in self-training-orchestration. Retain acceptance for “Show a policy”.

### Task 17.7

Parent 17.7 retains its completion criteria. Write `titan traces export`.

Prerequisites — bounded scheduling; verified quality outcomes.

- Implement and verify Traces can be written for training a model elsewhere in self-training-orchestration. Retain acceptance for “Export traces”.

## 6. Configuration and submitting environments

### Task 29.1

Parent 29.1 retains its completion criteria. Create @titan/config and shared setting metadata without breaking adapter boundaries.

Prerequisites — shared schemas; protected owner settings; stored revisions.

- Implement and verify One package owns setting definitions and schemas in configuration. Retain acceptance for “Changed setting reaches every surface”, “Conflicting local default”.

### Task 29.2

Parent 29.2 retains its completion criteria. Resolve validated user, project, workflow, environment and CLI layers.

Prerequisites — shared schemas; protected owner settings; stored revisions.

- Implement and verify Files and overrides have a declared precedence in configuration. Retain acceptance for “File and workflow override”, “Invalid config cannot start work”.

### Task 29.3

Parent 29.3 retains its completion criteria. Publish default values, units, scopes and protected owner ceilings.

Prerequisites — shared schemas; protected owner settings; stored revisions.

- Implement and verify Defaults and ownership of limits are published in configuration. Retain acceptance for “Workflow cannot override owner ceiling”, “Workflow cannot enable prompt tracing”, “Large plan has an explicit allowance”.

### Task 29.4

Parent 29.4 retains its completion criteria. Freeze effective settings per run and audit approved allowance revisions.

Prerequisites — shared schemas; protected owner settings; stored revisions.

- Implement and verify Runs freeze their effective configuration in configuration. Retain acceptance for “Edited config during a pause”, “Approved extra recovery allowance”.

### Task 29.5

Parent 29.5 retains its completion criteria. Complete configuration commands, saved-run history and format upgrades.

Prerequisites — shared schemas; protected owner settings; stored revisions.

- Implement and verify Configuration tools explain and safely change settings in configuration. Retain acceptance for “Inspect a blocked run config”.

### Task 30.6

Parent 30.6 retains its completion criteria. Bind submitting environment and ephemeral credentials to each run.

Prerequisites — typed transport selectors; lifecycle; safe publication.

- Implement and verify Caller environment and recovery controls remain run scoped in titan-server. Retain acceptance for “Daemon restart loses ephemeral credentials”, “Caller working folders differ”.

## 7. Updates, installation and retained builds

### Task 31.1

Parent 31.1 retains its completion criteria. Pack all runtime dependencies and install outside the checkout using a test registry.

Prerequisites — runtime composition; package closure; installed acceptance.

- Implement and verify Release packages install independently of the monorepo in distribution. Retain acceptance for “Install without workspace links”, “Missing transitive package”, “Secret in package files”.

### Task 31.2

Parent 31.2 retains its completion criteria. Record tested environments and optional capability setup in doctor and installation docs.

Prerequisites — runtime composition; package closure; installed acceptance.

- Implement and verify Environment and optional capabilities are explicit in distribution. Retain acceptance for “Minimal environment first use”, “Unsupported native dependency”.

### Task 31.11

Parent 31.11 retains its completion criteria. Write the update check, the one-line notice and the `update.source` and `update.check` settings.

Prerequisites — runtime composition; package closure; installed acceptance.

- Implement and verify Titan tells the person when a newer version exists in distribution. Retain acceptance for “Newer version exists”, “Check turned off”.

### Task 31.12

Parent 31.12 retains its completion criteria. Write `titan update` with `--check`, `--from`, the backup, the side-by-side install, the doctor gate and the rollback.

Prerequisites — runtime composition; package closure; installed acceptance.

- Implement and verify Titan updates without losing data in distribution. Retain acceptance for “Update that passes”, “Update that fails”.

### Task 31.13

Parent 31.13 retains its completion criteria. Run Titan's own deliveries with the installed `titan` command and document it in `docs/install.md`.

Prerequisites — runtime composition; package closure; installed acceptance.

- Implement and verify The start script only starts the install in distribution. Retain acceptance for “Later steps are commands”.

### Task 31.3

Parent 31.3 retains its completion criteria. Ship and verify the installed mixed-plan interruption recovery preview.

Prerequisites — runtime composition; package closure; installed acceptance.

- Implement and verify A first working version has an executable acceptance path in distribution. Retain acceptance for “Installed preview survives restart”, “Real adapter readiness needs evidence”.

### Task 31.4

Parent 31.4 retains its completion criteria. Ship checked code, document, research and stubbed operation examples.

Prerequisites — runtime composition; package closure; installed acceptance.

- Implement and verify Code documents research and operations have distinct completion evidence in distribution. Retain acceptance for “Remote operation response is lost”, “Research report has uncertainty”.

### Task 31.5

Parent 31.5 retains its completion criteria. Verify shared live self-development with an immutable installed controller and compatible runtime recovery.

Prerequisites — runtime composition; package closure; installed acceptance.

- Implement and verify Titan can develop itself without changing its active runtime in distribution. Retain acceptance for “Titan edits Titan”.

### Task 31.6

Parent 31.6 retains its completion criteria. Falsify recovery across execution, checks and publication boundaries.

Prerequisites — runtime composition; package closure; installed acceptance.

- Implement and verify Recovery falsification covers every phase and installed usage in test-strategy. Retain acceptance for “Recovery mutants are detected”, “Crash at publication boundary”.

### Task 33.9

Parent 33.9 retains its completion criteria. Add `update.mode`, idle-time automatic install, the backup, the data copy upgrade and the return to the old version.

Prerequisites — repair file safety and production services before broader feature delivery.

- Implement and verify Updates can install by themselves without harming the user's work in distribution. Retain acceptance for “Automatic update when idle”, “Active run blocks the update”, “Old data survives”, “Failed update goes back”.

## 8. Operational recovery and cache reporting

### Task 33.6

Parent 33.6 retains its completion criteria. Record the reset time of a usage limit, resume the run at that time, and allow `titan resume --backend`.

Prerequisites — repair file safety and production services before broader feature delivery.

- Implement and verify A blocked run resumes by itself in workflow-run. Retain acceptance for “Limit with a reset time”, “Automatic resume”, “Switch provider on resume”.

### Task 33.7

Parent 33.7 retains its completion criteria. Order prompts with fixed parts first, record cache tokens, show the cache share in `titan status`, add `cache.ttl`, and write the caching research note and settings guide.

Prerequisites — repair file safety and production services before broader feature delivery.

- Implement and verify Runs use prompt caching and report it in workflow-run. Retain acceptance for “Cache fields are recorded”, “Same prefix for the same persona”, “Low cache share is flagged”.

## 9. CLI, dashboard and control surfaces

### Task 12.1

Parent 12.1 retains its completion criteria. Write `titan guide` and `titan schema`.

Prerequisites — command definitions; harness guide formats.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 12.3

Parent 12.3 retains its completion criteria. Check that each agent tool loads the skill and can start it by name, using the findings of task 1.7.

Prerequisites — command definitions; harness guide formats.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 14.1

Parent 14.1 retains its completion criteria. Write `titan serve` on 127.0.0.1 with `server.json`, the person token, the token check and the `Origin` check.

Prerequisites — durable board; server ownership; authenticated routes.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 14.2

Parent 14.2 retains its completion criteria. Write the routes and the server-sent events with `Last-Event-ID`.

Prerequisites — durable board; server ownership; authenticated routes.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 14.3

Parent 14.3 retains its completion criteria. Rebuild every run from its board when the server starts, and mark reruns.

Prerequisites — durable board; server ownership; authenticated routes.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 23.7

Parent 23.7 retains its completion criteria. Send spans over OTLP/HTTP when `OTEL_EXPORTER_OTLP_ENDPOINT` is set, with no prompt text by default.

Prerequisites — stored summaries; authenticated dashboard and event cursors.

- Implement and verify titan can send spans to a trace viewer in workflow-run. Retain acceptance for “Spans reach a fake receiver”, “The receiver is down”.
- Implement and verify Spans hold no prompt or answer text by default in workflow-run. Retain acceptance for “Default spans hold no task text”.

### Task 23.8

Parent 23.8 retains its completion criteria. Add the Jaeger example to the guide.

Prerequisites — stored summaries; authenticated dashboard and event cursors.

- Implement and verify The guide shows how to view spans in a trace viewer in run-dashboard. Retain acceptance for “Jaeger example in the guide”.

### Task 23.9

Parent 23.9 retains its completion criteria. Add opt-in dashboard screenshots to end-to-end failure and review evidence.

Prerequisites — stored summaries; authenticated dashboard and event cursors.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 30.1

Parent 30.1 retains its completion criteria. Define identities and typed selectors across CLI, HTTP and MCP.

Prerequisites — typed transport selectors; lifecycle; safe publication.

- Implement and verify Identifiers and selectors have consistent meanings in cli-control. Retain acceptance for “Repeated workflow gets separate runs”, “Ambiguous run prefix”, “Mutating command without target”.

### Task 30.2

Parent 30.2 retains its completion criteria. Implement detached observation, pause, resume, cancellation and event cursors.

Prerequisites — typed transport selectors; lifecycle; safe publication.

- Implement and verify Run controls expose the whole lifecycle in cli-control. Retain acceptance for “Pause one parallel workflow”.

### Task 30.4

Parent 30.4 retains its completion criteria. Generate checked command references from shared argument definitions.

Prerequisites — typed transport selectors; lifecycle; safe publication.

- Implement and verify Help covers valid combinations and remote parity in cli-control. Retain acceptance for “Conflicting invocation before execution”, “HTTP and MCP recovery parity”.

### Task 30.5

Parent 30.5 retains its completion criteria. Inspect, export and apply checked code and document artifacts with scoped approval.

Prerequisites — typed transport selectors; lifecycle; safe publication.

- Implement and verify Artifacts can be inspected exported and deliberately applied in cli-control. Retain acceptance for “Deliver a document outside Git”, “Target changed before apply”, “Unsafe artifact path”.

### Task 30.7

Parent 30.7 retains its completion criteria. Show dependency and recovery states in the dashboard without quality penalties.

Prerequisites — typed transport selectors; lifecycle; safe publication.

- Implement and verify Recovery and dependency progress are visible in run-dashboard. Retain acceptance for “Rate limit in the dashboard”.

## 10. Proof checks and artifact delivery

### Task 24.1

Parent 24.1 retains its completion criteria. Add `verify` to the workflow schema for the goal and for steps.

Prerequisites — bounded command execution; approval and proof contracts.

- Implement and verify A goal or a step can have proof checks in verified-checks. Retain acceptance for “A check of an unknown kind”.
- Implement and verify Proof inputs and checker availability are explicit in verified-checks. Retain acceptance for “Missing Lean solution”, “Checker not installed”.
- Implement and verify The file can set proof checks on the goal and on steps in workflow-file. Retain acceptance for “A Lean entry without theorems”, “A goal check”.

### Task 24.5

Parent 24.5 retains its completion criteria. Run `lake comparator` on a Linux host as a user that is not root, without Docker's `--privileged`.

Prerequisites — bounded command execution; approval and proof contracts.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 24.6

Parent 24.6 retains its completion criteria. Build the `smt` check on the `z3` program, with `define-fun` values only.

Prerequisites — bounded command execution; approval and proof contracts.

- Implement and verify SMT checks read the answer word of z3 in verified-checks. Retain acceptance for “Three answers with exit code 0”.
- Implement and verify SMT checks find assumptions that contradict in verified-checks. Retain acceptance for “Contradicting assumptions”.

### Task 24.8

Parent 24.8 retains its completion criteria. Run proof checks before falsifier agents, and pass the checker's output to the next attempt. Until formal integration is complete, Lean execution refuses success with an unavailable-checker error after statement approval.

Prerequisites — bounded command execution; approval and proof contracts.

- Implement and verify Proof checks run before the falsifier agents in step-falsification. Retain acceptance for “A failed proof saves the falsifier agent”.
- Implement and verify Each check answers proven, refuted or not proven in verified-checks. Retain acceptance for “Not proven gives a new attempt”.

### Task 24.9

Parent 24.9 retains its completion criteria. Write `proofs.json`, the line "proven N of M" and the counts in `GET /runs/<run id>`.

Prerequisites — bounded command execution; approval and proof contracts.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 24.10

Parent 24.10 retains its completion criteria. Add `titan proof recheck`.

Prerequisites — bounded command execution; approval and proof contracts.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 24.11

Parent 24.11 retains its completion criteria. Count proofs in the reward, the policy and the persona measures.

Prerequisites — bounded command execution; approval and proof contracts.

- Implement and verify Persona measures count proof answers in persona-lifecycle. Retain acceptance for “Proof counts after a run”.
- Implement and verify The reward counts proofs in self-training-orchestration. Retain acceptance for “Reward with a check that is not proven”, “A run without checks”.

### Task 24.12

Parent 24.12 retains its completion criteria. Add the text on proof checks and definitions to the guide and the task.

Prerequisites — bounded command execution; approval and proof contracts.

- Implement and verify The guide asks for proof checks where a claim can be proven in main-agent-guide. Retain acceptance for “Guide text on proof checks”.
- Implement and verify Definitions are copied from the locked statement in verified-checks. Retain acceptance for “Task text of a Lean step”.

### Task 24.13

Parent 24.13 retains its completion criteria. Add a test workflow file in `test/fixtures/` with a `lean` check, the locked statement of the probe, and a fake agent that hands in the real proof.

Prerequisites — bounded command execution; approval and proof contracts.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

## 11. Cross-feature acceptance

### Task 21.1

Parent 21.1 retains its completion criteria. Write the stall count and the `replan` request kind at level `main`.

Prerequisites — runner lifecycle; policy and failure contracts.

- Implement and verify A run that makes no progress gets a new plan in hive-collaboration. Retain acceptance for “Repeated results start a new plan”, “Steady progress never starts a new plan”.

### Task 21.2

Parent 21.2 retains its completion criteria. Add the field `failure` with the 14 failure kinds to the falsifier's answer schema, and count the kinds in `result.md`.

Prerequisites — runner lifecycle; policy and failure contracts.

- Implement and verify A refutation can name its failure kind in step-falsification. Retain acceptance for “Failure kinds in the result”, “Unknown failure kind”.

### Task 21.3

Parent 21.3 retains its completion criteria. Write `candidate_backends` for steps with several candidates.

Prerequisites — runner lifecycle; policy and failure contracts.

- Implement and verify Candidates can run on different backends in step-falsification. Retain acceptance for “Three candidates on two backends”.

### Task 21.4

Parent 21.4 retains its completion criteria. Add the rules on when not to split work to the guide.

Prerequisites — runner lifecycle; policy and failure contracts.

- Implement and verify The guide says when not to split work in main-agent-guide. Retain acceptance for “Guide warns about sequential work”.

### Task 21.5

Parent 21.5 retains its completion criteria. Write the blocking check that no task text holds a key value.

Prerequisites — runner lifecycle; policy and failure contracts.

- Implement and verify A task that holds a key is never sent in backend-selection. Retain acceptance for “Key value in a task”.

### Task 21.6

Parent 21.6 retains its completion criteria. Write `titan trace` with `@opentelemetry/sdk-trace-base`, from `research/probes/swarm/test/otel.test.ts`.

Prerequisites — runner lifecycle; policy and failure contracts.

- Implement and verify titan trace writes the run as spans in workflow-run. Retain acceptance for “Spans of a run with a tool call”.

### Task 21.7

Parent 21.7 retains its completion criteria. Serve the agent card at `/.well-known/agent-card.json`, built with the types of `@a2a-js/sdk`, from `research/probes/swarm/test/a2a.test.ts`.

Prerequisites — runner lifecycle; policy and failure contracts.

- Implement and verify The server shows an agent card in titan-server. Retain acceptance for “Card without a token”.

### Task 22.2

Parent 22.2 retains its completion criteria. Write the hub's durable change record and crash recovery.

Prerequisites — file and process safety; production composition; complete acceptance.

- Implement and verify Private edits use an observed attempt revision in knowledge-hub. Retain acceptance for “Two writes share one private revision”, “An attempt edits its pending entry twice”, “An attempt cancels its new entry”.
- Implement and verify Private search has one consistent scoped view in knowledge-hub. Retain acceptance for “A private search replaces final matches”, “Publication fails while a private search waits”, “Private result metadata reaches the byte limit”.

### Task 22.3

Parent 22.3 retains its completion criteria. Add `plan` entries and one persona path.

Prerequisites — file and process safety; production composition; complete acceptance.

- Implement and verify Plan entries can be rebuilt and searched in knowledge-hub. Retain acceptance for “Plan survives reindexing”.

### Task 22.4

Parent 22.4 retains its completion criteria. Enforce persona deletion approval through every hub tool and CLI path.

Prerequisites — file and process safety; production composition; complete acceptance.

- Implement and verify The swarm can use the hub during a run in knowledge-hub. Retain acceptance for “Hub delete cannot bypass persona approval”.

### Task 22.6

Parent 22.6 retains its completion criteria. Check resolved persona identities, numeric limits and candidate backend lists.

Prerequisites — file and process safety; production composition; complete acceptance.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 22.7

Parent 22.7 retains its completion criteria. Count every agent role and split part under run limits.

Prerequisites — file and process safety; production composition; complete acceptance.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 22.8

Parent 22.8 retains its completion criteria. Run candidate attempts and script falsifiers on the shared live tree with blackboard scope negotiation and immutable evidence generations.

Prerequisites — file and process safety; production composition; complete acceptance.

- Implement and verify Candidates negotiate shared live files in workflow-run. Retain acceptance for “Two candidates edit the same file”.

### Task 22.9

Parent 22.9 retains its completion criteria. Persist resolved run choices and make events a view of the board.

Prerequisites — file and process safety; production composition; complete acceptance.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 22.10

Parent 22.10 retains its completion criteria. Journal external actions and route SDK and script permissions through approvals.

Prerequisites — file and process safety; production composition; complete acceptance.

- Implement and verify Initial plans and added work use the same approval rules in approvals. Retain acceptance for “Initial tool server needs approval”.
- Implement and verify Recovery does not repeat an uncertain external action in titan-server. Retain acceptance for “Crash after an external action”.

### Task 22.11

Parent 22.11 retains its completion criteria. Keep the original RunPod deadline on restart and resume.

Prerequisites — file and process safety; production composition; complete acceptance.

- Implement and verify A run that reaches its time limit ends as timed out in runpod-backends. Retain acceptance for “Restart cannot reset the hour”.

### Task 22.12

Parent 22.12 retains its completion criteria. Scope paid-compute approvals and report cancel failures without claiming the worker stopped.

Prerequisites — file and process safety; production composition; complete acceptance.

- Implement and verify Only the person can lower a level in approvals. Retain acceptance for “Paid compute cannot become automatic”.
- Implement and verify The person approves paid compute in runpod-backends. Retain acceptance for “Cancel call fails”.

### Task 22.13

Parent 22.13 retains its completion criteria. Bundle the remote hub snapshot and return pending changes with worker results.

Prerequisites — file and process safety; production composition; complete acceptance.

- Implement and verify A remote worker uses a hub snapshot in runpod-backends. Retain acceptance for “Remote worker changes the hub”.

### Task 22.15

Parent 22.15 retains its completion criteria. Limit dry-run counts to known work and avoid loading plug-ins.

Prerequisites — file and process safety; production composition; complete acceptance.

- Implement and verify Show the cost before a run in workflow-run. Retain acceptance for “Dry run cannot bound an unknown split”.

### Task 22.16

Parent 22.16 retains its completion criteria. Restore the historical quote corpus with source ids and hashes, without changing quoted passages.

Prerequisites — file and process safety; production composition; complete acceptance.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 22.17

Parent 22.17 retains its completion criteria. Run a clean-install release test from the packed package for each claimed platform.

Prerequisites — file and process safety; production composition; complete acceptance.

- Implement and verify A release proves installation and use in dev-standards. Retain acceptance for “Packed package misses a helper”.

### Task 22.19

Parent 22.19 retains its completion criteria. Close SDK permission and person-token access questions before claiming human-only approval.

Prerequisites — file and process safety; production composition; complete acceptance.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 22.20

Parent 22.20 retains its completion criteria. Add cancellation and cleanup to the session port and each adapter.

Prerequisites — file and process safety; production composition; complete acceptance.

- Implement and verify Sessions can be cancelled and closed in harness-adapters. Retain acceptance for “Cancel a running fake session”.

### Task 22.21

Parent 22.21 retains its completion criteria. Make empty rewards finite and policy updates replay-safe.

Prerequisites — file and process safety; production composition; complete acceptance.

- Implement and verify A reward for each run in self-training-orchestration. Retain acceptance for “Empty run has a finite reward”, “Restart cannot learn twice from one run”.

### Task 25.1

Parent 25.1 retains its completion criteria. Accept checks across `falsify` and `verify` for initial and added steps.

Prerequisites — existing acceptance-map ownership; execution and request safety.

- Implement and verify Any agent can add steps in hive-collaboration. Retain acceptance for “Added step without a falsifier”.
- Implement and verify A goal or a step can have proof checks in verified-checks. Retain acceptance for “A step with a Lean check”.

### Task 25.2

Parent 25.2 retains its completion criteria. Validate safe names, paths, symlinks and unknown fields.

Prerequisites — existing acceptance-map ownership; execution and request safety.

- Implement and verify Names and paths stay within their stores in workflow-file. Retain acceptance for “Step id escapes the run folder”, “Statement symlink escapes the project”, “Misspelled field”.

### Task 25.3

Parent 25.3 retains its completion criteria. Assemble final outputs and fail the run on a failed goal check.

Prerequisites — existing acceptance-map ownership; execution and request safety.

- Implement and verify The final result and goal failure are explicit in workflow-run. Retain acceptance for “Goal check fails after all steps pass”.

### Task 25.4

Parent 25.4 retains its completion criteria. Preserve attempt accounting through restart, duplicate resume and cancellation.

Prerequisites — existing acceptance-map ownership; execution and request safety.

- Implement and verify Cancellation is durable and repeatable in workflow-run. Retain acceptance for “Late result after cancellation”.

### Task 25.5

Parent 25.5 retains its completion criteria. Implement ordered split outputs, empty splits and conflict-checked file assembly.

Prerequisites — existing acceptance-map ownership; execution and request safety.

- Implement and verify Split parts produce one ordered output in hive-collaboration. Retain acceptance for “Parts finish out of order”, “Empty split”.
- Implement and verify Parallel files merge only without conflicts in workflow-run. Retain acceptance for “Parallel kept files conflict”, “Sequential file changes use the later result”.

### Task 25.6

Parent 25.6 retains its completion criteria. Charge helpers and improvement work to the common allowance.

Prerequisites — existing acceptance-map ownership; execution and request safety.

- Implement and verify All requested work has a finite allowance in hive-collaboration. Retain acceptance for “Helpers exhaust the work allowance”, “Losing candidate adds steps”.
- Implement and verify The loop cannot grant itself more work in self-improving-loop. Retain acceptance for “Evaluation cannot nest the loop”, “No time left for improvement”.

### Task 25.7

Parent 25.7 retains its completion criteria. Reject executable changes and removed checks before improvement model review.

Prerequisites — existing acceptance-map ownership; execution and request safety.

- Implement and verify The loop cannot grant itself more work in self-improving-loop. Retain acceptance for “Improver adds a proof script”, “Improver removes a proof check”.

### Task 25.8

Parent 25.8 retains its completion criteria. Save complete check identities and immutable recheck inputs.

Prerequisites — existing acceptance-map ownership; execution and request safety.

- Implement and verify The run record holds every check answer in verified-checks. Retain acceptance for “Counts in result.md”.
- Implement and verify Anyone can check a proof again in verified-checks. Retain acceptance for “Recheck of a finished run”.
- Implement and verify Recheck detects changed evidence in verified-checks. Retain acceptance for “Recheck input changed”.
- Implement and verify Script checks compare answers from the same files in verified-checks. Retain acceptance for “First script execution edits a file”.

### Task 25.9

Parent 25.9 retains its completion criteria. Validate SMT input types and assumptions before claim checks.

Prerequisites — existing acceptance-map ownership; execution and request safety.

- Implement and verify SMT checks read the answer word of z3 in verified-checks. Retain acceptance for “An agent tries to add an assertion”.
- Implement and verify SMT values have a declared shape in verified-checks. Retain acceptance for “Assumptions cannot be checked”.

### Task 25.10

Parent 25.10 retains its completion criteria. Scope approvals, client paths, dashboard login and event cursors.

Prerequisites — existing acceptance-map ownership; execution and request safety.

- Implement and verify Approval names the exact operation in approvals. Retain acceptance for “Approved command changes”.
- Implement and verify Every client uses the same home and project context in titan-server. Retain acceptance for “Two projects use one server”.
- Implement and verify Events are delivered from a durable cursor in titan-server. Retain acceptance for “Event arrives during reconnect”, “Future event cursor”.

### Task 25.11

Parent 25.11 retains its completion criteria. Render untrusted dashboard text safely and label incomplete usage totals.

Prerequisites — existing acceptance-map ownership; execution and request safety.

- Implement and verify Untrusted record text is shown as text in run-dashboard. Retain acceptance for “Evidence contains browser code”, “One backend omits cost”.

### Task 25.12

Parent 25.12 retains its completion criteria. Publish pending hub sets atomically and serialize persona versions.

Prerequisites — existing acceptance-map ownership; execution and request safety.

- Implement and verify Publication conflicts are visible in the run outcome in knowledge-hub. Retain acceptance for “One of two pending entries conflicts”, “Attempt reads its own update”.
- Implement and verify Run history is replay-safe in persona-registry. Retain acceptance for “Two runs create a persona version”, “Replay does not increase persona uses”.

### Task 25.13

Parent 25.13 retains its completion criteria. Implement seeded policy updates, cold starts and bounded alarm scores.

Prerequisites — existing acceptance-map ownership; execution and request safety.

- Implement and verify Learning uses a defined update and one owner in self-training-orchestration. Retain acceptance for “First policy result”, “Concurrent policy updates”.
- Implement and verify Reward measurements have one denominator in self-training-orchestration. Retain acceptance for “Goal fails despite surviving steps”.
- Implement and verify Alarm adjustments are explicit and bounded in self-training-orchestration. Retain acceptance for “Parallel limit prevents width above one”.

### Task 25.14

Parent 25.14 retains its completion criteria. Make readiness depend on platform evidence and enforce secret checks before disk writes.

Prerequisites — existing acceptance-map ownership; execution and request safety.

- Implement and verify Secrets are checked before records are persisted in backend-selection. Retain acceptance for “Key in the workflow source”, “Backend answer echoes a key”.

### Task 25.15

Parent 25.15 retains its completion criteria. Write the benchmark protocol with task set, repeat count, rubric, budgets and promotion rules before collecting outcomes.

Prerequisites — existing acceptance-map ownership; execution and request safety.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 25.16

Parent 25.16 retains its completion criteria. Run the authorized comparison of single-agent, fixed and adaptive workflows.

Prerequisites — existing acceptance-map ownership; execution and request safety.

- Implement and verify Effectiveness claims need a fixed comparison in dev-standards. Retain acceptance for “Reward rises but correctness falls”.

### Task 25.17

Parent 25.17 retains its completion criteria. Enforce child-process isolation and separate live-test groups.

Prerequisites — existing acceptance-map ownership; execution and request safety.

- Implement and verify Live enablement is scoped to its test group in test-strategy. Retain acceptance for “Live flag with default tests”.

### Task 25.18

Parent 25.18 retains its completion criteria. Enforce stage reporting and full-release completeness.

Prerequisites — existing acceptance-map ownership; execution and request safety.

- Implement and verify Delivery stages have separate evidence gates in dev-standards. Retain acceptance for “Preview presented as a full release”.
- Implement and verify Staged builds expose all unbuilt scenarios in test-strategy. Retain acceptance for “Pending scenario on a full release”, “Completed task has no executable test”.

### Task 25.19

Parent 25.19 retains its completion criteria. Add an explicit backend and permission support matrix.

Prerequisites — existing acceptance-map ownership; execution and request safety.

- Implement and verify SDK bindings are verified against pinned primary sources in harness-adapters. Retain acceptance for “Researched SDK option is unavailable”.
- Implement and verify Ambiguous detection needs an explicit choice in harness-detection. Retain acceptance for “Two harness variables”, “Explicit API backend in a plain shell”.

### Task 25.20

Parent 25.20 retains its completion criteria. Apply the paid boundary to vLLM requests and document endpoint billing.

Prerequisites — existing acceptance-map ownership; execution and request safety.

- Implement and verify vLLM requests obey the paid run boundary in runpod-backends. Retain acceptance for “vLLM reaches its deadline”.

### Task 25.21

Parent 25.21 retains its completion criteria. Version stored formats and verify upgrade refusal and rollback before changing them.

Prerequisites — existing acceptance-map ownership; execution and request safety.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 25.22

Parent 25.22 retains its completion criteria. Enforce host-bound session capabilities and read-only reviewer tools.

Prerequisites — existing acceptance-map ownership; execution and request safety.

- Implement and verify Tool authority comes from the session scope in tool-servers. Retain acceptance for “Candidate forges another attempt id”, “Judge tries to change the hub”.
- Implement and verify The local owner bounds and revokes native tool authority in tool-servers. Retain acceptance for “A worker tries to replace its bound scope”, “A checker reaches a missing final file”, “Revocation drains one admitted call”, “Queued authority becomes obsolete”.
- Implement and verify Execution guards apply through file capture in workflow-run. Retain acceptance for “A minted credential appears in file content”, “A credential crosses a file chunk boundary”, “A credential appears in a relative path”, “An additional guard keeps environment protection”.
- Implement and verify Native HTTP startup preserves execution proof in tool-servers. Retain acceptance for “HTTP native scope differs from its credential”.

### Task 25.23

Parent 25.23 retains its completion criteria. Gate plug-in imports and reuse only scoped bundled-server approvals.

Prerequisites — existing acceptance-map ownership; execution and request safety.

- Implement and verify A scoped tool approval can cover repeated bundled starts in approvals. Retain acceptance for “Bundled server starts for a second worker”, “Workflow names an unapproved plug-in”.
- Implement and verify Import approval has a preflight path in backend-plugins. Retain acceptance for “Approve a plug-in before validation continues”.

### Task 25.24

Parent 25.24 retains its completion criteria. Separate provisional improvement summaries from terminal accounting.

Prerequisites — existing acceptance-map ownership; execution and request safety.

- Implement and verify Improvement has an execution phase and a final accounting phase in self-improving-loop. Retain acceptance for “Improvement overhead is counted once”.

## 12. Engineering rules and verification performance

### Task 20.1

Parent 20.1 retains its completion criteria. Write the fixed embedder in `@titan/embedder-fake`, which gives the same vector for the same text.

Prerequisites — owning feature contracts; offline fixtures; live authorization where named.

- Implement and verify Each outside service has a tested fake in test-strategy. Retain acceptance for “Same text, same vector”.

### Task 20.3

Parent 20.3 retains its completion criteria. Write the fake agent programs `test/fixtures/fake-claude.ts`, `test/fixtures/fake-codex.ts` and `test/fixtures/fake-agy.ts`, and the test helper for the person, which answers requests with the person token.

Prerequisites — owning feature contracts; offline fixtures; live authorization where named.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 20.4

Parent 20.4 retains its completion criteria. Write one contract test for the backend port and one for the embedder port, from `research/probes/dev-standards/test/backend-contract.ts`.

Prerequisites — owning feature contracts; offline fixtures; live authorization where named.

- Implement and verify Each port has one contract test for the fake and for the real service in test-strategy. Retain acceptance for “Contract on the fake and on the mock model”, “Contract on the live service”.

### Task 20.6

Parent 20.6 retains its completion criteria. Write unit tests for the reward, the fading counts, the split width, the limits and the approval levels. Each gets the spec examples and a property test with seed 42.

Prerequisites — owning feature contracts; offline fixtures; live authorization where named.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 20.7

Parent 20.7 retains its completion criteria. Write the integration tests for the runner with the board, and for the server on port 0. Also test each tool server in memory, and the RunPod backends with the fake RunPod server.

Prerequisites — owning feature contracts; offline fixtures; live authorization where named.

- Implement and verify A guard file blocks the network, other programs and keys in test-strategy. Retain acceptance for “Local server allowed”.
- Implement and verify Integration tests join the real parts of titan with fakes in test-strategy. Retain acceptance for “A hive run with fakes”, “The person's folder is not touched”.
- Implement and verify Each scenario is a test case with the same name in test-strategy. Retain acceptance for “A scenario with no test”, “A test for a scenario that does not exist”.

### Task 20.8

Parent 20.8 retains its completion criteria. Set up StrykerJS with its command runner on `bun test` for `policy`, `falsify`, `registry` and `workflow`, to run once a day and before each release.

Prerequisites — owning feature contracts; offline fixtures; live authorization where named.

- Implement and verify Coverage and mutation bars show that the tests check the code in test-strategy. Retain acceptance for “Mutation report”.

### Task 20.9

Parent 20.9 retains its completion criteria. Measure line coverage and the mutation score on the first four packages.

Prerequisites — owning feature contracts; offline fixtures; live authorization where named.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 20.10

Parent 20.10 retains its completion criteria. Make each live agent test start from an empty `TITAN_HOME` and run 3 times.

Prerequisites — owning feature contracts; offline fixtures; live authorization where named.

- Implement and verify A live agent test starts clean and runs three times in test-strategy. Retain acceptance for “Live result with two of three”.

### Task 20.11

Parent 20.11 retains its completion criteria. Write the check that runs after each live test and looks for the value of each set key variable.

Prerequisites — owning feature contracts; offline fixtures; live authorization where named.

- Implement and verify No key is ever written to the repository or the record in dev-standards. Retain acceptance for “Key value in a record file”.

### Task 20.12

Parent 20.12 retains its completion criteria. Write the release script that raises the major version of `@titan/core` for a commit with `!`.

Prerequisites — owning feature contracts; offline fixtures; live authorization where named.

- Implement and verify Versions follow SemVer in dev-standards. Retain acceptance for “A breaking port change”.

### Task 27.1

Parent 27.1 retains its completion criteria. Configure pinned, read-only commit and push hooks.

Prerequisites — working-tree policies; isolated tests; complete local gates.

- Implement and verify Local hooks run bounded checks without rebuilding the product in dev-standards. Retain acceptance for “Ordinary push does not run the full pipeline”, “Staged content differs from the working file”, “Local checker is missing”.

### Task 27.2

Parent 27.2 retains its completion criteria. Implement affected-package selection across complete outgoing ranges and reverse dependencies.

Prerequisites — working-tree policies; isolated tests; complete local gates.

- Implement and verify Affected checks include downstream users and uncertain changes in dev-standards. Retain acceptance for “Shared contract changes downstream behavior”, “Earlier outgoing commit is missed by a head-only diff”, “Deleted dependency edge hides a consumer”, “New branch has no usable comparison base”.
- Implement and verify Affected checks include downstream users and uncertain changes in dev-standards. Retain acceptance for “Unstaged fix cannot certify a pushed commit”.

### Task 27.3

Parent 27.3 retains its completion criteria. Reuse only exact successful check receipts if reuse is needed.

Prerequisites — working-tree policies; isolated tests; complete local gates.

- Implement and verify Reused check results match their complete inputs in dev-standards. Retain acceptance for “Fixture changes after a passing check”, “Working copy passes but staged snapshot fails”, “Interrupted test leaves an old receipt”.

### Task 27.4

Parent 27.4 retains its completion criteria. Measure hook and CI duration on named host configurations.

Prerequisites — working-tree policies; isolated tests; complete local gates.

- Implement and verify Check speed is measured without dropping required work in dev-standards. Retain acceptance for “Fast push omits a required check”, “A slow check is visible”.

### Task 27.5

Parent 27.5 retains its completion criteria. Configure shared code style and boundary validation.

Prerequisites — working-tree policies; isolated tests; complete local gates.

- Implement and verify Engineering rules match the reference project in dev-standards. Retain acceptance for “Malformed vendor data enters a typed path”, “A pure calculation has a rationale comment”.

### Task 27.6

Parent 27.6 retains its completion criteria. Enforce public exports and an acyclic declared package graph.

Prerequisites — working-tree policies; isolated tests; complete local gates.

- Implement and verify Packages expose one checked dependency direction in dev-standards. Retain acceptance for “Deep import bypasses a public contract”, “Manifest cycle spans packages”, “Product code imports a test fixture”, “Later-stage package is not created yet”.

### Task 27.7

Parent 27.7 retains its completion criteria. Organize test tiers and bound isolated test workers.

Prerequisites — working-tree policies; isolated tests; complete local gates.

- Implement and verify Test tiers have one home and independent lifecycles in test-strategy. Retain acceptance for “Parallel tests do not share a home”, “Unit test starts a server”, “Global mock leaks into another file”.

### Task 27.8

Parent 27.8 retains its completion criteria. Exercise real adapters with versioned vendor response stubs.

Prerequisites — working-tree policies; isolated tests; complete local gates.

- Implement and verify Vendor stubs exercise the actual adapters in test-strategy. Retain acceptance for “Adapter drops a required request field”, “Vendor stream stops before completion”, “Cancellation reaches a fake vendor process”, “Unexpected vendor call cannot succeed”.

### Task 27.9

Parent 27.9 retains its completion criteria. Add independent documentation checks and remove test-driven page generation.

Prerequisites — working-tree policies; isolated tests; complete local gates.

- Implement and verify Documentation has its own small checks in test-strategy. Retain acceptance for “Passing tests leave documentation unchanged”, “Documented command no longer exists”, “Invalid example is caught without vendors”.

### Task 27.10

Parent 27.10 retains its completion criteria. Verify full-check completeness, source coverage and check configuration.

Prerequisites — working-tree policies; isolated tests; complete local gates.

- Implement and verify The complete gate verifies all required scope once in test-strategy. Retain acceptance for “New source is never imported by tests”, “Full check silently omits end-to-end files”, “Documentation build is added to pre-push”.

### Task 32.1

Parent 32.1 retains its completion criteria. Reconcile every applicable reference rule into DEV_RULES, a blocking job registry and negative fixtures.

Prerequisites — DEV_RULES ownership; blocking checks; negative fixtures.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 32.2

Parent 32.2 retains its completion criteria. Repair all source ownership, schema, enum, literal, message, error, configuration, async, lazy and bounded-state violations.

Prerequisites — DEV_RULES ownership; blocking checks; negative fixtures.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 32.3

Parent 32.3 retains its completion criteria. Complete the package and module reorganization, including runner, board, workspace, runtime composition and transport boundaries.

Prerequisites — DEV_RULES ownership; blocking checks; negative fixtures.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 32.4

Parent 32.4 retains its completion criteria. Deliver the technical documents, development and testing guides, canonical harness skills, commands and knowledge-record workflow.

Prerequisites — DEV_RULES ownership; blocking checks; negative fixtures.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 32.5

Parent 32.5 retains its completion criteria. Verify staged content and outgoing revisions with the complete applicable guardrails and stubbed E2E coverage.

Prerequisites — DEV_RULES ownership; blocking checks; negative fixtures.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

## 13. Release evidence

### Task 19.2

Parent 19.2 retains its completion criteria. Write readable behavior documents and check them independently from end-to-end tests.

Prerequisites — implemented workflows; independent document checks.

- Implement and verify End-to-end tests run titan as a person or a program would in test-strategy. Retain acceptance for “A failing scenario publishes nothing”.

### Task 19.3

Parent 19.3 retains its completion criteria. Run one example in each real agent tool.

Prerequisites — implemented workflows; independent document checks.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 19.4

Parent 19.4 retains its completion criteria. Run the live main-agent test in each agent tool.

Prerequisites — implemented workflows; independent document checks.

- Implement and verify The main agent can design and run a workflow from a problem alone in main-agent-guide. Retain acceptance for “Live main agent in Claude Code”.
- Implement and verify The workflow file is written by the main agent in workflow-file. Retain acceptance for “Person only describes the problem”.

### Task 33.11

Parent 33.11 retains its completion criteria. Put real run proof in the repository: the run folders, the project hub entries and the `titan status` cache numbers, each linked from `docs/evidence.md`.

Prerequisites — repair file safety and production services before broader feature delivery.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

## 14. Deferred backend delivery

### Task 1.3

Parent 1.3 retains its completion criteria. Install `google-antigravity` with pip and run Google's example from Python.

Prerequisites — primary documentation; separate live authorization where required.

Keep this other-backend work deferred until its delivery is explicitly scheduled.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 1.4

Parent 1.4 retains its completion criteria. Find out how the Antigravity SDK sets a persona's tools, skills and system prompt, and whether a chat can continue.

Prerequisites — primary documentation; separate live authorization where required.

Keep this other-backend work deferred until its delivery is explicitly scheduled.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 1.8

Parent 1.8 retains its completion criteria. Make one live call to each of the Anthropic, OpenAI and Gemini model APIs through the AI SDK. Each call asks for a structured answer and calls one tool of a test tool server.

Prerequisites — primary documentation; separate live authorization where required.

Keep this other-backend work deferred until its delivery is explicitly scheduled.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 1.10

Parent 1.10 retains its completion criteria. With `RUNPOD_API_KEY` set by the person, run one job on a RunPod queue endpoint whose `ttl` ends while it runs. Also make one tool call on a vLLM endpoint.

Prerequisites — primary documentation; separate live authorization where required.

Keep this other-backend work deferred until its delivery is explicitly scheduled.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.

### Task 6.5

Parent 6.5 retains its completion criteria. Write the Python helper and the Antigravity adapter, using the findings of tasks 1.3 and 1.4.

Prerequisites — workflow schemas; vendor contract research; native broker.

Keep this other-backend work deferred until its delivery is explicitly scheduled.

- Implement and verify Antigravity adapter uses the Antigravity SDK through a Python helper in harness-adapters. Retain acceptance for “Live Antigravity agent”, “Python package missing”.

### Task 6.7

Parent 6.7 retains its completion criteria. Write the one model API adapter on the AI SDK for the three vendors, using the findings of task 1.8.

Prerequisites — workflow schemas; vendor contract research; native broker.

Keep this other-backend work deferred until its delivery is explicitly scheduled.

- Implement and verify Six backends in backend-selection. Retain acceptance for “Same step on a model API”.
- Implement and verify A persona on a model API gets tool servers only in backend-selection. Retain acceptance for “Model API persona uses the hub”.

### Task 18.1

Parent 18.1 retains its completion criteria. Write the plug-in `@titan/backend-runpod` with `runpod-vllm` and `runpod-worker`, from the probe in `research/probes/runpod/`.

Prerequisites — RunPod research; backend plug-in port; explicit paid authorization.

Keep this other-backend work deferred until its delivery is explicitly scheduled.

- Implement and verify Two RunPod backends from one plug-in in runpod-backends. Retain acceptance for “Backend listed when the plug-in is loaded”.
- Implement and verify The RunPod key comes only from the environment in runpod-backends. Retain acceptance for “Key not set”.

### Task 18.2

Parent 18.2 retains its completion criteria. Write `titan backends --probe` and the tool rules for both backends.

Prerequisites — RunPod research; backend plug-in port; explicit paid authorization.

Keep this other-backend work deferred until its delivery is explicitly scheduled.

- Implement and verify A vLLM persona gets tools only through tool servers in runpod-backends. Retain acceptance for “Model without tool calls”.
- Implement and verify A worker on RunPod uses no local tool servers in runpod-backends. Retain acceptance for “Local tool server on a worker”.

### Task 18.3

Parent 18.3 retains its completion criteria. Write the run clock, the limits on each job and the cancel before the deadline.

Prerequisites — RunPod research; backend plug-in port; explicit paid authorization.

Keep this other-backend work deferred until its delivery is explicitly scheduled.

- Implement and verify A run that uses RunPod lasts at most 1 hour in runpod-backends. Retain acceptance for “Limit above one hour”.
- Implement and verify RunPod jobs receive the remaining deadline and cancellation in runpod-backends. Retain acceptance for “Short jobs inside the hour”, “A 2-hour job is stopped”, “Open jobs are cancelled at the deadline”, “Too little time left”.

### Task 18.4

Parent 18.4 retains its completion criteria. End a run at its time limit as `timed_out`.

Prerequisites — RunPod research; backend plug-in port; explicit paid authorization.

- Implement and verify A run that reaches its time limit ends as timed out in runpod-backends. Retain acceptance for “Result after a timeout”.

### Task 18.5

Parent 18.5 retains its completion criteria. Send the `paid_compute` request before the first job.

Prerequisites — RunPod research; backend plug-in port; explicit paid authorization.

Keep this other-backend work deferred until its delivery is explicitly scheduled.

- Implement and verify The person approves paid compute in runpod-backends. Retain acceptance for “Paid compute request”.

### Task 18.6

Parent 18.6 retains its completion criteria. Write the `titan worker` handler and its container file.

Prerequisites — RunPod research; backend plug-in port; explicit paid authorization.

Keep this other-backend work deferred until its delivery is explicitly scheduled.

- Review the parent criteria through the normal public entry points. Retain its complete mapped cases, including negative cases, and obtain source and installed acceptance before changing completion status.
