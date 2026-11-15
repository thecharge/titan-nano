The [delivery sessions](research/delivery-sessions.md) group open work by dependency and preserve each parent task and its acceptance scenarios.

Implementation follows the delivery stages in design decision 36. Work on each package together with its mapped tests. The acceptance map records planned coverage, not tests that passed. All checkboxes below describe product work and remain open until their evidence exists.

The [shared fabric delivery sequence](research/shared-fabric-delivery.md) expands the live-tree coordination and recovery work into bounded implementation sessions. It preserves the owning tasks and their complete acceptance scenarios. Other applicable backlog still needs its own detailed execution sequence; this document does not close repair task 5.2.

## 1. Check the facts that are still open

- [ ] 1.1 Run `env` inside Claude Code, Codex and Antigravity, and save each output with secrets removed in `research/harness-env/`. Done when each file exists and the variable for each tool is named in `research/harness-env/README.md`.
- [ ] 1.2 Install `@openai/codex-sdk` and run one `thread.run("Say yes")` under Bun. Done when the output is saved in `research/codex-under-bun.txt` and the design's Codex decision says whether a Node.js process is needed.
- [ ] 1.3 Install `google-antigravity` with pip and run Google's example from Python. Done when the output is saved in `research/antigravity-sdk.txt`.
- [ ] 1.4 Find out how the Antigravity SDK sets a persona's tools, skills and system prompt, and whether a chat can continue. Done when `research/antigravity-sdk.md` answers each point with a source link or a test output.
- [ ] 1.5 Find out how Codex sets a persona's tools, skills and system prompt, through `config` or `configOverrides`. Check whether the config key `developer_instructions` sets the role text, and whether `config.mcp_servers` starts a tool server. Done when `research/codex-persona.md` answers each point with a source link or a test output, and the design's open question on `developer_instructions` has an answer.
- [ ] 1.6 Check how each SDK behaves when an agent asks for a permission and nobody answers. Done when `research/permissions.md` describes each SDK and the design's open question on default permissions has an answer.
- [ ] 1.7 Find out how Codex and Antigravity load a guide like a Claude Code skill. Done when `research/guide-formats.md` names the file and folder for each, with a source link.
- [ ] 1.8 Make one live call to each of the Anthropic, OpenAI and Gemini model APIs through the AI SDK. Each call asks for a structured answer and calls one tool of a test tool server. Done when `research/model-apis.md` holds the output of each call. The package names and key variable names are already in `research/probes/backend-port/versions.txt`.
- [ ] 1.9 Load `sqlite-vec` with `bun:sqlite` on macOS and Windows. Done when the outputs are saved in `research/probes/knowledge-hub/` and the design's open question on this has an answer.
- [ ] 1.10 With `RUNPOD_API_KEY` set by the person, run one job on a RunPod queue endpoint whose `ttl` ends while it runs. Also make one tool call on a vLLM endpoint. Done when `research/runpod-live.md` says whether the worker stopped, whether the model made the tool call, and names the model.
- [ ] 1.11 Check in each agent tool whether a permission rule can stop the main agent from reading `~/.titan/person-token`. Done when `research/person-token.md` names the rule for each tool, with a test output.

## 2. Set up the monorepo

- [x] 2.1 Create the Bun workspace with `apps/cli` and the foundation packages, with shared versions in the root catalog. Add remaining packages with their implementation. Done when installation and foundation tests pass without empty later-stage packages.
- [x] 2.2 Add the `titan` command and its 35 subcommands, each printing "not built yet". Done when `bun apps/cli/src/main.ts --help` lists all 34. The subcommands are:
  - `guide`
  - `schema`
  - `install`
  - `check`
  - `run`
  - `resume`
  - `answer`
  - `approve`
  - `deny`
  - `requests`
  - `improve`
  - `lessons`
  - `plans`
  - `policy`
  - `traces`
  - `persona`
  - `kb`
  - `backends`
  - `doctor`
  - `serve`
  - `mcp`
  - `worker`
  - `tool-server`
  - `trace`
  - `dashboard`
  - `update`
  - `proof`
  - `config`
  - `runs`
  - `status`
  - `events`
  - `pause`
  - `cancel`
  - `artifacts`
  - `apply`
- [x] 2.3 Add `--json` and the fixed exit codes to every command. Done when ordinary commands print one JSON object, protocol commands reject `--json`, and `serve --json` prints readiness.
- [x] 2.4 Write the test that reads every `package.json` and checks the rule on dependencies between the core, the adapters and `apps/cli`. Done when the scenario "Wrong dependency" passes.
- [x] 2.5 Write the root `tsconfig.json` in strict mode, with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`, and a test that reads every package's `tsconfig.json`. Done when the scenarios "Unchecked index" and "A package turns strict off" pass.
- [x] 2.6 Write the root `biome.json` with the recommended rules, the `project` domain and `noFloatingPromises` as an error, from `research/probes/dev-standards/lintcase-src/`. Done when the scenarios "A promise with no await" and "An import cycle" pass.
- [x] 2.7 Write the guard file `testing/support/guard.ts` from `research/probes/dev-standards/test/no-network.ts`, load it in the root `bunfig.toml` with `[test] preload`, and write its tests. Done when the scenarios "Keys set, no real call", "A vendor API is blocked", "node:https is blocked", "The real agent program is blocked", "A shell cannot get around the list" and "Fake agent program allowed" pass.
- [x] 2.8 Write the helper that skips a `.live.test.ts` test unless its `TITAN_LIVE_*` variable is `1`, and fails it when a key it needs is not set. Done when the scenarios "No live variable" and "Live variable without its key" pass.
- [x] 2.9 Write `tooling/scripts/check-scenarios.ts` from `research/probes/dev-standards/src/scenario-map.ts`. Use `research/acceptance-map.tsv` for task ownership and report unbuilt cases as pending. Done when missing, duplicate and unknown mappings fail, and completed tasks cannot retain pending cases.
- [x] 2.10 Write `tooling/scripts/check-commits.ts` from `research/probes/dev-standards/src/commit-check.ts`, checking only commits after this rule. Done when the scenarios "Subject in the old form" and "Subject in the new form" pass.
- [x] 2.11 Set explicit 90 % line and function coverage thresholds in the root `bunfig.toml`. Done when the scenario "Coverage under the bar" passes.
- [x] 2.12 Add the script `check` to the root `package.json`, with its 19 steps in order. Done when the scenarios "All steps pass", "A failing step stops the check" and "Documentation-only change skips the suite" pass.
- [x] 2.13 Enforce local outgoing verification and the user's GitHub Actions restriction. Done when "A push that breaks a test" and "GitHub Actions requires explicit authorization" pass through local fixtures, tracked workflows are absent, and the disabled repository setting is verified before publication.
- [x] 2.14 Write the test that checks that each package in the catalog of the root `package.json` is named in `design.md`. Done when the scenario "A new dependency" passes.

## 3. Build the workflow file

- [ ] 3.1 Write the zod schema for the goal, personas in three forms, `backend`, steps, groups, `inputs`, limits, judge and `improve`. Done when the tests for every scenario in spec workflow-file pass.
- [x] 3.2 Add the checks that every step has a check in `falsify` or `verify`, that the falsifier is not the worker's persona, and that every persona name exists. Done when the scenarios "Step without falsification", "Worker checks itself" and "Unknown persona" pass.
- [x] 3.3 Add the checks on `inputs`: the step finishes first, and the formats match. Done when the scenarios "Input from a step in the same parallel group" and "Formats do not match" pass.
- [x] 3.4 Write `titan check`, which prints `ok` or each error with its path. Done when the scenario "Missing goal" passes.
- [x] 3.5 Write the four example files: code fix, science claim, business plan and everyday problem. Done when the scenario "All examples pass the check" passes.
- [ ] 3.6 Add `call`, `split`, `limits`, `policy` and `approvals` to the schema, and save the full plan as `plan.yaml`. Done when the scenarios "Open call and split", "Run limits in the file", "Plan after added steps" and "Unknown policy field" pass.

## 4. Build the knowledge hub

- [ ] 4.1 Write entry files, ids, versions, `.history/` and `INDEX.md`, with `titan kb add`, `get`, `update` and `delete`. Done when the scenarios "Add a fact", "Index after an add" and "Update keeps the old version" pass.
- [x] 4.2 Add word search with FTS5 and readable results. Done when the scenarios "Word search shows why it matched" and "Result fields" pass.
- [x] 4.3 Add meaning search with `@huggingface/transformers` and `sqlite-vec`, and the `both` mode. Done when the scenarios "Meaning search finds a related entry without the same words" and "Word search works without the vector parts" pass.
- [x] 4.4 Write `titan kb reindex`. Done when the scenario "Index file deleted" passes.
- [x] 4.5 Add the version check and `busy_timeout` to every change of an entry. Done when the scenario "Eight writers at once" passes.
- [x] 4.6 Put meaning search behind the port `Embedder`, with `@titan/embedder-local` as the default, and record the embedder's name in `knowledge.db`. Done when the scenario "Embedder changed" passes.

## 5. Build the persona register

- [x] 5.1 Save personas in the hub with versions, `use` and `mutates`, and `TITAN_HOME`. Done when the scenarios "New persona from a run", "Other home folder", "Mutate a judge" and "Unknown version" pass.
- [x] 5.2 Add persona search with history. Done when the scenario "Find a skeptic" passes.
- [x] 5.3 Update each persona's history after a run. Done when the scenario "History after a run" passes.
- [ ] 5.4 Keep the measures of each persona version and write `titan persona show`. Done when the scenario "Measures after a run" passes.
- [ ] 5.5 Write the six states and the Wilson rules, with each move in the history. Done when the scenarios "A good persona becomes proven", "Not enough results yet" and "A weak persona needs an update" pass.
- [ ] 5.6 Keep old and new versions in use, leave out retired ones, and move deleted ones to `.history/`. Done when the scenarios "Old and new versions both picked", "Search leaves out a retired persona" and "Person approves a delete" pass.
- [x] 5.7 Offer near duplicates as a merge. Done when the scenario "Two skeptics" passes.
- [x] 5.8 Write the persona pick with Thompson sampling, fading counts and a probability floor that sums to at most 1. Done when the scenarios "Persona that got better is found" and "Floor for a slightly worse persona" pass.

## 6. Build the adapters and backends

- [ ] 6.1 Write the port `AgentBackend` in `@titan/core`, with `specificationVersion` and the capability flags, and the fake adapter with answer scripts. Done when the scenarios "Scripted answers", "Same call, any adapter", "Adapter for another version of the port" and "Codex adapter flags" pass.
- [ ] 6.2 Add the schema check with one retry to the shared adapter code. Done when the scenario "Agent answers with the wrong shape twice" passes.
- [ ] 6.3 Write the Claude adapter with `query()`, passing role text, tools, skills and model, and resuming sessions. Done when the scenarios "Claude persona with two tools" and "Answer reaches the same session" pass, the live scenario "Live Claude agent" passes with `TITAN_LIVE_CLAUDE=1`, and the output is saved in `research/live/claude.txt`.
- [ ] 6.4 Write the Codex adapter with `startThread()` and `run()`, using the findings of tasks 1.2 and 1.5. Done when the live scenario "Live Codex agent" and the scenarios "Folder is not a Git repository" and "Codex persona with a tool server" pass, and the output is saved in `research/live/codex.txt`.
- [ ] 6.5 Write the Python helper and the Antigravity adapter, using the findings of tasks 1.3 and 1.4. Done when the live scenario "Live Antigravity agent" and the scenario "Python package missing" pass, and the output is saved in `research/live/antigravity.txt`.
- [ ] 6.6 Make `titan check` fail for persona fields that an agent tool cannot apply. Done when the scenario "Field an agent tool cannot apply" passes.
- [ ] 6.7 Write the one model API adapter on the AI SDK for the three vendors, using the findings of task 1.8. Done when the scenarios "Same step on a model API" and "Model API persona uses the hub" pass with the fake HTTP answers, and one live call per vendor is saved in `research/live/model-apis.txt`.
- [ ] 6.8 Write backend choice and `titan backends`. Done when the scenarios "Mixed backends in one run", "Flag overrides the file", "Only the Claude SDK and one key", "Run with a backend that is not ready" and "Model API persona with Bash" pass.
- [ ] 6.9 Check that no API key is written anywhere. Done when the scenario "Key not in the record" passes.
- [ ] 6.10 Write `titan tool-server` with the knowledge hub tools, started for every agent with the run folder and step id. Done when the scenarios "Agent searches the hub during its turn", "Tool server knows the step" and "Search logged" pass.
- [ ] 6.11 Pass the persona's `tool_servers` to every adapter and stop a step whose tool server does not start. Done when the scenarios "Same tool server on two backends", "Name already used" and "Command not found" pass.
- [ ] 6.12 Write the plug-in loader with the version check and the check for a backend id that is already used. Done when the scenarios "New vendor from a plug-in", "Plug-in installed in the project", "Plug-in not installed", "Plug-in for an older port" and "Two plug-ins with the same backend" pass.
- [ ] 6.13 Measure the start time of the tool servers in a run of the code-fix example with the fake adapter. Done when the time for each agent is saved in `research/tool-server-start.txt`.
- [x] 6.14 Add `defaults.model` as a name without a version. Done when the scenarios "Default model applies to a persona without a model", "Persona model wins", "No model set anywhere" and "A model with a version is refused" pass.

## 7. Find the agent tool

- [ ] 7.1 Write detection from the variables found in task 1.1, the `--harness` flag and the file's `harness` field. Done when every scenario in spec harness-detection passes, except "Doctor inside Claude Code".
- [x] 7.2 Write `titan doctor`. Done when the scenario "Doctor inside Claude Code" passes.

## 8. Run a workflow

- [x] 8.1 Write the runner for sequential and parallel groups. Done when the scenarios "Parallel steps overlap" and "Sequential steps do not overlap" pass.
- [x] 8.2 Pass kept outputs to steps through `inputs`. Done when the scenario "Outputs flow through inputs" passes.
- [x] 8.3 Stop a branch when a step fails. Done when the scenario "One parallel branch fails" passes.
- [x] 8.4 Write the run record: `workflow.yaml`, `events.jsonl`, `board.jsonl`, `steps/` and `result.md`. Done when the scenario "Record after a passing run" passes.
- [x] 8.5 Write `titan resume`. Done when the scenario "Resume after a crash" passes.
- [ ] 8.6 Write `--dry-run` with the agent count formula and the room left under `max_steps`. Done when the scenario "Dry run of a step with candidates" passes.
- [ ] 8.7 Run added steps like the others, with their own folders. Done when the scenario "Added step in the record" passes.

## 9. Build the board and requests

- [ ] 9.1 Write the board and the request kinds. Done when the scenarios "Board after a run with a question", "Parallel steps write at the same time" and "Unknown request kind" pass.
- [x] 9.2 Answer `ask` requests and continue the asking session. Done when the scenario "Answer reaches the asking agent" passes. Native process and installed acceptance prove automatic helper dispatch and continuation for Codex and Claude. Raised approval remains waiting.
- [x] 9.3 Give each agent only its own messages. Done when the scenario "Falsifier does not see board questions" passes.
- [ ] 9.4 Pause only the asking step, exit with code 3 and write `requests.json`. Done when the scenario "Persona asks for a tool" passes.
- [ ] 9.5 Write `titan answer` and resume with answers. Done when the scenarios "Tool given and run resumed", "Request denied" and "Resume with an open request" pass.
- [ ] 9.6 Make knowledge hub changes from the tool server private to their candidate attempt until that candidate is kept. Done when the scenarios "Refuted step's fact is undone" and "Surviving step's fact is kept" pass.
- [ ] 9.7 Add `--yes` and `--to-person` to `titan answer`. Done when the scenario "Request accepted as sent" passes.

## 10. Falsify every step

- [x] 10.1 Run persona and script falsifiers on each result. Done when the scenarios "All falsifiers fail to refute", "One falsifier refutes" and "Refuted without evidence" pass.
- [x] 10.2 Give falsifiers only the goal, the task, the result and their own task. Done when the scenarios "Falsifier task content" and "Falsifier does not see the worker's session" pass.
- [ ] 10.3 Retry a refuted step with the evidence, up to `max_attempts`. Done when the scenarios "Survives on the second attempt" and "Never survives" pass.
- [ ] 10.4 Run candidates in parallel and judge the survivors two at a time. Done when the scenarios "Three candidates, two survive", "One candidate survives", "No candidate survives" and "Judge picks B" pass.

## 11. Build the self-improving loop

- [x] 11.1 Start the improver with the workflow file and the run record. Done when the scenario "Improver gets the record" passes.
- [x] 11.2 Add the three checks for a new file, including the rule against new or changed scripts. Done when the scenarios "Improver removes a falsifier", "Improver adds a script", "New file is better" and "New file does worse" pass.
- [x] 11.3 Save kept files as `<name>.v<N>.yaml` and never touch the main agent's file. Done when the scenario "Second improvement" passes.
- [x] 11.4 Run the set number of rounds and stop early when nothing is kept. Done when the scenario "Two rounds, second keeps nothing" passes.
- [x] 11.5 Save lessons in the hub and as new persona versions. Done when the scenario "Lesson from a refutation" passes.
- [x] 11.6 Write `titan lessons`. Done when the scenario "Lessons before a new design" passes.
- [x] 11.7 Write `titan improve <run id>`. Done when the scenario "Improve an earlier run" passes.
- [ ] 11.8 Give the improver the reward and the alarms, and keep kept files as `plan` entries. Done when the scenario "Improver sees the reward" passes.

## 12. Write the guide for the main agent

- [ ] 12.1 Write `titan guide` and `titan schema`. Done when the scenarios "Guide lists the steps" and "Schema in the guide matches titan schema" pass.
- [x] 12.2 Write `titan install --harness claude|codex|antigravity`, with the plug-in folder, the skill and `titan mcp`. Done when the scenarios "Install into a project", "Install for Codex", "Someone else's file is there" and "Skill header" pass.
- [ ] 12.3 Check that each agent tool loads the skill and can start it by name, using the findings of task 1.7. Done when each agent tool finds the guide in a live test, saved in `research/live/guide-<tool>.txt`.

## 13. Control from other programs

- [x] 13.1 Export `runWorkflow()`, `resumeRun()` and `answerRequest()` from `@titan/runner`, with events as an async iterator. Done when the scenario "A program runs a workflow" passes. Evidence is recorded in `../repair-harness-delivery/evidence.md` under program API acceptance.
- [x] 13.2 Check that the HTTP API gives the same events as the command line. Done when the scenario "A program uses the HTTP API" passes. Evidence is recorded in `../repair-harness-delivery/evidence.md` under program API acceptance.

## 14. Build the titan server

- [ ] 14.1 Write `titan serve` on 127.0.0.1 with `server.json`, the person token, the token check and the `Origin` check. Done when the scenarios "Server starts", "No token" and "Foreign web page" pass.
- [ ] 14.2 Write the routes and the server-sent events with `Last-Event-ID`. Done when the scenarios "Start a run over HTTP" and "Reconnect during a run" pass.
- [ ] 14.3 Rebuild every run from its board when the server starts, and mark reruns. Done when the scenario "Server restarts during a run" passes.
- [x] 14.4 Make the commands clients that start a server when none runs. Done when the scenario "No server running" passes.
- [x] 14.5 Write `titan mcp` with tools that return at once. Done when the scenario "Main agent starts a run from its tool" passes.

## 15. Build the hive

- [ ] 15.1 Start steps from board entries, as soon as their inputs survived and a place is free. Done when the scenario "A step starts when its input survives" passes.
- [x] 15.2 Write `add_step` with the checks, and act on it only after the sender survives. Done when the scenarios "A planner adds three steps", "Added step without a falsifier" and "Steps from a refuted result are dropped" pass.
- [x] 15.3 Write open calls with the persona pick from task 5.8. Done when the scenarios "Open call answered from the register" and "No persona fits the call" pass.
- [x] 15.4 Write `split` with a width from the file or the policy. Done when the scenario "Width set in the file" passes.
- [x] 15.5 Run many runs on one server, each with its own board. Done when the scenario "Two runs at once" passes.
- [ ] 15.6 Write `max_steps` and `max_parallel`, with one `raise_limit` request. Done when the scenario "Runaway agent" passes.
- [ ] 15.7 Give each worker the step list of its run. Done when the scenario "Worker prompt holds the step list" passes.

## 16. Build the approvals

- [x] 16.1 Write the request kinds with their default levels, and the levels in `~/.titan/config.yaml`. Done when the scenarios "Default level for a tool", "Workflow file tries to lower a level" and "Config tries to lower a fixed level" pass.
- [x] 16.2 Write `--to-person`, `titan approve`, `titan deny` and the person token check. Done when the scenarios "Main agent asks the person" and "Main agent answers for the person" pass.
- [x] 16.3 Write the version check on answers. Done when the scenario "Two answers at the same time" passes.
- [ ] 16.4 Make the request tool of `titan mcp` return at once and continue the session later. Done when the scenario "Tool returns while the request waits" passes.
- [ ] 16.5 Write every decision to the board. Done when the scenario "Automatic decision" passes.

## 17. Build the self-training orchestration

- [ ] 17.1 Write the policy files, the kind of goal and the reward. Done when the scenarios "Kind from the workflow file", "Reward in the run record" and "Weights in the workflow file" pass.
- [ ] 17.2 Write the split width learner with groups of 4. Done when the scenario "Width that does better is picked more" passes.
- [ ] 17.3 Write the two alarms. Done when the scenarios "Policy collapsed to one agent" and "Too many agents for the parts" pass.
- [ ] 17.4 Write the trails that fade. Done when the scenario "Trail fades" passes.
- [x] 17.5 Keep plans in the hub and write `titan plans`. Done when the scenario "Plans before a new design" passes.
- [ ] 17.6 Keep the policy inside the limits, and write `titan policy show`. Done when the scenarios "Policy cannot go over the parallel limit" and "Show a policy" pass.
- [ ] 17.7 Write `titan traces export`. Done when the scenario "Export traces" passes.

## 18. Build the RunPod backends

- [ ] 18.1 Write the plug-in `@titan/backend-runpod` with `runpod-vllm` and `runpod-worker`, from the probe in `research/probes/runpod/`. Done when the scenarios "Backend listed when the plug-in is loaded", "Key not set" and "Key not in the record" pass with the fake RunPod endpoint. Both "Key not in the record" scenarios, in spec backend-selection and spec runpod-backends, must pass.
- [ ] 18.2 Write `titan backends --probe` and the tool rules for both backends. Done when the scenarios "Model without tool calls" and "Local tool server on a worker" pass.
- [ ] 18.3 Write the run clock, the limits on each job and the cancel before the deadline. Done when the scenarios "Limit above one hour", "Short jobs inside the hour", "A 2-hour job is stopped", "Open jobs are cancelled at the deadline" and "Too little time left" pass.
- [ ] 18.4 End a run at its time limit as `timed_out`. Done when the scenario "Result after a timeout" passes.
- [ ] 18.5 Send the `paid_compute` request before the first job. Done when the scenario "Paid compute request" passes.
- [ ] 18.6 Write the `titan worker` handler and its container file. Done when one live job on RunPod, after task 1.10, is saved in `research/live/runpod.txt`.

## 19. Test end to end and check separate documents

- [x] 19.1 Write one end-to-end test for each example file that runs `titan` with the fake adapter. Done when all four pass with `bun test`.
- [ ] 19.2 Write readable behavior documents and check them independently from end-to-end tests. Done when documentation checks pass and "A failing scenario publishes nothing" leaves existing documents unchanged.
- [ ] 19.3 Run one example in each real agent tool. Done when the three run records are saved in `research/live/` and each `result.md` shows every step as `passed`.
- [ ] 19.4 Run the live main-agent test in each agent tool. Done when the scenarios "Person only describes the problem" and "Live main agent in Claude Code" pass, and the transcripts are saved in `research/live/main-agent-<tool>.txt`.

## 20. Build the fakes, contracts and test bars

Do each task here together with the package that it names. For example, do 20.2 with task 6.1.

- [ ] 20.1 Write the fixed embedder in `@titan/embedder-fake`, which gives the same vector for the same text. Done when the scenario "Same text, same vector" passes.
- [x] 20.2 Make the fake backend throw on a task that it has no script for, and name the task. Done when the scenario "Unscripted call to the fake backend" passes.
- [ ] 20.3 Write the fake agent programs `test/fixtures/fake-claude.ts`, `test/fixtures/fake-codex.ts` and `test/fixtures/fake-agy.ts`, and the test helper for the person, which answers requests with the person token. Done when each fake has a test that passes.
- [ ] 20.4 Write one contract test for the backend port and one for the embedder port, from `research/probes/dev-standards/test/backend-contract.ts`. Done when the scenario "Contract on the fake and on the mock model" passes. The scenario "Contract on the live service" passes after task 1.8, with `TITAN_LIVE_API=1`.
- [x] 20.5 Write the unit tests of the Wilson bound in `@titan/registry`, from `research/probes/dev-standards/test/wilson.test.ts`. Done when the scenarios "Wilson bound examples" and "Wilson bound property" pass.
- [ ] 20.6 Write unit tests for the reward, the fading counts, the split width, the limits and the approval levels. Each gets the spec examples and a property test with seed 42. Done when each rule has both kinds of test and they pass.
- [ ] 20.7 Write the integration tests for the runner with the board, and for the server on port 0. Also test each tool server in memory, and the RunPod backends with the fake RunPod server. Done when the scenarios "A hive run with fakes", "The person's folder is not touched" and "Local server allowed" pass.
- [ ] 20.8 Set up StrykerJS with its command runner on `bun test` for `policy`, `falsify`, `registry` and `workflow`, to run once a day and before each release. Done when the scenario "Mutation report" passes.
- [ ] 20.9 Measure line coverage and the mutation score on the first four packages. Done when the numbers are saved in `research/test-bars.txt`, and a new decision in `design.md` keeps or changes the bars of 90 % and 80 %.
- [ ] 20.10 Make each live agent test start from an empty `TITAN_HOME` and run 3 times. Done when the scenario "Live result with two of three" passes with a fake agent that fails once.
- [ ] 20.11 Write the check that runs after each live test and looks for the value of each set key variable. Done when the scenario "Key value in a record file" passes with a made-up key.
- [ ] 20.12 Write the release script that raises the major version of `@titan/core` for a commit with `!`. Done when the scenario "A breaking port change" passes.

## 21. Add the ideas from other multi-agent frameworks

Each task here starts from the probe in `research/probes/swarm/`.

- [ ] 21.1 Write the stall count and the `replan` request kind at level `main`. Done when the scenarios "Repeated results start a new plan" and "Steady progress never starts a new plan" pass with the fake backend.
- [ ] 21.2 Add the field `failure` with the 14 failure kinds to the falsifier's answer schema, and count the kinds in `result.md`. Done when the scenarios "Failure kinds in the result" and "Unknown failure kind" pass.
- [ ] 21.3 Write `candidate_backends` for steps with several candidates. Done when the scenario "Three candidates on two backends" passes with two fake backends.
- [ ] 21.4 Add the rules on when not to split work to the guide. Done when the scenario "Guide warns about sequential work" passes.
- [ ] 21.5 Write the blocking check that no task text holds a key value. Done when the scenario "Key value in a task" passes with a made-up key.
- [ ] 21.6 Write `titan trace` with `@opentelemetry/sdk-trace-base`, from `research/probes/swarm/test/otel.test.ts`. Done when the scenario "Spans of a run with a tool call" passes.
- [ ] 21.7 Serve the agent card at `/.well-known/agent-card.json`, built with the types of `@a2a-js/sdk`, from `research/probes/swarm/test/a2a.test.ts`. Done when the scenario "Card without a token" passes.

## 22. Close the readiness review before release

Do each task with the package it changes, before its first end-to-end test. The review is in `research/readiness-review.md`.

- [x] 22.1 Add candidate and attempt ids to pending hub changes. Done when the refuted-attempt and losing-candidate scenarios in spec knowledge-hub pass.
- [ ] 22.2 Write the hub's durable change record and crash recovery. Done when its crash and version-conflict scenarios pass, including a failure before and after each file rename.
- [ ] 22.3 Add `plan` entries and one persona path. Done when "Plan survives reindexing" and all persona file scenarios pass after deleting the index.
- [ ] 22.4 Enforce persona deletion approval through every hub tool and CLI path. Done when "Hub delete cannot bypass persona approval" passes.
- [x] 22.5 Apply the persona probability floor to any number of eligible versions. Done when "More than ten matching versions" and the existing pick scenarios pass.
- [ ] 22.6 Check resolved persona identities, numeric limits and candidate backend lists. Done when the new workflow-file scenarios pass before any program starts.
- [ ] 22.7 Count every agent role and split part under run limits. Done when the helper, circular-request and split-limit scenarios in spec hive-collaboration pass.
- [ ] 22.8 Run candidate attempts and script falsifiers on the shared live tree with blackboard scope negotiation and immutable evidence generations. Done when "Two candidates edit the same file" passes with ordered conflicting writes, generation-bound checks and preserved external edits.
- [ ] 22.9 Persist resolved run choices and make events a view of the board. Done when the restart, torn-line and second-server scenarios in spec titan-server pass.
- [ ] 22.10 Journal external actions and route SDK and script permissions through approvals. Done when "Crash after an external action" and "Initial tool server needs approval" pass.
- [ ] 22.11 Keep the original RunPod deadline on restart and resume. Done when "Restart cannot reset the hour" passes with a fake clock.
- [ ] 22.12 Scope paid-compute approvals and report cancel failures without claiming the worker stopped. Done when "Paid compute cannot become automatic" and "Cancel call fails" pass.
- [ ] 22.13 Bundle the remote hub snapshot and return pending changes with worker results. Done when "Remote worker changes the hub" passes with no host token in the job.
- [x] 22.14 Implement final JSON objects and protocol exceptions. Done when "JSON run output has one object" passes and MCP protocol tests see no progress logs.
- [ ] 22.15 Limit dry-run counts to known work and avoid loading plug-ins. Done when "Dry run cannot bound an unknown split" passes.
- [ ] 22.16 Restore the historical quote corpus with source ids and hashes, without changing quoted passages. Done when the existing quote checker finds all 156 passages offline.
- [ ] 22.17 Run a clean-install release test from the packed package for each claimed platform. Done when the release scenario in spec dev-standards passes and results name each verified backend.
- [x] 22.18 Prove the default test guard blocks child Bun code and Git hooks from reaching the network. Done when both bypass attempts fail with keys removed in an isolated test environment.
- [ ] 22.19 Close SDK permission and person-token access questions before claiming human-only approval. Done when each released backend has tests proving denied access or a documented trusted-agent limitation.
- [ ] 22.20 Add cancellation and cleanup to the session port and each adapter. Done when "Cancel a running fake session" passes and live adapter tests prove their cancellation path.
- [ ] 22.21 Make empty rewards finite and policy updates replay-safe. Done when "Empty run has a finite reward" and "Restart cannot learn twice from one run" pass without changing configured weights.

## 23. Build the dashboard and the span export

The evidence is in `research/dashboard.md`, and the probe is in `research/probes/dashboard/`.

- [x] 23.1 Add the dashboard page to `packages/server` with a Bun HTML import and the header `Content-Security-Policy: default-src 'self'`. Done when "The page loads only from titan" in spec run-dashboard passes.
- [x] 23.2 Add `titan dashboard`, the one-time code and the cookie. Done when "Login and a second try with the same code", "No cookie" and "Call from another site" pass, and no log holds the code.
- [x] 23.3 Compute the run numbers from `events.jsonl` in one function that both the API and the page use. Done when "A past run and a running run" and "Cost not reported" pass.
- [x] 23.4 Build the run page with steps, attempts, verdicts, proofs, board messages and open requests. Done when "A refuted attempt and a proof" passes.
- [x] 23.5 Send live events to the page over server-sent events. Done when "A new event during a run" and "Connect again after a break" pass.
- [x] 23.6 Keep the dashboard read-only. Done when "A change through the dashboard", "The cookie on an API route that answers a request" and the titan-server cookie scenarios pass.
- [ ] 23.7 Send spans over OTLP/HTTP when `OTEL_EXPORTER_OTLP_ENDPOINT` is set, with no prompt text by default. Done when "Spans reach a fake receiver", "The receiver is down" and "Default spans hold no task text" in spec workflow-run pass against a fake receiver on 127.0.0.1.
- [ ] 23.8 Add the Jaeger example to the guide. Done when "Jaeger example in the guide" passes, and a live test with `TITAN_LIVE_JAEGER=1` reads 4 spans back from Jaeger 2.22.0.
- [ ] 23.9 Add opt-in dashboard screenshots to end-to-end failure and review evidence. Done when optional test evidence links screenshots to their run without generating or changing documentation.

## 24. Build the proof checks

The evidence is in `research/proofs.md`, and the probe is in `research/probes/proofs/`.

- [ ] 24.1 Add `verify` to the workflow schema for the goal and for steps. Done when "A Lean entry without theorems", "A goal check" and "A check of an unknown kind" pass.
- [x] 24.2 Add the `lock_statement` request, the copy in `locked/` and the hash on the board. Done when "Lock request with its text", "The locked file is changed during a run" and "The statement waits for approval" pass.
- [x] 24.3 Build the `lean` check on `lake comparator` with a pinned toolchain, a fresh folder, no network and a time limit. Done when "The five cheats of the probe", "A real proof" and "A check that runs too long" pass with the six files of `research/probes/proofs/lean/cases/`.
- [x] 24.4 Refuse `lean` checks outside Linux. Done when "Lean check on macOS" passes.
- [ ] 24.5 Run `lake comparator` on a Linux host as a user that is not root, without Docker's `--privileged`. Done when the five cheats and the real proof give the same answers as in `cases-v7.out`, or a new decision says how `titan` runs the sandbox.
- [ ] 24.6 Build the `smt` check on the `z3` program, with `define-fun` values only. Done when "Three answers with exit code 0", "An agent tries to add an assertion" and "Contradicting assumptions" pass.
- [x] 24.7 Build the `script` check and its second run. Done when "A script that changes its answer" passes.
- [ ] 24.8 Run proof checks before falsifier agents, and pass the checker's output to the next attempt. Until formal integration is complete, Lean execution refuses success with an unavailable-checker error after statement approval. Done when "A failed proof saves the falsifier agent" and "Not proven gives a new attempt" pass.
- [ ] 24.9 Write `proofs.json`, the line "proven N of M" and the counts in `GET /runs/<run id>`. Done when "Counts in result.md" passes.
- [ ] 24.10 Add `titan proof recheck`. Done when "Recheck of a finished run" passes.
- [ ] 24.11 Count proofs in the reward, the policy and the persona measures. Done when "Reward with a check that is not proven", "A run without checks" and "Proof counts after a run" pass.
- [ ] 24.12 Add the text on proof checks and definitions to the guide and the task. Done when "Guide text on proof checks" and "Task text of a Lean step" pass.
- [ ] 24.13 Add a test workflow file in `test/fixtures/` with a `lean` check, the locked statement of the probe, and a fake agent that hands in the real proof. Done when `titan run` on it with the fake adapter ends with "proven 2 of 2" on Linux.

## 25. Implement the reconciled end-to-end contracts

Do these tasks with the owning package in the delivery stage named by the acceptance map.

- [ ] 25.1 Accept checks across `falsify` and `verify` for initial and added steps. Done when proof-only steps pass validation and unchecked steps fail before execution.
- [ ] 25.2 Validate safe names, paths, symlinks and unknown fields. Done when all new workflow-file rejection scenarios pass.
- [ ] 25.3 Assemble final outputs and fail the run on a failed goal check. Done when "Goal check fails after all steps pass" passes.
- [ ] 25.4 Preserve attempt accounting through restart, duplicate resume and cancellation. Done when the new workflow-run recovery and late-result scenarios pass.
- [ ] 25.5 Implement ordered split outputs, empty splits and conflict-checked file assembly. Done when split-order, empty-list and parallel-file-conflict cases pass.
- [ ] 25.6 Charge helpers and improvement work to the common allowance. Done when helper exhaustion and nested-evaluation cases pass without exceeding limits.
- [ ] 25.7 Reject executable changes and removed checks before improvement model review. Done when proof-script addition and proof-check removal are rejected.
- [ ] 25.8 Save complete check identities and immutable recheck inputs. Done when proof-summary, changed-input and same-files script cases pass without rewriting earlier evidence.
- [ ] 25.9 Validate SMT input types and assumptions before claim checks. Done when malformed values and unknown assumptions cannot give `proven`.
- [ ] 25.10 Scope approvals, client paths, dashboard login and event cursors. Done when changed-command, two-project and reconnect-race cases pass.
- [ ] 25.11 Render untrusted dashboard text safely and label incomplete usage totals. Done when browser-code and partial-cost cases pass.
- [ ] 25.12 Publish pending hub sets atomically and serialize persona versions. Done when publication-conflict, own-update and concurrent-version cases pass.
- [ ] 25.13 Implement seeded policy updates, cold starts and bounded alarm scores. Done when first-result, concurrent-update and constrained-width cases pass.
- [ ] 25.14 Make readiness depend on platform evidence and enforce secret checks before disk writes. Done when rejected workflow and answer secrets leave no unsafe records.
- [ ] 25.15 Write the benchmark protocol with task set, repeat count, rubric, budgets and promotion rules before collecting outcomes. Done when its review confirms equal allowances and independent held-out checks.
- [ ] 25.16 Run the authorized comparison of single-agent, fixed and adaptive workflows. Done when raw results and uncertainty are saved and the report accepts or rejects each stated benefit.
- [ ] 25.17 Enforce child-process isolation and separate live-test groups. Done when child Bun, Git-hook and inherited-live-flag scenarios pass.
- [ ] 25.18 Enforce stage reporting and full-release completeness. Done when pending scenarios and falsely completed tasks fail the release gate.
- [ ] 25.19 Add an explicit backend and permission support matrix. Done when plain-shell API runs work, ambiguous detection fails, and no unverified backend is ready by default.
- [ ] 25.20 Apply the paid boundary to vLLM requests and document endpoint billing. Done when "vLLM reaches its deadline" passes without claiming deprovisioning.
- [ ] 25.21 Version stored formats and verify upgrade refusal and rollback before changing them. Done when unsupported versions fail without writes and rollback replays no external action.
- [ ] 25.22 Enforce host-bound session capabilities and read-only reviewer tools. Done when forged-attempt and judge-write cases fail without changing hub state.
- [ ] 25.23 Gate plug-in imports and reuse only scoped bundled-server approvals. Done when unapproved imports execute no code, preflight approval completes validation, and a second worker gets a distinct restricted capability.
- [ ] 25.24 Separate provisional improvement summaries from terminal accounting. Done when "Improvement overhead is counted once" passes with linked evaluation records.

## 26. Support concurrent workflows across harnesses

Build concurrency into the local execution path before the first real adapter. Keep the dashboard and shared-knowledge extensions in their mapped stages.

- [ ] 26.1 Persist caller context and idempotent submission ids. Done when same-client parallel submissions, lost responses and caller-specific harness selection pass.
- [ ] 26.2 Resolve concurrent daemon startup through the winning writer. Done when both bootstrap clients retain their submissions and invalid plans leave other runs active.
- [ ] 26.3 Implement server-wide slots and durable round-robin admission. Done when overlap, all-role limits, waiting-slot release and restart fairness cases pass.
- [ ] 26.4 Isolate adapter sessions and same-project run folders. Done when independent conversations, targeted cancellation, conflicting edits and cleanup cases pass.
- [ ] 26.5 Bind messages, answers and approvals to explicit execution identities. Done when repeated local ids, mismatched answers and cross-run approval reuse cannot cross boundaries.
- [ ] 26.6 Expose origin filters and independent run handles through CLI, HTTP, MCP and guide examples. Done when same-harness and different-harness examples work without a current-run singleton.
- [ ] 26.7 Build the global dashboard and queue telemetry. Done when all run origins, capacity waits, independent cursors and trace identities match API records without double counting.
- [ ] 26.8 Preserve committed hub snapshots and resolved persona choices across concurrent runs. Done when search/publication races and active-version cases pass.
- [ ] 26.9 Add deterministic concurrency falsification tests. Done when serial scheduling and swapped callbacks fail, and the correct fake implementation passes the whole concurrency matrix.

## 27. Keep development checks lean and complete

Apply design decision 38 during the foundation stage. The sibling comparison and counterexamples are in `research/development-practices-review.md`.

- [ ] 27.1 Configure pinned, read-only commit and push hooks. Done when staged secrets fail, missing tools give setup instructions and routine pushes run no builds or live calls.
- [ ] 27.2 Implement affected-package selection across complete outgoing ranges and reverse dependencies. Done when deleted edges, earlier commits, new branches and unknown owners cannot hide required tests.
- [ ] 27.3 Reuse only exact successful check receipts if reuse is needed. Done when fixture changes, staged differences and interrupted runs reject stale receipts; rerunning without reuse also passes.
- [ ] 27.4 Measure hook and CI duration on named host configurations. Done when repeated cold and warm runs cover docs, one-package, shared-contract and guard changes, with missed targets visible.
- [ ] 27.5 Configure shared code style and boundary validation. Done when malformed vendor data fails, ownership violations and code comments fail, asynchronous filesystem I/O is enforced, and pure calculations remain valid.
- [ ] 27.6 Enforce public exports and an acyclic declared package graph. Done when deep imports, undeclared imports, vendor leaks and product-to-test imports fail.
- [ ] 27.7 Organize test tiers and bound isolated test workers. Done when concurrent test files use independent homes and ports, and global state cannot cross files.
- [ ] 27.8 Exercise real adapters with versioned vendor response stubs. Done when missing request fields, broken streams, extra calls and targeted process cancellation fail or recover as specified.
- [ ] 27.9 Add independent documentation checks and remove test-driven page generation. Done when invalid commands and workflows fail without vendors, and passing or failing end-to-end runs leave docs unchanged.
- [ ] 27.10 Verify full-check completeness, source coverage and check configuration. Done when deliberate omissions fail, packaging changes get install checks and dependency changes get a separate blocking audit.

## 28. Recover agents and schedule arbitrary dependency plans

- [x] 28.1 Separate physical execution segments from logical result attempts. Done when the scenario "Rate limit on final result attempt" passes with its complete mapped cases.
- [ ] 28.2 Extend session ports with ordered events and checkpoint operations. Commit and restore consistent workflow, session and filesystem checkpoints. Done when the scenario "Resume edited files and conversation" passes with its complete mapped cases.
- [ ] 28.3 Persist recovery allowances, backoff, execution generations and stale-result rejection. Done when the scenario "Restart cannot refill retries" passes with its complete mapped cases.
- [ ] 28.4 Implement native restoration and explicitly authorized reconstruction per adapter. Done when the scenario "Native session has disappeared" passes with its complete mapped cases.
- [x] 28.5 Validate graph syntax and compile existing groups without changing their semantics. Done when the scenario "Mixed dependency graph" passes with its complete mapped cases.
- [x] 28.6 Admit dependency-ready work across mixed plans with configured finite limits. Done when the scenario "Long mixed plan" passes with its complete mapped cases.
- [ ] 28.7 Recover interrupted falsifiers, judges and proof tools without regenerating candidates. Done when the scenario "Falsifier rate limit" passes with its complete mapped cases.
- [ ] 28.8 Separate quality outcomes from operational accounting and learning eligibility. Done when the scenario "Outage does not retire a persona" passes with its complete mapped cases.

- [x] 28.9 Verify immutable attempt inputs before continuation and publication with bounded admission. Done when the three attempt-input scenarios pass in source tests and the installed Codex and Claude restart cases pass. Full workflow, session and mutable workspace manifests remain in task 28.2.

- [x] 28.10 Bind completed candidate digests to durable worker phases. Done when "Candidate bytes cannot replace their committed digest" passes for legacy records, review, dependency assembly and publication, including installed Codex and Claude restart cases. Full conversation and mutable workspace manifests remain in task 28.2.

## 29. Centralize configuration and its schema

- [ ] 29.1 Create @titan/config and shared setting metadata without breaking adapter boundaries. Done when the scenario "Changed setting reaches every surface" passes with its complete mapped cases.
- [ ] 29.2 Resolve validated user, project, workflow, environment and CLI layers. Done when the scenario "File and workflow override" passes with its complete mapped cases.
- [ ] 29.3 Publish default values, units, scopes and protected owner ceilings. Done when the scenario "Workflow cannot override owner ceiling" passes with its complete mapped cases.
- [ ] 29.4 Freeze effective settings per run and audit approved allowance revisions. Done when the scenario "Approved extra recovery allowance" passes with its complete mapped cases.
- [ ] 29.5 Complete configuration commands, saved-run history and format upgrades. Done when the scenario "Inspect a blocked run config" passes with its complete mapped cases and the configuration migration and rollback contract is verified.
- [x] 29.6 Deliver scoped version-checked configuration file commands. Done when "Concurrent config writers", "Scoped config edits retain owner policy", "Refused config edits preserve the file" and "Config schema export is offline" pass through source and installed acceptance.
- [x] 29.7 Inspect exact saved run settings and sources across transports. Done when "Exact frozen configuration survives file edits and restart" and "Frozen configuration refuses a different or malformed report" pass through source and installed acceptance.
- [x] 29.8 Inspect current user and project settings offline. Done when "Scoped show inspects files without starting services" passes through source and installed acceptance.

## 30. Complete the CLI and visible control surfaces

- [ ] 30.1 Define identities and typed selectors across CLI, HTTP and MCP. Done when the scenario "Repeated workflow gets separate runs" passes with its complete mapped cases.
- [ ] 30.2 Implement detached observation, pause, resume, cancellation and event cursors. Done when the scenario "Pause one parallel workflow" passes with its complete mapped cases.
- [x] 30.3 Version output envelopes, event pages and operational exit codes. Done when the scenario "Blocked run is not failed output" passes with its complete mapped cases.
- [ ] 30.4 Generate checked command references from shared argument definitions. Done when the scenario "Conflicting invocation before execution" passes with its complete mapped cases.
- [ ] 30.5 Inspect, export and apply checked code and document artifacts with scoped approval. Done when the scenario "Target changed before apply" passes with its complete mapped cases.
- [ ] 30.6 Bind submitting environment and ephemeral credentials to each run. Done when the scenario "Daemon restart loses ephemeral credentials" passes with its complete mapped cases.
- [ ] 30.7 Show dependency and recovery states in the dashboard without quality penalties. Done when the scenario "Rate limit in the dashboard" passes with its complete mapped cases.

## 31. Prove installation and usable end-to-end delivery

- [ ] 31.1 Pack all runtime dependencies and install outside the checkout using a test registry. Done when the scenario "Install without workspace links" passes with its complete mapped cases.
- [ ] 31.2 Record tested environments and optional capability setup in doctor and installation docs. Done when the scenario "Minimal environment first use" passes with its complete mapped cases.
- [x] 31.9 Check the needed tools during install and write the plain-language install guide `docs/install.md`. Done when the scenarios "Required tool missing", "Only optional tools missing" and "Install guide matches the package" pass.
- [x] 31.10 Write `install.sh` that checks Bun and Git before Bun exists, and mention it first in `docs/install.md`. Done when the scenarios "Bun absent at start" and "Git absent at start" pass.
- [ ] 31.11 Write the update check, the one-line notice and the `update.source` and `update.check` settings. Done when the scenarios "Newer version exists" and "Check turned off" pass.
- [ ] 31.12 Write `titan update` with `--check`, `--from`, the backup, the side-by-side install, the doctor gate and the rollback. Done when the scenarios "Update that passes" and "Update that fails" pass.
- [ ] 31.13 Run Titan's own deliveries with the installed `titan` command and document it in `docs/install.md`. Done when a run is started and resumed through the installed command and the guide names the update steps.
- [ ] 31.3 Ship and verify the installed mixed-plan interruption recovery preview. Done when the scenario "Installed preview survives restart" passes with its complete mapped cases.
- [ ] 31.4 Ship checked code, document, research and stubbed operation examples. Done when the scenario "Remote operation response is lost" passes with its complete mapped cases.
- [ ] 31.5 Verify shared live self-development with an immutable installed controller and compatible runtime recovery. Done when the scenario "Titan edits Titan" passes with its complete mapped cases.
- [ ] 31.6 Falsify recovery across execution, checks and publication boundaries. Done when the scenario "Recovery mutants are detected" passes with its complete mapped cases.

- [x] 31.7 Record immutable installed release pins and retain legacy format recovery. Done when "Saved run requires its recorded release" and "Runtime pin is required from the first record" pass through their mapped cases and the installed archive. Shared live self-development remains in task 31.5.

- [x] 31.8 Provide bounded owned command capture through a reusable process package and retain packaging behavior. Done when binary, command admission, exit, cancellation, descendant cleanup, first-failure, fault, installed and complete gate evidence passes. Approved workflow script dispatch and self-development acceptance remain under their existing tasks.

## 32. Repair the rejected codebase to the reference standard

- [ ] 32.1 Reconcile every applicable reference rule into DEV_RULES, a blocking job registry and negative fixtures. Done when a missing guardrail fails verification and the parity table has no unexplained omission.
- [ ] 32.2 Repair all source ownership, schema, enum, literal, message, error, configuration, async, lazy and bounded-state violations. Done when the reference rule set passes without broad ignores.
- [ ] 32.3 Complete the package and module reorganization, including runner, board, workspace, runtime composition and transport boundaries. Done when every package has a tested public contract and a technical README.
- [ ] 32.4 Deliver the technical documents, development and testing guides, canonical harness skills, commands and knowledge-record workflow. Done when their freshness and contract checks pass.
- [ ] 32.5 Verify staged content and outgoing revisions with the complete applicable guardrails and stubbed E2E coverage. Done when deliberate staged and outgoing defects fail and repeated timing evidence demonstrates the faster workflow.
- [x] 32.6 Reject incomplete focused offline test selections before execution. Done when missing paths beside valid tests, symbolic files, empty discovery and exhausted finite budgets fail, and the actual driver proves no test child starts for invalid requests.

- [x] 32.7 Enforce bounded owned Markdown link and heading checks in full and documentation snapshots. Done when parser, containment, finite-budget, staged and complete outgoing-range negative fixtures pass without network calls or document changes. Mermaid and full reference parity remain under 32.1 and 32.4.

- [x] 32.8 Repair deep product contract definitions without changing their public validation. Done when the four unused-policy, hook metadata and request-turn modules have zero reference structure findings and direct contract, existing behavior, fault, installed and complete gate evidence passes. The remaining source inventory stays under 32.1 and 32.2.

- [x] 32.9 Repair deep product streaming and control flow without changing public behavior. Done when the six remaining product modules have zero reference structure findings and boundary, descriptor, concurrency, existing behavior, fault, installed and complete gate evidence passes. Full source parity remains under 32.1 and 32.2.

- [x] 32.10 Repair the ten deep verification tooling modules while retaining their refusal and cleanup behavior. Done when the actual reference scan has zero tooling findings and existing behavior, malformed coverage, fault, installed and complete ordinary gate evidence passes. Full testing-source parity and the blocking structure rule remain under 32.1 and 32.2.

- [x] 32.11 Repair shared native testing foundations with shallow fresh fixture data and bounded Buffer reads. Done when the touched shared factories, protocol fixtures, transport setup and continuation support have zero reference findings and exact-boundary, existing behavior, fault, frozen-lock, installed and complete gate evidence passes. Full testing-source parity remains under 32.1 and 32.2.

- [x] 32.12 Repair request page and MCP acceptance factory structure while preserving their full case tables. Done when both touched sources have zero reference findings and existing behavior, fixture-fault, restored, installed and complete ordinary gate evidence passes. Full testing-source parity remains under 32.1 and 32.2.

## 33. Deliver the requirements added on 2026-11-12

Knowledge inspection completion follows [the bounded history and date sequence](research/knowledge-inspection-delivery.md). Tasks 33.3 and 33.14 have complete local source, actual-server and installed acceptance recorded there. Shared-fabric requirements remain open.

- [ ] 33.1 Add the project hub in the project's `.titan/knowledge`, search both hubs and `titan kb promote`. Done when the scenarios "A run saves a lesson in the project", "Search reads both hubs", "Promote an entry", "Clone brings the project hub" pass.
- [ ] 33.2 Make every run read the hub first, give every persona `kb_search` and `kb_add`, and save a lesson for each pass and refutation. Done when the scenarios "Run reads and writes the hub", "Persona has hub tools", "Hub tools are missing" pass.
- [x] 33.3 Write `titan kb list`, `titan kb stats` and `titan kb show`, and show them in the dashboard. Done when the scenarios "List by scope", "Stats" pass.
- [x] 33.4 Write `titan kb prune`, `titan kb consolidate` and `titan kb restore`, with no text lost. Done when the scenarios "Prune report changes nothing", "Prune with apply keeps the text", "Consolidate" pass.
- [x] 33.5 Download the meaning-search model in `titan install` and `titan doctor --fetch-model`, and run the real-model test once. Done when the scenarios "Install downloads the model", "Install without the model", "Search offline after the download" pass.
- [ ] 33.6 Record the reset time of a usage limit, resume the run at that time, and allow `titan resume --backend`. Done when the scenarios "Limit with a reset time", "Automatic resume", "Switch provider on resume" pass.
- [ ] 33.7 Order prompts with fixed parts first, record cache tokens, show the cache share in `titan status`, add `cache.ttl`, and write the caching research note and settings guide. Done when the scenarios "Cache fields are recorded", "Same prefix for the same persona", "Low cache share is flagged" pass.
- [ ] 33.8 Run script, agent and improvement steps in one workflow and show each kind in the run record. Done when the scenarios "Mixed workflow" pass.
- [ ] 33.9 Add `update.mode`, idle-time automatic install, the backup, the data copy upgrade and the return to the old version. Done when the scenarios "Automatic update when idle", "Active run blocks the update", "Old data survives", "Failed update goes back" pass.
- [x] 33.10 Update the Titan skill and the delivery skill so that they tell the main agent five things. Use the installed `titan` command. Search both hubs first. Check `titan requests`. Resume after a limit. Read the cache share. Done when the skill files name each of these steps and `check-plain.py` passes on them.
- [ ] 33.11 Put real run proof in the repository: the run folders, the project hub entries and the `titan status` cache numbers, each linked from `docs/evidence.md`. Done when every claim in that file points to a file in the repository.
- [ ] 33.12 Add `workspace.mode` and direct writes to the project. Add a restore point per step and rollback of a refuted step. Run steps on the same file one after another. List the changed files per step. Done when the scenarios "A step writes to the project", "Isolated mode stays available", "Refuted step is rolled back", "Outside changes stay", "Same file", "Different files" pass.
- [ ] 33.13 Run listed checks inside the loop and send failures back to the same builder. Done when the scenarios "Failing check goes back to the builder", "Check never passes" pass.
- [x] 33.14 List runs in the dashboard from stored summaries with state, stage and persona, in under two seconds for 200 runs. Done when the scenario "Run list is fast" passes.
- [x] 33.15 Start a run only on a backend the person named, block on a limit without switching, and list hand changes in the commit message. Done when the scenarios "Limit does not switch backend", "No backend named", "Commit lists hand changes" pass.
- [x] 33.16 Put the working rules into the Titan skill and the delivery skill. Done when the scenario "Skill names the rules" passes.
- [x] 33.17 Record every file a run writes into the project in `.titan/written-by-runs.json`. Done when the scenario "Run files are recorded" passes.
- [x] 33.18 Let a writable Claude builder run shell commands inside the work folder. Done when the scenarios "Claude builder runs shell commands" and "Shell command that reaches a protected place is denied" pass.
- [ ] 33.19 Let a step list `allow_folders` for harness folders, bounded by the home setting `workspace.allow_folders`. Done when the scenarios "A step writes a skill", "A folder that was not listed stays closed", "Git and Titan folders cannot be allowed" and "The owner bounds the request" pass.
- [x] 33.20 Let a Claude turn finish after the agent was denied one request. Done when the scenario "A denied request does not stop the turn" passes.
