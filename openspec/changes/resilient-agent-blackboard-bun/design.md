## Context

A person has a problem. It can be code, science, a business plan or an everyday question. The person talks about it with the _main agent_: the agent in the agent tool they already use, such as Claude Code. The person does not write personas or a workflow. When the main agent understands the problem, it designs the work:

- which personas to use, with which tools and skills;
- which steps to run, in which order;
- how to try to prove each step wrong.

Before it creates a persona, the main agent searches the _persona register_. This is a store of every persona used before. It reuses a persona that fits, or changes (_mutates_) one that is close, and creates a new one only when nothing fits. Every new or changed persona goes into the register for next time.

It writes all this into a workflow file and starts `titan`. During the run, the personas talk to each other through the _board_: a shared list of messages in a fixed format. They can ask each other for help. They can also ask the main agent to create a persona, improve one, or give them a tool or resource.

Personas, prompts, tools, skills, lessons and facts are kept in the _knowledge hub_. It is a set of plain files that people can read. It has two kinds of search: by meaning, with numbers that people cannot read, and by words, with results that people can read. The main agent and the swarm can search it, add to it and change it.

Each agent runs on a _backend_: one of the three agent SDKs or a vendor's model API. The main agent, or a program that controls `titan`, picks the backend for each persona. `titan` is a command-line tool. It starts the agents through the SDK of the agent tool it runs in. It makes other agents, or scripts, try to prove each result wrong before the work goes on. At the end, the main agent tells the person the result and the evidence.

The repository contains an experimental local runtime, CLI, transports and Codex and Claude Code adapters. Product delivery remains incomplete. Current verification and remaining work are recorded in `research/implementation-state.md` and `tasks.md`. The first intended users are developers using local agent tools. All SDK bindings and package versions below are historical research observations. Implementation must check pinned primary documentation and live contracts before claiming support. The stack is fixed by the user: a Bun monorepo in TypeScript, tested with `bun test`.

**Word list**

| Word                      | Meaning in this change                                                                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| person                    | The human who has the problem and talks with the main agent.                                                                                                                 |
| agent tool                | A program that runs an AI agent on your computer: Claude Code, Codex or Antigravity. Also called a _harness_.                                                                |
| main agent                | The agent in the agent tool that the person talks to. It designs the workflow and starts `titan`.                                                                            |
| SDK                       | Software development kit: a library that lets code start and control an agent.                                                                                               |
| agent                     | One AI session that `titan` starts through an SDK, with one persona and one task.                                                                                            |
| persona                   | A role an agent plays. It has a role text, such as "You are a careful chemist", inputs, outputs, and can have tools, skills and a model.                                     |
| persona register          | The part of the knowledge hub that holds personas. Each persona has a name, versions and a history of how it did.                                                            |
| mutate                    | Make a new version of a registered persona with a changed role, tools, skills, inputs or outputs. The old version stays.                                                     |
| input, output             | The named pieces of data that a persona takes and gives, each with a format: a JSON schema.                                                                                  |
| board                     | The shared list of messages of one run, in `board.jsonl`. Personas write to it and read the messages meant for them.                                                         |
| request                   | A message on the board from a persona to another persona or to the main agent, asking for help, a persona, a tool or a resource.                                             |
| tool                      | An action an agent may take, such as reading files, running commands or searching the web.                                                                                   |
| skill                     | A packaged set of instructions that an agent tool can load, such as a Claude Code skill.                                                                                     |
| workflow file             | A YAML file written by the main agent. It names the personas from the register, the steps, falsification and the loop.                                                       |
| checkpoint                | A saved boundary linking conversation state, working files and durable progress.                                                                                             |
| logical attempt           | Work toward one candidate result and its completed checks, across any recovery segments.                                                                                     |
| execution segment         | One physical invocation within a logical attempt.                                                                                                                            |
| dependency graph          | Named steps joined by edges declaring what must finish before other work starts.                                                                                             |
| configuration schema      | Shared rules for setting names, types, limits and permitted overrides.                                                                                                       |
| step                      | One unit of work with a `do` part and checks in `falsify`, `verify` or both.                                                                                                 |
| script                    | A shell command used as a step's `do` or `falsify` part, such as `bun test`.                                                                                                 |
| falsify                   | Try to prove a result wrong. A _falsifier_ is the agent or script that tries.                                                                                                |
| refuted                   | A falsifier showed that the result is wrong, with evidence.                                                                                                                  |
| survived                  | No falsifier could show that the result is wrong.                                                                                                                            |
| candidate                 | One of several results that a step makes for the same task.                                                                                                                  |
| judge                     | A persona that compares two surviving candidates and picks the better one.                                                                                                   |
| improver                  | A persona that reads a run record and writes a better workflow file.                                                                                                         |
| run record                | The folder that `titan` writes for each run. It holds every step, attempt and result.                                                                                        |
| lesson                    | A short rule learned from a run, such as "check time zones first", kept for later designs.                                                                                   |
| knowledge hub             | The store of personas, prompts, tools, skills, lessons, facts and data in `~/.titan/knowledge/`, with a search index in `~/.titan/knowledge.db`.                             |
| entry                     | One item in the knowledge hub: one plain file with a kind, a title, tags and a body.                                                                                         |
| embedding                 | A list of numbers that stands for the meaning of a text. Texts with close meanings get close lists.                                                                          |
| vector search             | Finding the entries whose embeddings are closest to the embedding of a question. People cannot read embeddings or see why an entry matched.                                  |
| word search               | Finding the entries that contain the words of a question. The result shows the matching words, so people can see why an entry matched.                                       |
| hub index                 | The file `~/.titan/knowledge/INDEX.md`: a readable table of every entry, made by `titan`.                                                                                    |
| backend                   | What runs one agent: the Claude Agent SDK, the Codex SDK, the Antigravity SDK, or a vendor's model API.                                                                      |
| model API                 | A vendor's web service that answers a prompt with a model, without an agent tool around it.                                                                                  |
| port                      | An interface that the core of `titan` owns. The core only calls the port, never a vendor's SDK.                                                                              |
| adapter                   | A package that turns calls on a port into calls to one vendor's SDK or API.                                                                                                  |
| facade                    | One small entry point that hides many parts behind a few functions.                                                                                                          |
| capability                | A yes-or-no flag on a backend that says what it can do, such as "can resume a session".                                                                                      |
| tool server               | A program that offers tools over the Model Context Protocol (MCP). The agent tool starts it and calls its tools.                                                             |
| plug-in                   | An npm package that adds backends or embedders to `titan` without a change to `titan` itself.                                                                                |
| embedder                  | The part that makes embeddings for meaning search.                                                                                                                           |
| optimistic version check  | A change that only goes through when the entry still has the version that was read. Otherwise it reads the entry again and tries again.                                      |
| hive                      | All the agents of one or more runs on one `titan` server, working through the board. Any agent can add steps and requests.                                                   |
| open call                 | A step that names tags and a task, but no persona. `titan` picks a persona from the register to do it.                                                                       |
| split                     | A step whose work is a list of parts, with one agent for each part. The _width_ is how many of these agents run at the same time.                                            |
| approval level            | Who decides on a kind of request: `titan` alone (`auto`), the main agent (`main`) or the person (`human`).                                                                   |
| persona state             | Where a persona version is in its life: `proposed`, `trial`, `proven`, `needs_update`, `retired` or `deleted`.                                                               |
| Wilson bound              | The lowest or highest survival rate that still fits a persona's results, with 95 % confidence.                                                                               |
| Thompson sampling         | A way to pick a persona: draw a likely rate for each one from its counts, and pick the highest draw.                                                                         |
| orchestrator              | The part that decides which agents to start, how many at once, and with which task. In `titan`, the main agent writes the plan and the policy makes the choices inside it.   |
| policy                    | The choices `titan` makes for one kind of goal: split width, persona pick and plans to offer, with the counts behind them.                                                   |
| reward                    | The number that says how good a run was. The policy learns from it.                                                                                                          |
| critical path             | The longest chain of steps that must run one after another. Its length is the shortest time the run can take.                                                                |
| serial collapse           | When an orchestrator learns to run everything with one agent, even when it could run several at once.                                                                        |
| empty agents              | Agents that are started with no real part of the work.                                                                                                                       |
| trail                     | A count of good results for one choice, which fades a little with each new result, as an ant trail fades unless ants keep using it.                                          |
| titan server              | The program that `titan serve` starts. It runs the hive and offers the HTTP API on 127.0.0.1.                                                                                |
| agent token, person token | Two secrets in files that only the user can read. The agent token lets agents and programs call the server. The person token is needed to answer a request at level `human`. |
| RunPod serverless         | A paid service that runs a container or a model on a GPU machine for each job, and bills the time the machine works.                                                         |
| vLLM                      | A server for open-weight models that speaks the OpenAI API. RunPod offers it as a ready worker.                                                                              |
| unit test                 | A test of one function or rule, with no process, no port and no disk outside a temporary folder.                                                                             |
| integration test          | A test that joins several real parts of `titan`, with fakes for the outside services.                                                                                        |
| end-to-end test           | A test that runs the `titan` command or `titan serve` as a person or a program would, with fake backends.                                                                    |
| live test                 | A test that calls a real agent tool, model API or RunPod. It runs only when a person sets its `TITAN_LIVE_*` variable to `1`.                                                |
| guard file                | The file `testing/support/guard.ts`. Bun loads it before every test file. It blocks the network, other programs and keys.                                                    |
| fake                      | A small working copy of an outside service, kept in the repository, that answers from a script.                                                                              |
| contract test             | One set of checks that runs against a fake and against the real service, so that both act the same.                                                                          |
| property test             | A test that checks one rule on many inputs made at random from a fixed seed.                                                                                                 |
| coverage                  | The share of code lines that the tests run.                                                                                                                                  |
| mutation testing          | A tool changes the code in small ways, one at a time. Each change that no test notices (a _surviving mutant_) shows a gap in the tests.                                      |
| stall count               | A number for each run that goes up when a step repeats a refuted result or fails, and down when a result survives. Past 2, the main agent gets a `replan` request.           |
| failure kind              | A name for the way a result went wrong, from the 14 names of the MAST paper. A falsifier can add one to a refutation, as a hint.                                             |
| span                      | One timed piece of work in an OpenTelemetry trace, such as one agent's turn. `titan trace` writes the spans of a run to a file.                                              |
| agent card                | A JSON file in the form of the A2A (Agent2Agent) protocol. It tells other programs what `titan serve` can do and where it is.                                                |
| dashboard                 | The read-only web page of `titan serve`. It shows past and running runs, their steps and their numbers.                                                                      |
| telemetry                 | Data that a program sends about its own work: times, counts, tokens and costs.                                                                                               |
| trace viewer              | A program that receives spans and shows them in a browser, such as Jaeger.                                                                                                   |
| OTLP                      | The OpenTelemetry Protocol: the open format in which programs send spans to a trace viewer.                                                                                  |
| proof check               | An entry in a `verify` list. A program, not a model, checks a result and answers `proven`, `refuted` or `not proven`.                                                        |
| locked statement          | The exact theorem or claim that a proof check proves. The main agent writes it, the person approves it, and agents cannot change it.                                         |
| Lean                      | A programming language and proof assistant. `lake comparator`, a Lean 4.35.0 command, checks that a proof proves the locked theorem.                                         |
| SMT, z3                   | SMT solvers check claims over numbers and similar values. `z3` is one such program. `unsat` for the opposite of a claim means the claim is proven.                           |
| proven share              | Proven checks divided by summary checks: kept step checks plus final goal checks.                                                                                            |

**Facts that were checked**

- Claude Code sets `CLAUDECODE=1` in the shell of the commands it runs. This was seen in this session's environment.
- The Claude Agent SDK is the npm package `@anthropic-ai/claude-agent-sdk`. You start an agent with `query({ prompt, options })`. Source: https://code.claude.com/docs/en/agent-sdk/typescript.md. The options include:
  - `cwd`, `permissionMode` and `outputFormat` (a JSON schema for the answer);
  - `systemPrompt` and `model`;
  - `tools` ("Pass an array of tool names"), `allowedTools` and `disallowedTools`;
  - `skills` ("Pass `'all'` to enable every discovered skill, or a list of skill names").
- The Codex SDK is the npm package `@openai/codex-sdk`. You call `codex.startThread()` and then `thread.run(prompt)`. A turn can take an `outputSchema`. The README says it "Requires Node.js 18+". The README documents no option for tools, skills or a system prompt. It only documents raw `config` and `configOverrides`. Source: https://github.com/openai/codex/blob/main/sdk/typescript/README.md.
- The Antigravity SDK is the Python package `google-antigravity`. Google calls it "a Python library" and lists TypeScript as future work. It is in preview. Source: https://antigravity.google/blog/introducing-google-antigravity-sdk/.
- The `agy` binary (Antigravity's command-line tool, version 1.0.15) has a `--print` option to run one prompt without a chat window. This was seen in `agy --help` on this machine.
- The `codex` binary (version 0.166.0) contains names such as `CODEX_HOME` and `CODEX_TOOL_CALL_ID`. The `agy` binary contains names such as `ANTIGRAVITY_CONVERSATION_ID`. Nobody has yet checked which of these names are set in the shell of the commands that each tool runs.
- Claude Code loads skills from `.claude/skills/<name>/SKILL.md`. This project already uses one: `.claude/skills/plain-language-specs/SKILL.md`.
- Bun 1.3.10 on this machine reads YAML with `Bun.YAML.parse`. This was seen in a test command.
- The npm package `sqlite-vec` adds vector search to `bun:sqlite`. On this machine, version v0.1.9 loaded and returned the 2 nearest of 3 rows. Its documentation says that the built-in SQLite on macOS "doesn't allow extensions" without a custom SQLite. Source: https://alexgarcia.xyz/sqlite-vec/js.html. Output: `research/probes/knowledge-hub/`.
- The npm package `@huggingface/transformers` made embeddings under Bun on this machine, with the model `Xenova/all-MiniLM-L6-v2`. It gave 384 numbers per text and needed no model API. Output: `research/probes/knowledge-hub/`.
- `bun:sqlite` on this machine has SQLite's word search (FTS5). It found the one entry about time zones and marked the matching words: "Check [time] [zones] first". Output: `research/probes/knowledge-hub/fts-output.txt`.
- Google's JavaScript package for the Gemini API is `@google/genai`. Source: https://aistudio.google.com/docs/antigravity-agent.
- The Python package `google-antigravity` is not installed on this machine yet.
- The patterns for the backends, tools, data and monorepo were compared and tested. Each test, source quote and result is in `research/patterns.md`. The facts from that file that the decisions below use:
  - The Claude Agent SDK, the Codex SDK, the Antigravity SDK and the AI SDK all accept a tool server that runs as a local program (stdio). For Antigravity, this comes from its docs only.
  - The Vercel AI SDK (`ai` 7.0.163) calls the Anthropic, OpenAI and Gemini model APIs through one interface, with a tool loop and structured answers. Its packages read the keys from `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` and `GOOGLE_GENERATIVE_AI_API_KEY`.
  - The port and the Claude, Codex and model API adapters passed the TypeScript check in strict mode. They have not run live yet.
  - The Codex SDK types have no option for a system prompt or for skills.
  - 8 processes added 16000 lines to one board file at once, and no line broke.
  - 8 processes changed one SQLite row 2400 times without a lost change, once `busy_timeout` was set first. With `busy_timeout` set second, 7 of 8 processes stopped with `SQLITE_BUSY`.
  - A single file made with `bun build --compile` cannot load the embedder, and loads `sqlite-vec` only when `vec0.so` lies next to it.
  - A plug-in package was found only when `titan` looked for it from the user's folder.
- The patterns for the hive, approvals, the persona lifecycle, the server and the harness plug-in were compared and tested in `research/hive.md`. The facts that the decisions below use:
  - A fake hive on a Bun server let a planner agent add 3 steps. It stopped a runaway agent at a limit of 10 steps, with 1 request to raise the limit.
  - The main agent's token got status 403 on a request for the person. Two answers at once got statuses 200 and 409.
  - With the board file as the truth, the server had the same steps after a crash. With the state in memory only, it had 0.
  - Codex stops a tool call after 60 s by default, so an agent cannot wait inside a tool call for a person.
  - One plug-in folder in the Claude Code form passed Claude Code's check, and Antigravity imported its skill and tool server.
- The patterns for a self-training orchestration and for RunPod were compared and tested in `research/orchestration.md`. The facts that the decisions below use:
  - Kimi K2.5 names serial collapse as "A common failure mode". A survey of 2026 says that orchestrators also route nearly all work to one agent, and that no paper in its pool trains when to stop.
  - In a toy, a reward for the outcome only gave serial collapse in 38.5 % of runs. Kimi's lowered bonuses gave empty agents in 100 % of runs. Time on the critical path plus a small cost for each agent gave 0.0 % of both.
  - Plain Thompson sampling sent 22.7 % of picks to the better persona after two personas swapped rates. With counts that fade by 0.98, it sent 69.3 %.
  - RunPod's `executionTimeout` defaults to 10 minutes and its `ttl` to 24 hours. `/cancel` stops a queued or running job. RunPod bills worker time, not results.
  - Against a fake RunPod endpoint, a 2-hour job ended as `timed_out` after 59.5 minutes, and both open jobs got a cancel call at the deadline. The adapter for a private vLLM endpoint passed the TypeScript check.
- Other open-source multi-agent frameworks and recent papers were compared and tested in `research/swarm.md`. The facts that decision 32 uses:
  - Most frameworks offer handoffs or agents as tools, a saved state, a pause for a person, and traces. AutoGen is archived, and OpenAI Swarm is replaced by the OpenAI Agents SDK.
  - A paper over 180 setups found that more agents made sequential tasks worse, and helped tasks that split into independent parts.
  - In the MAST paper, the most common failure kind was step repetition, at 15.7 % of failures.
  - In a test of the OpenAI Agents SDK with a fake model, a guardrail that ran at the same time as the model let the model answer once. A blocking one stopped it with 0 model calls.
  - LangGraph's SQLite checkpoint package failed under Bun 1.3.10. Its in-memory checkpoint resumed a crashed run without running the finished node again.
  - In a toy with 5 votes at 5 % error each, the vote error was 0.122 % with independent errors and 4.958 % when all votes shared one mistake.
  - A fake run record became OpenTelemetry spans with the GenAI names, and an A2A agent card passed the TypeScript check. Neither was sent over the network.
- A dashboard and trace viewers were compared and tested in `research/dashboard.md`. The facts that decision 34 uses:
  - One run sent from Bun over OTLP/HTTP reached Jaeger 2.22.0, Phoenix 20.23.0, the Aspire dashboard 13.6.1 and Langfuse 4.66.0. Each one gave back all 4 spans.
  - Measured memory after the test: Jaeger 13.93 MiB in 1 container, Aspire 64.36 MiB, Phoenix 415.9 MiB, Langfuse 1826.6 MiB in 6 containers.
  - Phoenix's license is the Elastic License 2.0, and its page showed an update notice from an outside service. Langfuse is MIT outside its `ee/` folders.
  - No trace viewer knows `titan`'s board: open requests, the step graph, candidates or the proven share.
  - A small page on `Bun.serve` with an HTML import passed 6 tests. They covered login with a one-time code and a cookie, the Origin check and the run list. They also covered live events in 201 ms, `Last-Event-ID`, and scripts from its own server.
- Proof checks were compared and tested in `research/proofs.md`. The facts that decision 35 uses:
  - Of three Lean checks, only `lake comparator` of Lean 4.35.0 rejected all 5 cheats: `sorry`, a weakened statement, a changed definition, an extra axiom and `native_decide`. It took 1377 ms to 1814 ms per case.
  - `lake check` with a default target passed the weakened and the changed definition, and took about 62 s per case. Plain `lean` passed all 6 cases.
  - The Lake sandbox works only on Linux. In Docker it needed `--privileged` to mount `/proc`.
  - The `z3` program answered `unsat`, `sat` with a counterexample, and `timeout`, each with exit code 0.
  - The `z3-solver` npm package 5.3.1 failed under Bun 1.3.10 and worked under Node v24.14.1.

## Goals / Non-Goals

**Goals:**

- The person only describes the problem. The main agent decides personas, tools, skills, steps, order, falsification and the loop.
- One command, `titan run <workflow file>`, that works the same in Claude Code, Codex and Antigravity.
- No step result is used by a later step unless it survived falsification.
- When a step has several candidates, the result that `titan` keeps is the best one that survived.
- The workflow gets better over runs, and a change to it is kept only when a new run shows that it is at least as good.
- Lessons from earlier runs reach the main agent before it designs the next workflow.
- Personas are reused across problems. The main agent searches the register first and creates a persona only when none fits.
- Personas can cooperate during a run and can ask the main agent for a new persona, a better persona, a tool or a resource.
- Every run can be read back later from its run record.
- A new vendor, embedder or tool can be added without a change to the core of `titan`.
- `titan` works as a hive: the board drives the work, any agent can add steps and requests, and many runs share one server.
- Each kind of request has an approval level. Human-level answers need the person token, with the trusted-agent limitation disclosed.
- Each persona version has a measured state, and `titan` updates, merges, retires or deletes personas by fixed rules.
- `titan` learns from each run which split width, persona and plan to choose, without falling into serial collapse or empty agents.
- Agents can run on RunPod serverless, and a run that uses RunPod lasts at most 1 hour.
- A person can see past and running runs, their steps and their telemetry on a page in the browser, on their own computer.
- A goal, a step or an outcome can be checked by a program with a fixed answer, such as a Lean proof, so that a run can say "proven N of M".

**Non-Goals:**

- No web page that changes things. The dashboard only reads, and requests are answered with `titan answer`. The HTTP API and the dashboard listen on 127.0.0.1 only.
- No trace viewer inside `titan`. `titan` sends spans to one that the person runs, such as Jaeger.
- `titan` does not write proofs itself, and it does not judge whether a locked statement means what the person wants. The person approves the statement.
- `titan` does not train model weights. It writes traces that someone can use to train a model elsewhere.
- No built-in file or shell tools for a persona on a model API. Those tools need an agent SDK. A persona on a model API gets tool servers only.
- No chat with the person inside `titan`. The main agent already holds that conversation.
- No hosted agents, except on RunPod, which the person approves for each run. Agent SDKs run on the user's computer. Model APIs are only called for answers.
- No database server or message bus. The board and the knowledge hub are plain files, plus one SQLite file for the search index.
- No more agent tools in this change than Claude Code, Codex and Antigravity.

## Decisions

### 1. The main agent designs the workflow, and `titan` runs it

The person talks only with the main agent. `titan` gives the main agent a guide. The command `titan guide` prints it. The guide tells the main agent to follow these steps:

1. Talk with the person until the goal is clear, and what a good answer looks like.
2. Read the lessons from earlier runs with `titan lessons`, and the best earlier plans with `titan plans <kind>`.
3. Search the knowledge hub with `titan kb search "<question>"` for personas, prompts, tools and facts that the problem needs. Reuse a persona that fits. Mutate one that is close. Create a new one only when nothing fits.
4. Write the workflow file. Name the personas, with their tools, skills, inputs and outputs. Pick the steps, the falsifiers, the order, the candidates, the judge and the loop.
5. Run `titan check` and fix the file until it prints `ok`.
6. Start the run with `titan run`.
7. When `titan` stops with requests from personas, answer them, and continue with `titan resume`.
8. Read `result.md` and tell the person the result and its evidence. When a step failed, tell the person which step and why.

The guide also holds the file format, from `titan schema`, and the four example files. `titan install --harness claude|codex|antigravity` installs the guide as the skill `titan` and the tool server `titan mcp` in each agent tool, as in decision 28. The main agent then finds it without being told, and the person can start it with `/titan` or `$titan`.

- _Why:_ the user said the person "mediates with the main agent", and the main agent "decides what workflow and personas and tools and skills to push and how to orchestrate and starts the flow". The main agent already has the conversation and the files, so it knows the problem best.
- _Considered:_
  - The person writes the workflow file. The user rejected this.
  - A planner persona inside `titan` that designs the workflow. It would not have the conversation with the person, so it would know less than the main agent.

### 2. Personas live in a register and are reused

`titan` keeps every persona in the register, which is part of the knowledge hub: one YAML file per persona in `~/.titan/knowledge/persona/`. The folder `~/.titan` can be changed with the variable `TITAN_HOME`. A persona file holds:

- the name, a one-line description and tags, such as `code` or `chemistry`;
- the role text, tools, skills and model;
- the inputs and outputs, each with a format;
- its versions, and for each changed version the version it came from;
- its history: in how many runs it took part, and how often its results survived or were refuted.

The main agent searches the register with `titan kb search --kind persona "<question>"`. The search works by meaning and by words, as in the knowledge hub decision below. It lists the matches with their history, so the main agent can see which persona did well. The main agent then picks one of three actions:

- _reuse_: name the persona and its version in the workflow file;
- _mutate_: write a changed persona with `mutates: <name>@<version>`. `titan` saves it as the next version of that persona;
- _create_: write a new persona in the workflow file.

When a run starts, `titan` adds every persona that is not yet in the register. It never changes a saved version. After each run, it adds the run to each persona's history.

- _Why:_ the user asked that every persona that was not in the register gets registered, and that the main agent searches the register first next time. The history shows which personas are proven.
- _Considered:_
  - A register per project, in `.titan/`. Personas such as "skeptic" or "accountant" are useful for many problems, so one register per user is the default.

### 3. Personas pass typed messages through the board

Each persona declares its `inputs` and `outputs`. Each one has a name and a format, written as a JSON schema. A step's `inputs` field maps each input to an output of an earlier step, written `<step id>.<output name>`. `titan check` fails when the formats do not match.

During a run, every message goes onto the board: the file `board.jsonl` in the run record. A message has a sender, a receiver, a kind and a body in a fixed format. An agent writes to the board by adding `requests` to its answer. A request can:

- ask another persona a question (`ask`). `titan` starts that persona with the question. It then continues the asking agent's session with the answer. The Claude Agent SDK can resume a session, and a Codex thread continues when `run()` is called again. For Antigravity, a task checks whether the Python SDK can continue a chat;
- ask the main agent for a new persona (`new_persona`), a better persona (`improve_persona`), a tool (`tool`) or a resource (`resource`). A resource is a file, a data set or access to a service.

An agent reads only the messages meant for it, plus its inputs. A falsifier still gets only the goal, the task and the result.

Knowledge hub calls are not requests. An agent makes them during its turn, with the tools of `titan`'s tool server, and gets the answer at once. `titan` also logs each of these calls on the board.

Each board message is one line added to `board.jsonl`. In a test, 8 processes added 2000 lines each at the same time, and none of the 16000 lines broke. Output: `research/probes/data/append-output.txt`.

- _Why:_ the user asked that personas have inputs, outputs and formats to talk to each other, and that they can cooperate or ask the main agent for help. The board is the blackboard that the user called the ideal candidate. Keeping each agent's view small keeps falsifiers independent.
- _Considered:_
  - Every agent reads the whole board. A falsifier would then see the worker's reasoning and could be talked into agreeing.
  - Every request as a tool of the tool server, also `ask` and the requests to the main agent. These requests pause the step, and a tool call cannot end the agent's turn. A request in the structured answer ends the turn, so it fits a pause.
  - Knowledge hub calls as requests in the answer, as in the earlier version of this design. The agent would get the search result only in its next turn.

### 4. Requests to the main agent pause only the step that asked

When a persona asks the main agent for something, `titan` pauses that step. Other steps that do not depend on it keep running. When nothing else can run, `titan run` stops with exit code 3. It prints the open requests and writes them to `requests.json` in the run record. The main agent then answers each one:

- `titan answer <run id> <request id> --persona <file>`: adds a new or improved persona, which also goes into the register;
- `titan answer <run id> <request id> --tool <name>` or `--skill <name>`: gives the persona a tool or skill;
- `titan answer <run id> <request id> --resource <path>`: gives the persona a file or folder;
- `titan answer <run id> <request id> --deny "<reason>"`: says no, with a reason.

Then the main agent runs `titan resume <run id>`. The paused step goes on with the answers. Each answer is logged on the board. A step result that used a new persona, tool or resource is still falsified like any other.

- _Why:_ the main agent runs `titan` as one shell command. Stopping with a clear exit code is how a command can hand control back to it. The main agent has the conversation with the person, so it can also ask the person when a request needs that.
- _Considered:_ `titan` creates personas itself when asked. The user said the personas ask the main agent, and the main agent knows the problem best.

### 5. A knowledge hub of plain files, with a readable search next to the vector search

The knowledge hub holds every entry that the swarm can reuse. The kinds are `persona`, `prompt`, `tool`, `skill`, `lesson`, `fact`, `data` and `plan`. Each entry is a plain file in `~/.titan/knowledge/<kind>/`: YAML for personas, Markdown with a short header for the rest. People can open and read these files. The files are the truth. The search index can always be rebuilt from them with `titan kb reindex`.

The hub has a part that people can read and a part that only programs read.

People can read:

- the entry files themselves;
- the hub index, `~/.titan/knowledge/INDEX.md`. `titan` rewrites it after every change. It has one row per entry, with id, kind, title, tags, version, state (`final` or `pending`), a one-line summary and a link to the file;
- every search result. It shows the id, title and file path. It also shows why the entry matched: the matching words marked in the text, and the meaning score from 0 to 1.

Only programs read the search index, one SQLite file, `~/.titan/knowledge.db`. It holds two parts:

- a word index, with SQLite's word search (FTS5). It holds the plain text of each entry. It was tested with `bun:sqlite` on this machine;
- a vector index. `sqlite-vec` stores one embedding for each entry. `@huggingface/transformers` makes the embeddings on the user's computer, with the model `Xenova/all-MiniLM-L6-v2`. Both were tested under Bun on this machine. The embeddings are 384 numbers per entry, which people cannot read.

`titan kb search` takes `--mode words`, `--mode meaning` or `--mode both`. The default is `both`: it ranks by meaning and puts entries that also contain the words first. `--mode words` needs no model and no `sqlite-vec`, so it works when they are missing, and every result shows why it matched.

The main agent and the swarm use the same commands. Each prints JSON with `--json`:

- `titan kb search "<question>" [--kind <kind>] [--mode words|meaning|both]`
- `titan kb get <id>`
- `titan kb add <file>`
- `titan kb update <id> <file> --entry-version <version-read>`
- `titan kb delete <id> --entry-version <version-read>`
- `titan kb reindex`, which rebuilds `knowledge.db` and `INDEX.md` from the files

An agent with a shell tool can call these commands. Any agent, also one on a model API, can use the tools `kb_search`, `kb_get`, `kb_add`, `kb_update` and `kb_delete` of `titan`'s tool server, as in the tool server decision below. The run does not pause for them.

A change made by an agent stays private to its run, step, candidate and attempt. Only changes from the kept candidate become final. Refuted attempts and losing candidates cannot publish. A persona delete always needs the person's approval. Old versions stay in `~/.titan/knowledge/.history/`.

The server alone writes final files. Before replacing a file by an atomic rename, it saves a durable change record. After a crash, it finishes or undoes the change before serving readers. It then repairs the index from committed files. SQLite transactions alone cannot undo a file write. Pending updates name their base version and fail on a conflict, rather than replacing newer text. CLI updates are serialized by the server.

Every SQLite connection sets `busy_timeout` to 5000 ms before anything else. In a test, 8 processes changed one row 300 times each, and the final version was 2400, as expected. With `busy_timeout` set after the switch to write-ahead logging, 7 of the 8 processes stopped with `SQLITE_BUSY`. The 5000 ms is the value used in that test. Output: `research/probes/data/`.

- _Why:_ the user asked that tools, prompts and knowledge go into a vector database that is easy to read and to search. The user also said that the embeddings of `all-MiniLM-L6-v2` cannot be read by people, and asked for a readable option next to them. The user wants the swarm to use the hub to add, change and manage data. The entry files, the hub index and word search are the readable option. The pending rule keeps the falsify-first idea: nothing a refuted step wrote stays in the hub.
- _Considered:_
  - A vector database server, such as a separate service. It needs to run all the time and is harder to read.
  - Embeddings from a model API. They cost money for each entry and do not work offline. The local model worked in the test.
  - Only the SQLite file, with no plain files. People could not read or fix entries without a tool.
  - LanceDB, a vector store that runs inside the program. Its docs say it keeps data "in open, columnar files", which people cannot read. SQLite already gives word search and vector search. Source: `research/patterns.md`.
  - A lock file around each change. The version check needs no extra file and was tested.

### 6. Each persona can run on a different backend

A backend is what runs one agent. Six are built in, and plug-ins can add more:

| Backend           | What it is                                         | Built-in file and shell tools | Tool servers |
| ----------------- | -------------------------------------------------- | ----------------------------- | ------------ |
| `claude-sdk`      | Claude Agent SDK                                   | yes                           | yes          |
| `codex-sdk`       | Codex SDK                                          | yes                           | yes          |
| `antigravity-sdk` | Antigravity SDK, through the Python helper         | yes                           | yes          |
| `anthropic-api`   | Anthropic's model API, through `@ai-sdk/anthropic` | no                            | yes          |
| `openai-api`      | OpenAI's model API, through `@ai-sdk/openai`       | no                            | yes          |
| `gemini-api`      | Google's Gemini API, through `@ai-sdk/google`      | no                            | yes          |

`titan` picks the backend for each persona in this order. The first one that is set wins:

1. the flag `--backend <persona>=<backend>`, which can be given more than once;
2. the persona's `backend` field in the workflow file;
3. the workflow file's `defaults.backend` field;
4. the flag `--backend-default <backend>`;
5. the SDK of the agent tool that `titan` runs in, as found by detection.

`titan backends` lists every backend, also those from plug-ins, with `ready` or `not ready`, and the reason. For an SDK, the reason is a missing package. For a model API, it is a missing key. `titan` reads API keys only from environment variables and never writes them to a file or the run record. A persona on a model API with a built-in file or shell tool, such as `Bash`, fails `titan check`, because a model API has no such tools.

- _Why:_ the user asked that, when several SDKs or APIs are available, the main agent, an API or an integration can pick which one each agent uses. The order lets the main agent decide in the file, and lets a person or program override it per run.
- _Considered:_ one backend for the whole run. That is less flexible. For example, a cheap model API could not then judge while an agent SDK does the work.

### 7. Other programs can control `titan`

`titan` can be controlled in three ways, besides the main agent:

- the command line: ordinary commands take `--json` and print one final object, with an ordered events array for run commands. Protocol commands keep their own streams. Exit codes are fixed: 0 passed, 1 failed, 2 wrong input, 3 waiting for answers to requests;
- the packages: `@titan/runner` exports `runWorkflow()`, `resumeRun()` and `answerRequest()`. These do the same as the commands. Events come as an async iterator, so a program can watch a run live.
- the HTTP API of the `titan` server, as in decision 28.
- _Why:_ the user asked that `titan` can be used and controlled by an API or an integration. Later the user asked for a command-line tool and a server that does the work, so that others can hook into it.
- _Considered:_ only a command with JSON output and a library, as in the earlier version of this design. The user asked for a server.

### 8. Find the agent tool from the environment, with a flag to override it

`titan` looks at its environment variables to find out which agent tool started it. `CLAUDECODE=1` means Claude Code. The names for Codex and Antigravity will be fixed after a test. That test runs `env` inside each tool and records the output in the repository. The flag `--harness claude|codex|antigravity` always wins over the detection. When a persona needs the detected default and no harness is found, `titan` stops. Explicit backend choices can run from a plain shell. It then lists which agent tools it found on the `PATH` (`claude`, `codex`, `agy`).

- _Why:_ the user wants `titan` to use the SDK "based on the harness's attribute". Environment variables are what a tool passes to the commands that it runs. The main agent starts `titan` through its own shell, so `titan` sees them.
- _Considered:_ asking every time. That adds a step to every run. Looking at the parent process name. That breaks when a shell sits between the tool and `titan`.

### 9. One port for every backend, with an adapter for each vendor

`titan` uses the _ports and adapters_ pattern (also called hexagonal architecture). The core of `titan` owns one port for agents, `AgentBackend`. Each vendor gets its own adapter package that fills this port. The rest of `titan` only knows the port.

The port has:

- `specificationVersion`: the version of the port, such as `titan-backend-v1`. `titan` refuses an adapter with another version;
- `id`, such as `codex-sdk`;
- `capabilities`: yes-or-no flags for system prompt, built-in tools, skills, tool servers, resume and structured output;
- `start(spec)`: starts one agent and returns a session. The spec holds the role text, model, tools, skills, tool servers, working folder and output schema;
- `resume(sessionId, spec)`: continues an earlier session.

A session has `send(prompt)`, `cancel(reason)` and `close()`. Cancellation and cleanup follow spec harness-adapters. `send(prompt)` returns the agent's text, the structured answer, the session id and the usage numbers that the SDK reports.

On top of the port sits one small facade, `@titan/runner`, with three functions: `runWorkflow()`, `resumeRun()` and `answerRequest()`. A second port, `Embedder`, does the same for meaning search: the default adapter uses `@huggingface/transformers`, and a plug-in can add another.

The port and three adapters were written against the real SDK types and passed the TypeScript check. Code: `research/probes/backend-port/`.

- _Why:_ the user asked for a common interface per agent, built from facades and adapters, so that new vendors can be added. Cockburn's page on the pattern says an application can be "driven by users, programs, automated test or batch scripts", and that each outside device gets its own adapter. A fake adapter can stand in for real agents in tests, as the page's "mock" database does. The version field follows the AI SDK, which puts `specificationVersion` on every provider. Sources and quotes: `research/patterns.md`.
- _Considered:_
  - One big facade class with a branch for each vendor. Every new vendor would change the same class. The refactoring.guru page warns that a facade "can become a god object".
  - The AI SDK's model interface for every backend, also the agent SDKs. It describes one model call. It has no session to resume, no skills and no built-in tools.
  - Each SDK's own subagent feature, such as the `agents` option of the Claude Agent SDK. Then `titan` could not run the same workflow in Codex or Antigravity.
  - Running each agent tool's command line, such as `codex exec`. The user asked for the SDKs.

### 10. Each persona's tools, skills and tool servers reach its agent, or `titan` stops

The main agent gives each persona a list of `tools`, `skills` and `tool_servers`, and can give a `model`. Each adapter passes them to its SDK:

| Persona field  | Claude Agent SDK | Codex SDK                            | Antigravity SDK                     | Model APIs                                                |
| -------------- | ---------------- | ------------------------------------ | ----------------------------------- | --------------------------------------------------------- |
| role text      | `systemPrompt`   | put at the start of the first prompt | `system_instructions`               | `system`                                                  |
| `tools`        | `tools`          | none: Codex has its own tools        | a task checks it                    | only `titan`'s tool server and the persona's tool servers |
| `skills`       | `skills`         | no option: `titan check` fails       | a task checks it                    | no: `titan check` fails                                   |
| `tool_servers` | `mcpServers`     | `config.mcp_servers`                 | `mcp_servers` with `McpStdioServer` | an MCP client from `@ai-sdk/mcp`                          |
| `model`        | `model`          | `model`                              | a task checks it                    | the model id                                              |

Each adapter states what it can do in its `capabilities`. When a persona sets a field that its backend cannot apply, `titan check` fails. It names the persona and the field. `titan` never drops a tool, skill or tool server without saying so.

The Codex binary contains the text `developer_instructions`. It may be a Codex config key for role text. A task checks it. Until then, the role text goes at the start of the first prompt.

- _Why:_ the user named tools and skills as things the main agent decides. A falsifier with a tool, such as running code, can test a result instead of only reading it. The capability flags show the gaps between vendors in one place.
- _Considered:_ ignoring fields that an agent tool cannot apply. The run would then differ from what the main agent designed, and nobody would know.

### 11. Tools plug in as tool servers, the same way for every vendor

A tool server is a program that offers tools over the Model Context Protocol (MCP), through standard input and output (_stdio_). It is the one way to add a tool that all four kinds of backend accept. For Antigravity this comes from its docs only, because its package is not installed yet. The docs of the Claude Agent SDK, Codex, the Antigravity SDK and the AI SDK each show how to pass one. Quotes: `research/patterns.md`.

There are two kinds:

- `titan`'s own tool server, `titan tool-server`. Every agent gets it. It offers the knowledge hub tools `kb_search`, `kb_get`, `kb_add`, `kb_update` and `kb_delete`. `titan` starts one for each agent and passes the run folder and the step id in environment variables. That is how a change made by the agent is marked `pending` with the right step.
- tool servers that the main agent lists in a persona's `tool_servers` field, each with a `name`, a `command`, `args` and `env`. This is how the main agent plugs in any tool, for any vendor.

A test tool server with one tool answered a client in 105 ms. Output: `research/probes/backend-port/toolserver-output.txt`. This is one run, not a benchmark.

- _Why:_ the user asked for tools and other parts that plug into each agent tool. With one way for all vendors, a tool is written once.
- _Considered:_
  - Each tool written in each vendor's own form, such as Claude's `tool()` or Python functions for Antigravity. The Codex SDK types have no option for functions, and each tool would be written up to four times.
  - Claude's in-process tool server, which runs inside `titan`. It works for Claude only. It may later be added to the Claude adapter, behind the same port.

### 12. New vendors and embedders come as plug-in packages

A plug-in is an npm package. Its default export is one object with `specificationVersion`, a `name`, and lists of `backends` and `embedders`. The main agent names plug-ins in the workflow file's `plugins` list. A person can also name them in `~/.titan/config.yaml`.

`titan` loads each plug-in by these rules:

- it looks for the package from the user's project folder, with `Bun.resolveSync(name, folder)`;
- it refuses a plug-in whose `specificationVersion` differs from its own, and names both versions;
- it refuses a backend whose id is already used;
- it lists plug-in backends in `titan backends`, like the built-in ones.

`knowledge.db` records the name of the embedder that made its embeddings. When the embedder changes, meaning search stops and asks for `titan kb reindex`, because embeddings from two embedders cannot be compared.

A test showed each loading rule. Its first try failed: `titan` looked for the package from its own folder and found nothing. Output: `research/probes/plugins/`.

- _Why:_ the user asked that the design can be extended. The AI SDK does the same for its providers: it tells others to "publish your custom provider in your own GitHub repository and as an NPM package".
- _Considered:_ building every vendor into `titan`. Each new vendor would then need a new `titan` release.

### 13. Claude Code: one `query()` call per agent

The Claude adapter calls `query()` once for each agent. It passes the persona as described in the decision on tools, skills and tool servers, the folder as `cwd`, and the schema as `outputFormat`. It continues a session with the `resume` option.

- _Why:_ each agent starts with a fresh context. A falsifier never sees the reasoning of the agent it checks, so it cannot be talked into agreeing.
- _Considered:_ one long session with subagents. The falsifier would then share context with the worker.

### 14. Codex: one thread per agent

The Codex adapter calls `startThread()` once for each agent. It sets `workingDirectory` to the step's folder and passes the schema as `outputSchema`. It sets `skipGitRepoCheck: true` only when the workflow file asks for it. It passes the tool servers in the `config` option, as `mcp_servers`. The Codex README says the SDK turns `config` into `--config key=value` flags. It continues a thread with `resumeThread()`.

- _Why:_ the same fresh-context reason as for Claude Code.
- _Considered:_ reusing one thread. Same problem as above.
- _Open point:_ the README says Node.js 18 or newer. A test must show that the SDK also works under Bun. If it does not, the adapter starts a small Node.js process for it.

### 15. Antigravity: a small Python helper, started by `titan`

The Antigravity SDK only exists for Python. The Antigravity adapter starts a small Python script that ships with `titan`. It sends one request per line on standard input and reads one JSON answer per line on standard output. The script uses `Agent` and `LocalAgentConfig` from `google.antigravity`, as in Google's example. Google's docs show `system_instructions` for the role text and `mcp_servers` with `McpStdioServer` for tool servers. They also say that an agent runs "in read-only mode" by default.

- _Why:_ the user asked for the Antigravity SDK, and it runs on the user's computer.
- _Considered:_
  - The Gemini Interactions API in `@google/genai`. It is a JavaScript package, but its agent runs "inside your own secure Linux sandbox, hosted by Google". That is a cloud agent, which is a non-goal. Source: https://aistudio.google.com/docs/antigravity-agent.
  - `agy --print`. It works today, but it is the command-line tool, not the SDK that the user asked for. It stays as the fallback in Open Questions.

### 16. Model APIs: one adapter on the Vercel AI SDK

The three model API backends share one adapter. It uses the Vercel AI SDK: the package `ai` with `@ai-sdk/anthropic`, `@ai-sdk/openai` and `@ai-sdk/google`. For each agent, the adapter:

1. opens an MCP client from `@ai-sdk/mcp` to `titan`'s tool server and to each of the persona's tool servers;
2. calls `generateText()` with the role text as `system`, the tools of those servers, the output schema, and a limit of 20 tool steps;
3. keeps the messages of the session in memory and in the run record, so that `titan` can continue the session with the next message.

The AI SDK packages read the keys from `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` and `GOOGLE_GENERATIVE_AI_API_KEY`. These names were read from the package files on this machine. The limit of 20 tool steps is a guess that has not been measured. The adapter passed the TypeScript check. It has not made a live call yet. Code: `research/probes/backend-port/api.ts`.

- _Why:_ one adapter covers three vendors. The AI SDK runs the tool loop, so a persona on a model API can use tool servers and the knowledge hub during its turn. A plug-in can add another vendor that the AI SDK covers and reuse this adapter.
- _Considered:_ each vendor's own package, such as `@google/genai` for Gemini. That is three adapters, three tool loops and three ways to ask for a structured answer.

### 17. The workflow file is YAML, checked against a schema

The main agent writes the workflow file in YAML. `titan` reads it with `Bun.YAML.parse` and checks it with a zod schema. _zod_ is a TypeScript library that checks data against a description of its shape. When the file is wrong, `titan` stops before it starts any agent. It names the field and says what is wrong, so the main agent can fix it.

- _Why:_ the main agent writes this file and the improver rewrites it. A schema can check both before anything runs. People can still read the file and its comments.
- _Considered:_
  - JSON: no comments, and harder for people to read.
  - A JavaScript file, like the dynamic workflows in Claude Code. Code can do anything, so `titan` could not check a written workflow before running it.

A short workflow file, as the main agent could write it, looks like this:

```yaml
name: fix-flaky-test
goal: Find why test "orders total" fails sometimes, and fix it. A good answer is a fix that passes 50 runs in a row.
harness: auto            # or claude, codex, antigravity
personas:
  investigator: { use: investigator@2 }    # found in the register
  skeptic: { use: skeptic@5 }              # found in the register
  judge:
    mutates: judge@1                       # close match, changed for code
    role: You compare two fixes. Prefer the one that is correct, smaller and faster.
    tools: [Read]
  fixer:                                   # new: not in the register yet
    description: Writes the smallest code change that fixes a known cause.
    tags: [code, bugfix]
    role: You write the smallest code change that fixes the cause.
    tools: [Read, Edit, Bash]
    tool_servers:                          # a tool server from this project
      - { name: orders-db, command: bun, args: [tools/orders-db-server.ts] }
    inputs:
      cause: { type: string, description: The root cause, with file and line }
    outputs:
      patch: { type: string, description: A unified diff }
  improver: { use: improver@3 }
steps:
  - sequential:
      - id: cause
        do: { persona: investigator, task: "Find the root cause of the failure." }
        candidates: 3
        judge: judge
        falsify:
          - { persona: skeptic, task: "Show a failing run that this cause does not explain." }
      - id: fix
        inputs: { cause: cause.root_cause }
        do: { persona: fixer, task: "Fix the cause." }
        candidates: 2
        falsify:
          - { script: "bun test --rerun-each 50 orders" }
          - { persona: skeptic, task: "Find an input where the fix breaks something else." }
        judge: judge
improve:
  persona: improver
  rounds: 1
  lessons: true
```

### 18. Steps, groups and order

A step has an `id`, a `do` part and checks in `falsify`, `verify` or both. The `do` part is a persona task, a script or an open call. Steps sit in groups. A `sequential` group runs its items one after another. A `parallel` group makes its items ready together, then starts them within the parallel limit and waits until all finish. Groups can contain other groups. A step's `inputs` field names the outputs of earlier steps that it needs. `titan` then puts those outputs in the step's task.

- _Why:_ the main agent states for each group whether it runs in parallel or in sequence. Results flow only through `inputs`, so the order is easy to check.
- _Considered:_ a free graph of steps with arrows. It is harder to read and harder for the improver to rewrite.

### 19. Every step must be falsified

The schema rejects a step with no entries across `falsify` and `verify`. Proof checks run before persona falsifiers. Each falsifier is a persona with a task, or a script. A persona falsifier must be a different persona from the one in the step's `do` part.

- A persona falsifier answers in a fixed JSON form: `verdict` (`refuted` or `survived`) and `evidence` (text).
- A script falsifier refutes the result when it ends with a non-zero exit code. Its output becomes the evidence.

A result survives only when every falsifier says `survived`. When one refutes it, `titan` runs the `do` part again. It adds the evidence to the task. It stops after `max_attempts` tries. That number is 3 when the file does not set it. The 3 is a default chosen for this design, not a measured number. When a step runs out of tries, its dependent work stops. Independent parallel branches finish before the run becomes failed. The record then names the step and the last evidence. A step is never passed without surviving.

- _Why:_ the user asked for "falsification at each step". Evidence from a refutation gives the next try something concrete to fix.
- _Considered:_ a vote among falsifiers. One correct refutation is enough to show a result is wrong, so a vote would hide real errors.

### 20. Picking the best of several candidates

When a step sets `candidates: N`, `titan` runs the `do` part N times in parallel. It falsifies each candidate on its own. When more than one survives, the step's `judge` persona compares them two at a time. The winner of each pair goes on to the next pair, until one is left. The judge's role text comes from the workflow file, so the main agent writes what "best" means for this problem. Examples are "correct and smallest" or "cheapest plan that meets the goal".

- _Why:_ the user wants "the best, most efficient, and proven solution". Only survivors can win. Surviving these checks is evidence about this run; it does not prove the answer correct in every case. Comparing two at a time follows the advice in Anthropic's article on dynamic workflows: "comparative judgment is more reliable than absolute scoring". Source: https://claude.dev/blog/a-harness-for-every-task-dynamic-workflows-in-claude-code/.
- _Considered:_ asking the judge to give each candidate a score from 1 to 10. The article above says such absolute scores are less reliable.

### 21. The run record is a folder of plain files

Each run writes to `.titan/runs/<run id>/`. That folder holds:

- `workflow.yaml`: a copy of the file that was run;
- `events.jsonl`: one JSON line for each event, such as an agent start, an answer, a verdict or a retry;
- `board.jsonl`: the board, with every message and request between personas and the main agent;
- `requests.json`: the requests to the main agent that are still open;
- `steps/<step id>/`: the task, every candidate, every verdict and the kept result;
- `result.md`: the final result and a list of every step with its outcome.

For the Linux local runtime, events.jsonl and board.jsonl share one canonical append file through a checked hard link. Both names contain complete versioned events, including their run states and board requests. Every append keeps the same durable sequence under both names. Replay restores a missing event name for older runs. An unrelated file, directory or symbolic link at the event path blocks acknowledgement until it is repaired. This avoids a second journal with a separate crash boundary.

File-based CLI submission asks the authenticated local server to preserve its absolute source path. The server reads the file within the shared 1 MiB data allowance before reserving an identity. The source must compile to the submitted plan under the effective group-depth limit. Its exact byte hash joins the submission fingerprint, including comments and line endings. The engine validates and copies supplied bytes before asynchronous preparation. HTTP and MCP expose the same optional preserve_source field. Inline submissions omit that field and receive the validated workflow's YAML representation. Source paths can be outside the project on the shared machine.

A run that stops halfway can be continued with `titan resume <run id>`. Steps that already survived are not run again.

- _Why:_ the main agent, people and the improver can all read plain files. Step inputs are read from here.
- _Considered:_ a SQLite database. It is harder to read without a tool, and this change does not need queries.

### 22. The self-improving loop

After a run, `titan` starts the improver persona when the file has an `improve` part. The improver reads the run record. It looks at which steps were refuted, how often, why, and how many agents were used. It writes a new workflow file. That new file then goes through three checks, in order:

1. The zod schema must accept it.
2. A falsifier persona tries to show that the new file is worse or drops part of the goal.
3. `titan` runs the new file on the same goal. It compares the new run with the old one.

The improver may not add or change executable commands, including proof scripts, tool-server commands and plug-ins. Protected proof checks, goal text and approval rules also remain fixed. Scripts still follow the approval checks. Only the main agent writes scripts, when it designs the workflow.

The new file wins only when its run passes. It must also use no more attempts and no more agents than the old run. `titan` saves it as `<name>.v<N>.yaml` next to the old file. It never overwrites the file that the main agent wrote. `improve.rounds` sets how many rounds run.

A workflow can also set `improve.lessons: true`. The improver then writes short lessons, such as "check time zones first". A lesson is kept only when the new file that holds it passes the same three checks. Kept lessons go into the knowledge hub as entries of kind `lesson`, with the run and step they came from. When a lesson changes a persona's text, `titan` saves it as a new version of that persona in the register. `titan lessons` prints them; it is short for `titan kb search --kind lesson`. The guide tells the main agent to read them before it designs a workflow. This way the next design starts from what earlier runs learned.

- _Why:_ the user asked for a self-improving loop. The same falsify-first rule applies to the workflow itself, so a change cannot sneak in a worse file. Lessons carry what was learned from one problem to the next design.
- _Considered:_ letting the improver edit the file in place without a new run. Nothing would show that the change helps.

### 23. Monorepo layout and how `titan` ships

The repository is one Bun workspace. The root `package.json` lists `apps/*` and `packages/*` under `workspaces`. Packages use each other with the version `workspace:*`. Versions that several packages share, such as `zod` and the AI SDK, are set once in a catalog in the root `package.json`, and packages refer to them with `catalog:`.

| Folder                         | What it holds                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/cli`                     | The `titan` command: argument parsing and output. It is the only place that picks the adapters and loads plug-ins.                         |
| `packages/core`                | The ports `AgentBackend` and `Embedder`, the shared types, the error types and the plug-in loader. It depends on no other `titan` package. |
| `packages/runner`              | The facade `runWorkflow()`, `resumeRun()` and `answerRequest()`; step order, groups, inputs, the run record and `resume`.                  |
| `packages/config`              | Shared setting definitions, defaults, Zod and JSON schemas, source resolution and immutable effective settings.                            |
| `packages/process`             | Bounded Linux command capture, binary pipes, cancellation and process-group cleanup. Runner owns approvals and container policy.           |
| `packages/workflow`            | The workflow schema and YAML reader, using shared setting definitions from config.                                                         |
| `packages/guide`               | The guide text, `titan schema`, `titan lessons`, `titan plans` and the plug-in that `titan install` writes.                                |
| `packages/registry`            | The persona register: versions, mutation, history, states and the persona pick. Search goes through `packages/knowledge`.                  |
| `packages/knowledge`           | The knowledge hub: files, the hub index, word search, the SQLite index, version checks, `titan kb` and pending changes.                    |
| `packages/board`               | The board, requests, approval levels, `titan answer`, `titan approve`, `titan deny` and the pause with exit code 3.                        |
| `packages/server`              | `titan serve`: the HTTP API, server-sent events, tokens, the scheduler of the hive, and `titan mcp`.                                       |
| `packages/policy`              | The policy for each kind of goal: rewards, split width, trails, alarms, `titan policy show` and `titan traces export`.                     |
| `packages/falsify`             | Falsifiers, retries, candidates and the judge.                                                                                             |
| `packages/improve`             | The self-improving loop and the lessons store.                                                                                             |
| `packages/detect`              | The detection of the agent tool, backend choice and `titan backends`.                                                                      |
| `packages/tool-server`         | `titan tool-server`: the knowledge hub tools over MCP.                                                                                     |
| `packages/backend-claude`      | The adapter for the Claude Agent SDK.                                                                                                      |
| `packages/backend-codex`       | The adapter for the Codex SDK.                                                                                                             |
| `packages/backend-antigravity` | The adapter and the Python helper for the Antigravity SDK.                                                                                 |
| `packages/backend-api`         | The adapter for the three model APIs, on the AI SDK.                                                                                       |
| `packages/backend-runpod`      | The plug-in with the `runpod-vllm` and `runpod-worker` backends, the run clock and the `titan worker` handler.                             |
| `packages/backend-fake`        | A fake adapter with scripted answers, used by tests.                                                                                       |
| `packages/embedder-local`      | The embedder with `@huggingface/transformers` and `Xenova/all-MiniLM-L6-v2`.                                                               |
| `packages/embedder-fake`       | A fixed embedder that gives the same vector for the same text, used by tests.                                                              |
| `test/`                        | Unit, integration, contract, end-to-end and live tiers; shared helpers, vendor fixtures and `testing/support/guard.ts`.                    |
| `tooling/scripts/`             | `check-scenarios.ts` and `check-commits.ts`.                                                                                               |
| `examples/`                    | Four workflow files that the guide shows: a code fix, a science claim, a business plan and an everyday problem.                            |

One rule keeps the parts apart: an adapter package (`backend-*`, `embedder-*`) depends only on `@titan/core` and its vendor's packages. No package depends on an adapter, except `apps/cli`. A test reads every `package.json` and fails when this rule is broken.

`titan` ships as a Bun package that runs from source. A test showed why: a single file made with `bun build --compile` could not load the embedder, because its image library `sharp` did not load. It loaded `sqlite-vec` only when the file `vec0.so` lay next to it. Output: `research/probes/monorepo/`.

- _Why:_ the user fixed the stack as a Bun monorepo. Bun's own workspaces and catalogs give shared versions and links between packages with no extra tool. The rule on dependencies keeps the ports and adapters apart, so a vendor can change without a change to the core.
- _Considered:_
  - Turborepo on top of Bun workspaces. Its install page shows the Bun command, and says nothing more about Bun. The layout uses small packages and one app, and needs no build cache yet. It can be added later without moving code.
  - One packages folder per layer, such as `packages/adapters/*`. Bun's workspace globs would allow it, but one flat folder with name prefixes is easier to scan.
  - One file made with `bun build --compile`. It failed in the test above.

### 24. Tests and documents

The whole test plan is in spec test-strategy, and the evidence is in `research/dev-standards.md`. In short:

- `bun test` never reaches a real API. The guard file removes keys and blocks disallowed calls early. An operating-system boundary must also block child processes from reaching external hosts, while allowing loopback fakes.
- Each outside service has a fake with its own tests. Each port has one contract test that runs against the fake, and against the real service in a live test.
- Unit tests check each rule with numbers, with the examples from the specs and property tests with fast-check.
- Integration tests join the real parts with fakes, each in a new temporary `TITAN_HOME`.
- `tooling/scripts/check-scenarios.ts` checks that each scenario has exactly one test with the name `<spec> > <scenario>`.
- Complete coverage inventories every product file and fails under 90 % of lines or functions. Focused hook tests do not claim complete coverage. StrykerJS runs once a day on four packages and fails under a mutation score of 80 %. Both bars are guesses that have not been measured.

The end-to-end tests run the `titan` command with the fake adapter on all four example files. They check the run record. The tests produce reports and failure evidence only. Documentation is maintained separately and checked against the command contract and workflow schema. Neither passing nor failing tests generate documentation.

For each real agent tool there are two live tests. They cost money, so they run only when an environment variable is set, such as `TITAN_LIVE_CLAUDE=1`:

- an adapter test that starts one agent;
- a main-agent test. The main agent gets a problem with no workflow file. It must write a file that passes `titan check`, run it, and report the result.

Each live test of an agent starts from an empty `TITAN_HOME` and runs 3 times. It passes only when all 3 pass. Anthropic's guide to agent evals asks for trials that start clean, and for a measure of how often all tries pass. The number 3 is a guess that has not been measured.

- _Why:_ the user asked for unit tests that do not call real APIs, plus integration tests and test cases. In the probe, a guard without `node:https` let a request reach example.com, and `curl` in a child process reached it with HTTP 200. Only the guard with both checks blocked them.
- _Considered:_
  - Recordings of real answers, replayed in tests, such as Polly.JS or MSW. A recording can hold a key, and it goes out of date when the vendor changes. The agent SDKs also talk to a child program, so an HTTP recorder does not see their calls.
  - Mocks that only check which functions were called. The Google book on software engineering says that too many mocks made tests that "got out of sync with the real implementation". `titan` uses fakes that work, and checks the result.
  - A block of the network by the operating system, with `unshare -rn`. It failed in the sandbox of this session with `Operation not permitted`, so it was not tested.

### 25. The hive: a blackboard with limits, where any agent can add steps

The main agent writes the first plan. The `titan` server then runs it as a hive:

- A step starts as soon as the steps it needs have survived and an agent place is free. Each new board entry makes the server look again.
- Any agent can send an `add_step` request. `titan` acts on it only after the sender's result survived. Each added step needs a falsifier, like any other step.
- A step can be an _open call_: tags and a task, but no persona. `titan` picks a persona from the register, as in decision 27. When none fits, it asks the main agent for a new persona.
- A step can _split_ a list of parts over several agents. The policy in decision 29 picks how many run at once, unless the file sets it.
- Each run has `limits.max_steps` (default 50) and `limits.max_parallel` (default 4). Both are guesses that have not been measured. Going over a limit sends one `raise_limit` request, never a silent stop.
- Each worker sees the list of steps of its run. A falsifier still sees only the goal, the task and the result.
- Many runs share one server, the register, the knowledge hub and the policy. Each run has its own board.
- _Why:_ the user asked for a hive where every agent can add steps, or ask the main agent or the person. The blackboard was the user's choice. The runaway test in `research/hive.md` showed why the limits are needed.
- _Considered:_ a fixed pipeline, and a lead agent that must plan every step up front. Both are in `research/hive.md`, section 1.

### 26. Approval levels for each kind of request

Each request kind has a level: `auto`, `main` or `human`. The table of kinds and default levels is in spec approvals. The person sets levels in `~/.titan/config.yaml`. A workflow file can only raise a level. `delete_persona`, `action`, `raise_limit` and `paid_compute` never go below `human`. The main agent can pass a request up to the person. A request at level `human` needs the person token, so the main agent's token gets status 403. The first answer wins, and a second one gets status 409. Waiting for an answer ends the agent's turn, and its session goes on when the answer comes.

- _Why:_ the user asked that agents can ask the main agent or the person to approve, for steps, skills, tools and everything else. Codex stops a tool call after 60 s, so an agent cannot wait for a person inside a tool call.
- _Considered:_ approve everything, and approve nothing. Both are rejected in `research/hive.md`, section 2.

### 27. The persona lifecycle

Each persona version has measures and a state, as in spec persona-lifecycle. A version becomes `proven` when the Wilson lower bound of its survival rate is above 0.6, and `needs_update` when the upper bound is below 0.6. The 0.6 is a guess that has not been measured. `needs_update` sends an `improve_persona` request to the main agent. The new version runs next to the old one until one is better. Near duplicates are offered as a merge. A delete needs the person, and the file moves to `.history/`.

For an open call, `titan` picks a persona by Thompson sampling on counts that fade by 0.98 for each new result. With N eligible versions, each has probability `min(0.1, 1/N)` before the rest follows Thompson sampling. Versions in `needs_update` remain eligible until retired. The 0.98 and the 10 % are guesses that have not been measured.

- _Why:_ the user asked how a persona that needs an update or a delete is measured, and for the lifecycle. In the test, a rule after 3 uses flagged 39.4 % of good personas, and the Wilson rule flagged 2.2 %. Plain Thompson sampling failed when personas changed, and fading counts passed.
- _Considered:_ a fixed number of uses, greedy picks, and Thompson sampling without fading. Each is in `research/hive.md` or `research/orchestration.md`.

### 28. A local server that the command line and the agent tools call

`titan serve` runs a Bun HTTP server on 127.0.0.1 only. It needs a token, and it refuses calls from web pages of other sites. The board files are the truth, and the server rebuilds its state from them when it starts. A step interrupted by restart continues its logical attempt from a consistent checkpoint. The board records the new execution segment and its restoration mode. Live events go out as server-sent events, and a client that reconnects gets the events it missed. The `titan` commands are clients, and start a server when none runs. `titan mcp` is a tool server for the agent tools, and its tools return at once.

Startup owns each resource as soon as it acquires it. A failure in settings, database setup or address publication closes acquired resources and releases the home lock. A successful start transfers that ownership to one shared shutdown operation. Repeating shutdown cannot remove a later server's address or lock. The current implementation uses Bun's asynchronous disposal stack; forced process death and stale-lock reconciliation need separate recovery checks.

`titan install` writes one plug-in in the Claude Code form, with the skill `titan` and the tool server `titan mcp`. Claude Code installs it, Antigravity imports it, and Codex gets the same skill in `.agents/skills/` plus `codex mcp add`.

- _Why:_ the user asked that `titan` plugs into an agent tool through a skill or a command. They also asked for a command-line tool and a server that does the work, so that others can hook into it.
- _Considered:_ a server that keeps its state in memory: it lost all steps in a crash test. A server on all network interfaces: the MCP rules say a local server should bind to 127.0.0.1. Both are in `research/hive.md`, section 4.

### 29. A self-training orchestration with reinforced loops

`titan` learns from each run, as in spec self-training-orchestration. It keeps a policy for each kind of goal, with three loops:

1. _Split width._ The reward is the share of results that survived, minus a cost for time on the critical path, minus a cost for each agent started. The update compares each run with the mean of the last 4 runs of the same kind, as GRPO does.
2. _Persona pick._ Thompson sampling on fading counts, as in decision 27.
3. _Plan shapes._ The plans of earlier runs, with their rewards, go into the knowledge hub. `titan plans <kind>` shows the best ones to the main agent.

Two alarms watch each policy, one for serial collapse and one for empty agents. Each width trail fades by 0.98 once per terminal run, under the seeded update rule in spec self-training-orchestration. The policy only picks among choices that pass the checks, the limits and the approvals. All weights, group sizes, fades and alarm numbers are guesses that have not been measured. The person sets the cost of time and of each agent, because that choice trades time against money.

`titan` does not train model weights. It writes traces, so that someone can train an open-weight orchestrator model elsewhere. That model can then enter `titan` as a persona in state `trial`.

- _Why:_ the user said that the earlier design would lead to serial collapse. They asked for a native self-training orchestration with reinforced loops, like a self-organising organism. The agent tools' models cannot be trained by `titan`, so `titan` learns its own choices.
- _Considered:_
  - Kimi K2.5's rewards, with a parallel bonus and a finish reward lowered to 0. In the toy, they left empty agents in 100 % of runs, because nothing charged for an agent once the bonuses reached 0. `titan` keeps the bonus only as a short fix when the serial collapse alarm is on.
  - Training an orchestrator model, as Puppeteer and ToolOrchestra do. It needs open weights and GPUs, so it is an optional later step.
  - A reward for the outcome only. It gave serial collapse in 38.5 % of runs in the toy.
  - The full comparison is in `research/orchestration.md`, section 2.

### 30. Agents on RunPod serverless, with at most 1 hour for each run

The plug-in `@titan/backend-runpod` adds two backends through the backend port:

- `runpod-vllm`: the agent's turn runs in `titan`, and the model runs on a private RunPod vLLM endpoint. It uses `@ai-sdk/openai-compatible` 3.0.75 with `ai` 7.0.163, and gets tools through tool servers only.
- `runpod-worker`: a whole persona session runs as a RunPod job in a container with the `titan worker` handler. It cannot use tool servers that run on the person's computer.

A run with RunPod personas has `limits.max_minutes` of 60 or less, counted on the clock from the start of the run. Each job gets an `executionTimeout` and a `ttl` no longer than the time left. `titan` cancels every open job 30 s before the deadline, a guess that has not been measured. At the deadline, the run ends as `timed_out`, and `result.md` lists what survived and what was cut off. Before the first RunPod job, the person approves a scoped `paid_compute` request. It shows the planned allowance and says that billing is not capped. The key comes only from `RUNPOD_API_KEY`.

- _Why:_ the user asked for places to add agents on top of RunPod serverless, with a time limit of "maximum 1 hour per workflow". RunPod's own defaults would let a job run for 10 minutes and stay for 24 hours, so `titan` must set both limits itself. The first test showed that the `ttl` alone removes jobs before `titan` can cancel them.
- _Considered:_ RunPod's public endpoints through `@runpod/ai-sdk-provider`. That package targets public endpoints, not private ones. Another serverless GPU host can be added later as a plug-in in the same way.

### 31. Code standards and how work flows

The rules are in spec dev-standards, and the evidence is in `research/dev-standards.md`:

- One command, `bun run check`, runs Biome, the type check, the tests with coverage, the scenario check and the plain-language check, in this order.
- TypeScript runs in strict mode, with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Bun does not check types, so `tsc --noEmit` does.
- Biome 2.6.5 formats and lints, with the `project` rules and `noFloatingPromises`. It runs with `--error-on-warnings`.
- Work goes to `main` in small commits, as in trunk-based development. Scoped hooks check local changes. Complete verification runs locally through the required hooks. GitHub Actions is forbidden unless the person explicitly requests it; general permission to push does not grant that permission.
- New commit subjects follow Conventional Commits 1.0.0. Versions follow SemVer 2.0.0.
- Each design decision is written down here, with what was chosen, why and what else was considered.
- A check after each live test fails when a file holds the value of a key. It prints only the file name and the variable name.
- _Why:_ the user asked for research on the best development and code standards, added through OpenSpec. In the probe, `biome ci` exited with code 0 on a file with 20 warnings. It found a promise with no `await` only after `noFloatingPromises` was turned on by name. StrykerJS found 5 surviving mutants in files with 100 % line coverage.
- _Considered:_
  - ESLint with typescript-eslint. It has more type-aware rules than Biome, but it was not tested here.
  - A community StrykerJS runner for Bun. StrykerJS has no official Bun runner (stryker-js issue #5424). Its command runner worked in the probe. The community runner was not tested.
  - Gitleaks, to find keys in the repository. Its README says it is feature complete and gets security fixes only. It was not tested here. The key check above needs no new program.
  - Long-lived feature branches. The DORA research on trunk-based development names at most 3 active branches, merged at least once a day.

### 32. What `titan` takes from other multi-agent frameworks and papers

The evidence is in `research/swarm.md`. `titan` takes these ideas:

- A _stall count_ for each run, as in Magentic-One. When a step repeats a refuted result or fails, the count goes up. Past 2, `titan` starts no new step and sends one `replan` request to the main agent, at level `main`. This is in spec hive-collaboration.
- Failure kinds from the MAST paper. A falsifier can name one of 14 kinds in a refutation, and `result.md` counts them. They are hints and never change a verdict, as in spec step-falsification.
- Rules in the guide on when not to split work. Steps that need the one before them, or that change the same file, run in a sequence with one agent. This is in spec main-agent-guide.
- `candidate_backends`, so a step's candidates can run on different models. It is a choice in the workflow file, not a default, as in spec step-falsification.
- A blocking check that no task text holds a key value, before any agent starts. This is in spec backend-selection.
- `titan trace`, which writes the run record as OpenTelemetry spans with the GenAI names to `spans.json`. It sends nothing over the network, as in spec workflow-run.
- An A2A agent card at `/.well-known/agent-card.json`, as in spec titan-server. It is the only route without a token, and it holds no token.
- _Why:_ the user asked for research on competing open-source swarm frameworks and papers, to see what is worth adding so that `titan` meets the current industry standard. Step repetition was the most common failure kind in MAST. A parallel check let the model run once in the test. In the toy, the vote error was about 40 times higher when all votes shared one mistake.
- _Considered:_
  - A majority vote in place of the falsifier and the judge. Two papers found that voting gives most of the gain of a debate. The newest paper found that samples from one model share most of their errors, and the toy agrees.
  - Handoffs, as in the OpenAI Agents SDK and LangGraph Swarm. The `ask` request already works as an agent as a tool, and the agent of a step must stay the one whose result is falsified.
  - Stop conditions joined with AND and OR, as in AutoGen. Each `titan` limit already stops a run on its own, which is the same as joining them all with OR.
  - LangGraph, the OpenAI Agents SDK or Mastra as the engine of `titan`. LangGraph's SQLite checkpoint failed under Bun, and `titan` runs the vendors' own agent tools through its backend port.
  - Ruflo's queen with Raft or Byzantine voting. One local server owns the board, so there is nothing to vote on between servers. None of Ruflo's numbers were tested here.
  - Full traces of every agent for every other agent, as Cognition advises. Workers already see the plan of their run. Falsifiers stay blind to the worker's reasoning on purpose.

### 33. Close the contracts found in the readiness review

This decision replaces conflicting parts of decisions 3, 5, 7, 9, 18, 20, 21, 27, 28, 29 and 30. The review and its limits are in `research/readiness-review.md`.

- Only kept candidates publish hub changes. The hub uses `knowledge/persona/` for personas and also accepts entries of kind `plan`.
- Candidate attempts and falsifiers use the shared live project tree under blackboard scope negotiation. Immutable snapshots retain each reviewed evidence generation. This follows the person's later shared-fabric decision and supersedes the earlier separate-worktree requirement.
- Every active agent role counts against the parallel limit. Waiting agents release their place, and circular help requests are refused.
- The board records resolved choices and immutable result paths before acknowledging changes. Event logs are views of that board. One server writer owns each home.
- Recovery keeps the original deadline. An external action with an unknown outcome waits for the person, rather than running again.
- A RunPod run cannot extend past its original hour. A new run needs a new paid-compute approval. A cancellation request is not proof that billing stopped.
- Remote workers use a bundled hub server over a final-entry snapshot. Only their kept pending changes return to the host hub.
- Ordinary JSON commands print one final object. Protocol commands reject `--json`; the server prints readiness and keeps running.
- Rewards for empty runs stay finite. Policy updates count each terminal run once. Alarms use an effective multiplier without changing the person's configured weights.
- Specification-only commits use the tracked Python checks before the Bun workspace exists. Releases need a clean install from the packed package.
- _Why:_ these rules close conflicting requirements and give tests one observable result for each case.
- _Considered:_ leaving each adapter to decide. That would make approval, recovery and publication differ by vendor.

### 34. A read-only dashboard in `titan serve`, and spans for any trace viewer

`titan serve` serves its own dashboard, as in spec run-dashboard. It builds the page from the board and the run records, so it shows what only `titan` knows: the step graph, attempts, verdicts, proofs and open requests. It updates over server-sent events. A person gets a one-time code from `titan dashboard`. The code becomes an `HttpOnly`, `SameSite=Strict` cookie. Calls from other sites get status 403. The page only reads. The cookie does not work on the API routes that change things.

When the person sets `OTEL_EXPORTER_OTLP_ENDPOINT`, `titan` also sends the spans of each run over OTLP/HTTP, as in spec workflow-run. The spans hold no prompt or answer text unless the person sets `TITAN_TRACE_CONTENT=1`. The guide shows Jaeger as the example.

- _Why:_ the user asked for a self-hosted dashboard of past and running workflows, with telemetry. The test showed that any of four trace viewers can show the spans. None of them knows the board, so `titan` needs its own page as well. Jaeger was the smallest viewer in the test, at 13.93 MiB, with the Apache-2.0 license.
- _Considered:_
  - A trace viewer only, with no page of `titan`. It cannot show open requests, candidates or the proven share.
  - Langfuse as the example. It worked, but it needs 6 containers and 1826.6 MiB.
  - Phoenix as the example. Its license is the Elastic License 2.0, and it contacted an outside service.
  - The Aspire dashboard as the example. It keeps no data after a restart, and its page did not show in headless Chrome.
  - Buttons on the page to answer requests. They would need the person token in a browser. This is an open question.
  - The full comparison is in `research/dashboard.md`, section 7.

### 35. Proof checks with locked statements

A goal or a step can have a `verify` list, as in spec verified-checks. `titan` runs three kinds of checks, each as a separate program:

- `lean`: `lake comparator` of Lean 4.35.0 or later, on Linux, as a user that is not root, with no network.
- `smt`: the `z3` program. `titan` reads the first word of the answer, not the exit code.
- `script`: a fixed command, such as a test run, that `titan` runs twice on the first candidate to see that it gives the same answer.

Each check answers `proven`, `refuted` or `not proven`. Only `proven` lets a result survive. The checker's output goes back to the next attempt as evidence. The main agent writes the locked statement with every definition. The person approves it with a `lock_statement` request. `titan` keeps its SHA-256 hash on the board and checks it before each check. `proofs.json` holds every answer, and `result.md` shows "proven N of M". The reward and the persona measures count a result as survived only when its checks gave `proven`. `titan proof recheck` runs the checks again.

- _Why:_ the user asked that goals, tasks, steps and outcomes can be checked with real proofs, such as Lean, so that a run is measurable. In the test, only `lake comparator` rejected all 5 cheats. A proof shows only what its statement says, so the statement must be locked and approved. Z3 gave exit code 0 for all three answers, so the exit code cannot be the verdict.
- _Considered:_
  - `lake check`, or a plain Lean build. Both passed cheats in the test.
  - The `z3-solver` npm package inside `titan`. It failed under Bun 1.3.10.
  - The Lean REPL or lean-lsp-mcp as the judge. They help an agent work, but they do not check the statement. An agent can still use them as tools.
  - Dafny, Verus, TLA+, Rocq and Isabelle. They were not tested. A plug-in can add a kind later. This is an open question.
  - A model as the judge of a proof. A model does not give a fixed answer.
  - The full comparison is in `research/proofs.md`, section 8.

### 36. One reconciled contract and evidence-gated delivery

This decision replaces conflicting parts of decisions 18 through 35. The acceptance rules are in the capability specs. The sweep record and scenario-to-task map are in `research/end-to-end-review.md` and `research/acceptance-map.tsv`.

- `falsify` and `verify` together must contain at least one check. Only all-passing candidates can survive. Goal checks run after result assembly and can fail the whole run.
- The proof summary counts checks on kept step results and final goal checks. Failed attempts have separate totals. Recheck verifies saved hashes and records a new observation without rewriting earlier evidence.
- Split parts keep input order. Parallel file changes combine only without conflicts. No candidate changes the person's working tree automatically.
- Cancelled and timed-out runs cannot resume. Interrupted work preserves its logical attempt, ids and usage across physical execution segments. Operational interruptions do not become result refutations. Waiting sessions continue with their answers. Terminal runs update each shared measure once.
- Every helper, split and improvement evaluation spends the same finite work allowance. Evaluation runs cannot start nested improvement loops or reset a deadline.
- New command text, removed proof checks and changed locked statements fail deterministic improvement checks before any model judges them.
- Shared changes use one server writer. Candidate hub publication commits as a set or reports a conflict. An attempt can read its pending changes; other candidates cannot.
- Named plug-ins need an import approval. A preflight id lets the person answer before validation executes package code; changed hashes invalidate it.
- Dashboard login is the explicit code-authenticated exception. API tokens and dashboard cookies keep separate authority. The page renders untrusted text without executing it.
- Backends need setup and platform evidence before they are ready. SDK bindings remain provisional until the pinned adapter contract passes. A token alone cannot prove that a human answered.
- Policy updates use the explicit sampling, comparison and replay rules in spec self-training-orchestration. Policy constants remain guesses until measured.
- _Why:_ a developer and a tester need the same outcome at each boundary. A list of features alone cannot establish that the product is usable.
- _Considered:_ one large first release and model judgments of every contract. Stages reveal integration failures sooner; deterministic checks catch changes a model could miss.

The delivery stages are choices for this build, not estimates or evidence of completion:

| Stage                 | Scope                                                                                                           | Gate before advancing                                                                                                                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation            | Shared ports, central configuration, group and graph schema, test isolation, fake backend, board and CLI checks | Default test isolation defeats child Bun and Git-hook probes. Invalid plans start no work.                                                                                                                                        |
| Local path            | Isolated worker, script checks, inputs, approvals, records, cancel and recovery                                 | Fake examples pass through CLI, HTTP and MCP. Concurrent workflows overlap without crossing sessions. Installed mixed graphs recover checkpoints without spending result attempts. Late-result, artifact and conflict cases pass. |
| First real adapter    | Linux with the first adapter whose live contract passes; Claude is the initial candidate                        | Clean package install, live main-agent trials, tested permissions and cancellation. Record exact operating-system, Bun, SDK and agent versions.                                                                                   |
| Full capability build | Remaining adapters, meaning search, hive, lifecycle, dashboard, traces, learning, RunPod and proof kinds        | Each mapped scenario is executable. Each claimed backend and platform has live evidence. Unsupported combinations remain explicit.                                                                                                |
| Full release          | All accepted capabilities and all implementation tasks                                                          | No pending required scenario. Packed installation, release checks and evidence review pass. Effectiveness claims need the comparison below.                                                                                       |

Functional release and measured improvement are separate decisions. Learning stays experimental until an independent comparison passes. Before running that comparison, freeze tasks, correctness checks, budgets and scoring in `research/benchmark-protocol.md`. Start with code, science, planning and everyday tasks matching the four examples. The initial task and repeat counts must be justified there before results are seen. Compare one agent, fixed Titan and adaptive Titan with equal total allowances. Include planning and improvement overhead in cost and wall time. Save raw results and uncertainty. Promote only when correctness gates pass and a claimed benefit is supported by the comparison. Do not turn a survival rate or reward into a claim of truth.

### 37. Concurrent workflows belong to independent callers

A _client id_ identifies a submitting CLI or MCP client. A _submission id_ identifies one intended start, including retries. An optional _harness session id_ labels its originating conversation. These labels route work; tokens still determine authority.

- Choose one durable writer per home and many overlapping run executors. The daemon holds an exclusive SQLite transaction in a separate persistent `server-writer.db` for its lifetime. This file is never unlinked during normal operation; process death releases its operating-system lease. Directory metadata alone is not ownership. Legacy live or uncertain owners fail closed. Catalog queries use the Bun SQL Promise interface with validated result rows. A separate mutex serializes short commits, never complete workflows or agent calls. Racing clients connect to the winning daemon.
- Resolve harness detection in each caller. Persist its choice with absolute project paths. A daemon started by Claude can accept Codex and plain-shell API workflows without changing their defaults.
- Persist caller and submission ids before sending. The same ids and request hash recover the same run after a lost response. A deliberate repeat gets a new submission id.
- Keep independent run handles, sessions, callbacks, request sets and event cursors. The same project, workflow, persona and local step names can occur in several runs sharing the live tree.
- Bound active agent sessions across the server and within each run. Start with a server limit of 8, a guess to measure. Every active role counts; linked evaluations charge their parent once. Waiting releases capacity after its turn stops. Atomic reservations prevent concurrent starts from exceeding the cap. Unknown remote work retains its backend capacity until reconciled.
- Admit ready sessions round-robin across eligible runs. Never reserve future slots for an entire workflow. Preserve admission order after restart. Existing sessions need not be interrupted.
- Keep script and proof execution under their existing finite limits. The agent-slot cap is not a promise to bound all host processes or vendor account quotas. Backend-specific restrictions queue only affected sessions.
- Bind every answer to its explicit run, request and version. Route origin-filtered requests to their submitting conversation. Another authorized client can deliberately select a run; same-user tokens do not provide tenant isolation.
- Let one run wait, fail or cancel while other runs continue. Disconnecting an observer does not cancel work. Do not merge files between runs automatically.
- Show all runs in a global dashboard with origin filters, capacity, queue reasons and independent detail views. Keep queue time in deadlines and total elapsed time; show it separately from active work.
- Share only committed knowledge snapshots and serialized policy/history updates. Keep already resolved versions and choices stable for active work.
- _Why:_ users need independent workflows from several conversations, including several started by one harness. Passing runs in sequence cannot establish this behavior.
- _Considered:_ one daemon per harness or one global current run. Those choices fragment visibility or mix sessions. Unbounded parallelism can exhaust local and vendor capacity.

The local-path gate now includes a barrier test in which three fake workers must all start before any can complete. Test both different harnesses and one MCP connection. The concurrency matrix also covers fair admission, bootstrap races, duplicate submissions, crossed answers, same-project edits, cancellation and recovery. Serial execution and swapped callbacks must fail. Task group 26 owns this work; all cases remain pending until implemented.

### 38. Keep package discipline and make local verification lean

The sibling comparison is in `research/development-practices-review.md`. Its recorded verification report totals about 576 seconds across 40 steps. That is saved evidence, not a fresh benchmark or a Titan estimate.

- Keep native Bun workspaces, a committed lockfile, shared dependency versions, public exports and checked dependency direction. The package table describes ownership; create each package when its stage needs it.
- Keep strict types, missing-promise checks, cycle checks and boundary validation. Use one shared Biome style. Keep types and contracts in the shared types package, closed values in constants and text in messages. Enforce the later repair contract: no code comments and asynchronous filesystem I/O; pure calculations remain synchronous.
- Use one small Lefthook configuration. Pre-commit checks the staged snapshot without rewriting files. Pre-push selects changed packages and their transitive consumers, then runs focused types, tests and a stubbed CLI, HTTP and MCP smoke set.
- Compare every outgoing commit and both base and proposed package graphs. Shared configuration or uncertain ownership selects the full relevant offline checks. Missing checks never become a speed optimization.
- Keep `bun run check` as the complete local offline gate. Required checks must pass before a push or release. GitHub Actions is disabled and forbidden unless the user explicitly requests it; delivery must not enable, trigger or rely on it. This local-only rule supersedes the original CI proposal.
- Check secrets locally. Verify dependency changes and keep mutation evidence before release. Keep clean packed installation at release and on packaging changes. Schedules and remote automation require separate authorization.
- Reuse exact successful local results only when their complete input identity matches. Reuse is optional; failed, interrupted and changed inputs cannot produce a reusable success. A complete run without reuse must still pass. Avoid adding a build scheduler without measured need.
- Organize tests under `testing/unit`, `testing/integration` and `testing/e2e`. Contract cases use those tiers. Use strict versioned response scripts at vendor boundaries. Test actual pinned SDK mapping separately from the generic fake backend. Live vendor verification requires explicit authorization.
- Keep real Titan logic in integration and end-to-end tests. Use independent temporary homes, ports and processes. Bound test workers and retain deterministic overlap and recovery tests.
- Maintain documentation as readable source. Check local links, commands, option names and example syntax independently. End-to-end tests write reports only. Dashboard screenshots are optional test evidence.
- Inventory every product source file, including never-imported modules, and enforce the repair contract of complete line and function coverage. Keep mutation evidence separate and do not claim branch or mutation coverage without measurement.
- The original targets were 5 seconds for pre-commit, 15 seconds for an ordinary affected push and 60 seconds for a complete offline run, excluding installation. These were estimates, not achieved timings. Report actual stage timings and full fallbacks; the current multi-minute full hooks remain a delivery gap.
- _Why:_ the user needs clean package boundaries and detailed verification with short local feedback. The sibling's documentation build and complete local pipeline do not match this smaller product.
- _Considered:_ copying every sibling rule, running every check at push, or keeping only smoke tests. Those options add unrelated policy, repeat costly work or hide missing coverage.

This decision replaces earlier requirements to generate documents from end-to-end tests and run the complete suite before each local commit. It keeps the full correctness gates in authorized local verification and release. GitHub Actions requires explicit user authorization. Task group 27 owns implementation and timing evidence. No speed target is a measured product result.

### 39. Separate result quality from execution interruption

A logical attempt seeks one candidate result and its completed checks. An execution segment is one physical invocation inside that attempt. Rate limits, crashes and session loss create recovery work, not false evidence about the candidate.

Spec workflow-run defines consistent checkpoints, retry allowances and execution ownership. Spec harness-adapters distinguishes native restoration from authorized reconstruction. A checkpoint links conversation position, working files, pending work and the action journal. Completed work does not run again. The board rejects publications from superseded executions.

Native restoration remains the default. Reconstruction requires explicit authorization and reports the context it could not restore. Exact continuation means the last consistent durable boundary. Neither Titan nor vendor documentation promises access to unrecorded reasoning or arbitrary in-flight instructions.

- _Why:_ operational failures must remain visible without exhausting result attempts or teaching that a persona gave a wrong answer.
- _Considered:_ restarting from original inputs, treating every exit as refutation, and retrying forever. These lose work, mislabel quality or hide unbounded costs.

### 40. Compile group shorthand and explicit dependencies to one plan

Existing sequential and parallel groups remain valid. A workflow can instead declare `graph.nodes` with explicit `needs` edges. An edge means the producer must survive before its dependant runs. Graph array order controls display, not execution.

Both forms use one step schema and scheduler. Validation rejects cycles and missing input dependencies before work. Spec workflow-file defines the forms; spec workflow-run defines readiness and blocked descendants. Limits come from shared configuration and can be raised within owner ceilings. No fixed few-step or few-group shape is assumed.

- _Why:_ real work mixes fan-out, joins and sequential chains. One blocked branch should not stop unrelated eligible work.
- _Considered:_ only nested groups or implicit order from file placement. Groups cannot express every partial dependency without unnecessary barriers.

### 41. Centralize settings and freeze each accepted run

`packages/config` owns defaults, types, bounds, scopes and override permissions. It exports Zod and JSON schemas plus documentation metadata. It uses the core, types, constants, messages and errors foundation contracts. The streams foundation owns bounded byte collection and file reads; configuration parsing uses its explicit byte budgets. These foundation packages do not depend on product services. Core stays independent of product services. Adapters receive resolved settings through their existing ports.

Spec configuration defines files, precedence, source inspection, atomic writes and protected limits. Each run saves a secret-free effective snapshot and hash. File edits affect future runs. Owner revocations and server capacity remain live constraints. A scoped person decision can revise a run allowance without erasing earlier usage.

The proposed files, settings table and examples are in `research/recovery-config-delivery-review.md`. Existing defaults remain normative in their owning specs. New retry defaults are design guesses until measured.

- _Why:_ validation, help and runtime behavior must describe the same values. A hidden default in an adapter breaks that contract.
- _Considered:_ package-local environment reads or unrestricted workflow overrides. Both make runs difficult to explain and can bypass owner limits.

### 42. Make CLI targeting and delivered files complete contracts

Spec cli-control names the identifiers, selectors, lifecycle controls, output envelopes and exit codes. Run ids identify executions; workflow ids identify definitions; revisions identify accepted definition content. Commands never guess a mutating target from the latest run.

Inspection, export and application are separate actions. Code, documents and research use the shared live project tree under blackboard file-access negotiation. Immutable snapshots retain evidence without becoming execution copies. The kept artifact manifest binds hashes and check evidence. Applying a diff needs approval for its exact target base. External operations need intent and outcome records; uncertain effects wait for reconciliation.

- _Why:_ a successful step must produce something the user can inspect and use. A result message alone does not deliver code or a document.
- _Considered:_ printing only a run id or automatically copying agent edits into the person's project. Neither gives controlled, reviewable delivery.

### 43. Prove an installed preview before claiming readiness

Ship a versioned CLI package and all runtime package dependencies, running under Bun from source. Packed manifests resolve workspace and catalog references to installable versions. Package names remain proposed until registry ownership is verified.

Spec distribution requires a clean installed preview outside this checkout. Its stubbed mixed graph must survive an interruption and daemon restart, then expose its result and artifacts. A separately authorized real-adapter rehearsal follows. Full production release still requires all accepted capabilities and their evidence.

The support matrix records exact runtime and platform versions. Optional capabilities cannot prevent basic configuration or fake-backed document delivery. Self-development uses an installed controller and shared live source changes; active runs never load the edited controller.

- _Why:_ workspace links and development dependencies can conceal packaging failures. Running tests in the checkout cannot establish installability.
- _Considered:_ one compiled executable or a source-only checkout demonstration. Earlier native-library probes rejected the compiled path; checkout use omits the user's installation experience.

## Risks / Trade-offs

- [The names of the environment variables for Codex and Antigravity are not confirmed.] → A task records `env` from inside each tool before detection is built. Until then, `--harness` works.
- [It is not known how to give a persona tools and skills in Codex and Antigravity.] → A task finds out. Until then, `titan check` fails for those fields in those agent tools, and says so.
- [`sqlite-vec` is a pre-1.0 release, and macOS may block SQLite extensions.] → The plain files are the truth, so the index can be rebuilt or replaced. Word search keeps working without `sqlite-vec`. A task tests macOS.
- [People cannot check a meaning match by reading the embeddings.] → Each result shows its meaning score and the matched words, and word search gives a readable second opinion.
- [The swarm can write wrong facts into the knowledge hub.] → A change stays pending until its step survives falsification, and old versions are kept.
- [The embedding model is downloaded on first use. In the test the first run took 19307 ms, including the download.] → `titan kb reindex` downloads it once, before a run. This is a single measurement, not a benchmark.
- [The Codex SDK may not work under Bun.] → A task tests it first. The fallback is a Node.js child process.
- [The Antigravity SDK is in preview and only for Python.] → The Python helper is small and kept apart. `agy --print` is the fallback.
- [The main agent can design a weak workflow. For example, its falsifiers can be too easy.] → Every step needs a falsifier, and it must be a different persona from the worker. The guide asks for at least one falsifier with a tool or a script where the problem allows it. The improve loop and the lessons make later designs stronger.
- [Many agents cost money and use up limits.] → The workflow file sets `max_attempts`, `candidates` and `improve.rounds`. `titan run --dry-run` bounds the current static plan and names unknown work, such as runtime splits and helper requests.
- [Falsifier agents can be wrong too: they can refute a good result or miss a bad one.] → Script falsifiers, such as tests, give a fixed answer. Each persona verdict must include evidence, which the record keeps for review.
- [Agents in the SDKs may stop and ask for permission when nobody is there to answer.] → `titan` passes the workflow's permission settings to each SDK. A task checks how each SDK behaves without a person at the keyboard.
- [A plug-in is code from npm, and it runs with the user's rights.] → `titan` loads only the plug-ins named in the workflow file or in `~/.titan/config.yaml`. The run record lists each plug-in that was loaded, with its version.
- [The Codex SDK has no option for role text, so the role text goes in the first prompt. The agent may weigh it less than a system prompt.] → A task checks whether the Codex config key `developer_instructions` sets it.
- [The ports, adapters and tool server add packages and code.] → The Adapter page names this cost: "The overall complexity of the code increases". The port keeps only session creation, sending, cancellation and cleanup.
- [A new major version of an SDK or of the AI SDK can change its interface.] → Only the adapter for that vendor imports it. The catalog in the root `package.json` pins one version for the whole repository.
- [`titan` starts one tool server for each agent, which adds start time.] → One test call took 105 ms. This is one run, not a benchmark. A task measures it in a full run.
- [`titan` needs Bun on the user's computer, because it cannot ship as one file.] → `titan doctor` names the Bun version. The single file can be tried again when the embedder is a plug-in that is not part of that file.
- [A step can stop after an external action but before recording its outcome.] → Recovery marks the action `unknown` and waits for the person. It never reuses the old approval.
- [A hive uses many more tokens than one agent. Anthropic reports about 15× more tokens than chats for its multi-agent system.] → The limits on steps, agents at once and time, and the cost for each agent in the reward.
- [Other programs and web pages can call a server on the person's computer.] → It binds to 127.0.0.1 and needs a token. It refuses web pages from other sites.
- [The main agent runs with the person's rights. It could read the person token file.] → The person token file has mode 600, and the agent tools' permission rules can deny reading it. This does not stop an agent that runs with full rights. A task checks the permission rule in each agent tool.
- [A runaway hive could add steps without end.] → `limits.max_steps`, and one `raise_limit` request at level `human`.
- [The evidence for the policy comes from a toy with independent parts, not from real runs.] → Every number is labelled as a guess. `titan policy show` explains each choice, and the alarms tell the main agent when the policy goes wrong.
- [RunPod bills worker time, whether a job succeeds or not.] → The person approves a planned allowance, with no guaranteed billing cap. Stopping vLLM calls does not deprovision its endpoint.
- [RunPod's docs do not say whether a worker stops when the `ttl` removes its job.] → `titan` cancels jobs 30 s before the deadline, and does not rely on the `ttl`. A task checks this on a live endpoint.
- [The guard file works inside Bun only. Native code, or a program on the allowed list, could still reach the network.] → The list of allowed programs is short and has its own tests. A block by the operating system is an open question.
- [The bars of 90 % coverage and an 80 % mutation score are guesses.] → They are labelled as guesses. A task measures them on the first packages and changes them in a new decision.
- [Mutation testing is slow on a large test run. The probe took 3 s for 39 mutants on 2 small files.] → It runs once a day and before each release, on four packages only, not on each push.
- [The 9 commits already on `main` do not follow Conventional Commits.] → They keep their subjects. The check covers only commits after the rule.
- [A falsifier can name the wrong failure kind. The best tool in the Who&When paper found the failing step only 14.2 % of the time.] → A failure kind is a hint. It never changes a verdict, and `titan` already knows which step failed from the board.
- [The stall limit of 2 comes from Magentic-One, not from `titan` runs. A new plan may not make a run better.] → The limit is labelled as a guess. The `replan` request goes to the main agent, which can also answer that the plan stays.
- [Trace attribute names can change.] → One shared span builder serves file output and optional OTLP export. `titan trace` itself sends no network traffic.
- [Interrupted work can run again.] → Resume preserves checkpoints, logical attempts and physical usage. Recovery retries have their own durable allowance. Waiting sessions continue without spending another result attempt. Uncertain external actions wait for reconciliation.
- [The agent card is the one route without a token.] → It holds only the name, the address and the skill. A test checks that it holds no token.
- [The dashboard shows task text and evidence in a browser.] → It binds to 127.0.0.1, needs a one-time code and a `SameSite=Strict` cookie, and refuses other sites. It cannot change anything.
- [Spans sent to a trace viewer can leave the person's computer.] → `titan` sends nothing unless the person sets `OTEL_EXPORTER_OTLP_ENDPOINT`, and the spans hold no prompt or answer text by default.
- [Trace viewers change their routes. Jaeger 2.22.0 had no `/api/traces` any more, and Langfuse 4.66.0 had no `/api/public/observations`.] → `titan` only sends OTLP, a standard. It reads nothing back from a viewer.
- [A locked statement can say less than the person wants, and a proof of it then means little.] → The person approves each statement with its full text. The guide asks the main agent to write what a proof would and would not show.
- [Lean's sandbox works only on Linux, and in Docker it needed `--privileged`.] → `titan check` refuses `lean` checks on other systems. A task tests `lake comparator` on a Linux host without `--privileged`.
- [A Lean check can take long. `lake check` took about 62 s per case in the test.] → `titan` uses `lake comparator`, which took under 2 s, and stops a check after `timeout_s`.
- [Hard proofs are often not found. In one paper, all models but one scored 0 %.] → `not proven` is a normal answer. The run record keeps it, and the person sees the proven share.
- [A locked SMT file whose assumptions contradict each other proves anything.] → `titan` runs z3 on the assumptions alone first, and answers `not proven` when they contradict.
- [Anthropic does not allow third-party products to offer claude.ai login.] → `titan` is the user's own tool, run in the user's own Claude Code. The Claude adapter uses the login that Claude Code already has. Source: https://code.claude.com/docs/en/agent-sdk/overview.

## 44. Implement the first working slice with Codex and Claude Code

The first implementation targets Codex and Claude Code, as requested by the person. All other backends remain pending. This sets implementation order. It does not remove any accepted requirement or make the full change complete.

Use the Bun workspace with core, configuration, workflow, runner, server and separate adapter packages. Keep vendor imports in adapters. The CLI connects them to the engine. Use local personas, one candidate, independent falsification and mixed dependency plans first. Reject unsupported scripts until scoped approvals exist. Default personas remain read-only. Expose the supported operations through CLI, local HTTP and stdio MCP. The alternatives were implementing every backend together or releasing a specification without a working path. A smaller runnable path makes integration problems visible sooner.

Pin `@openai/codex-sdk` at 0.167.0, `@anthropic-ai/claude-agent-sdk` at 0.3.319 and `@modelcontextprotocol/sdk` at 1.32.2. Pin zod at 4.6.7 and Bun at 1.3.10. The installed vendor declarations are the binding reference for this implementation, rather than older probe transcripts. These pins do not establish backend readiness. Record contracts, permission checks and live evidence for these exact versions. Research and current evidence are in `research/implementation-state.md` and `research/preview-sdk-bindings.md`.

The first configuration schema also owns `defaults.claude_max_turns`, default 30. This limits a Claude query. Codex has no equivalent bound in this SDK binding. It must not be presented as a shared vendor turn limit.

Build a private local archive with the Titan runtime bundled and the two vendor SDKs declared as pinned dependencies. Include the guide, schemas and examples. Do not publish or advertise a public package name before ownership is verified. A generated archive alone does not satisfy the clean-install or end-to-end release gates.

The required offline test boundary must fail closed when this host cannot create it. Do not replace that boundary with JavaScript mocks to obtain a passing result. Keep unexecuted scenarios pending and do not commit or push implementation as checked while its required local gates fail.

### 45. Keep the test container separate from host execution

Use rootless Podman for the Linux default test boundary. Prepare its pinned image separately, then run tests without external networking or image pulls. Child processes and Git hooks inherit the boundary. Keep source read-only and expose only coverage output as writable. Refuse a missing boundary rather than falling back to ordinary host execution.

Titan and its vendor agents run on the same host. Agents use the shared live project tree by default, with access negotiated through the blackboard across runs. Candidate folders retain immutable evidence; explicitly selected isolated mode remains optional. Test containment does not imply containerized production agents or automatic access to every host folder. External paths and actions retain their scoped permission requirements.

Deliver reviewable increments to main after their applicable checks pass, as requested. A preview increment does not close the remaining acceptance scenarios or establish production readiness.

## 46. Repair the rejected runtime before acceptance

The first runtime was rejected by the person. Its coverage result and stubbed archive run are partial evidence, not accepted delivery.

Keep the CLI application as an executable composition root. Place command names, options, positional contracts and availability in one catalog. Generate global and command help from that catalog. Parse and validate before creating a client or runtime. Command handlers receive typed ports for server calls, output and lifecycle; they do not import vendor adapters. Separate inspection, workflow submission, run control, installation and service lifecycle handlers. Keep the server and adapter composition behind an explicit bootstrap module.

Use named values for shared backend identifiers, exit codes and protocol states, deriving schemas from the owning definitions. Keep messages with their owning feature. Reject irrelevant flags, surplus arguments, unknown schema names and incompatible switches before filesystem or network access. A watched status uses the same terminal outcome rules as a watched submission.

Enforce public exports, declared imports, vendor isolation and an acyclic package graph with executable checks and failing fixtures. A file split alone does not establish a boundary. Record remaining gaps in `research/implementation-rejection-review.md` and retain the full first-delivery gates.

## 47. Use the reference engineering rules throughout the repair

The person clarified that the reference practices apply to code, types, literals, hardcoded values, errors, enums, configuration, technical documents, hooks, checks, tests, guides, skills and knowledge records. Faster end-to-end verification is the intended deviation. This supersedes earlier discretionary exceptions in this document and the earlier code-style requirement.

Use `scratch-pad/DEV_RULES.md`, its Biome plugins and its development workflow as the comparison. Closed values belong to enums in constants. Shapes are Zod schemas in types; behavior ports are contracts there. Text belongs to messages. Configuration owns environment access, addresses, defaults and limits. Enforce asynchronous I/O, lazy loading, bounded state and parallel work, shallow functions, flat factory-based tests, complete source coverage, formatting, spelling, secret checks and package boundaries. Technical documentation and harness skills must stay current with the implemented contracts.

Every applicable rule needs a blocking job and a negative fixture. A rule name in a document is not enforcement. Reference rules specific to that product's API, console or public SDK need a recorded Titan equivalent where the capability exists; do not create empty applications to mimic its tree. The earlier documentation independence instruction is awaiting clarification and must not be silently removed.

The person further requires buffer-based file data and streams where they avoid accumulating complete files, histories or process output. This applies to tests and tooling too. Shared test framework, factories and case builders enforce at least two positive and two negative `.each` cases per test subject.

The current repair is incomplete and remains uncommitted. The reference string and type plugins are enabled and reject the current violations. Repair the violations rather than suppressing them. Commit and push only after the applicable gates pass. Record timings for complete E2E checks and improve them without dropping cases or checks.

## 48. Push the repair for review and limit current delivery to two harnesses

The person explicitly requested pushing the current repair for review despite its known failing gates. This supersedes the requirement in decisions 44, 45 and 47 to withhold this review increment until all applicable checks pass. Keep the failures recorded; do not disable hooks, lower thresholds or describe this increment as accepted, checked delivery. Subsequent increments must report their actual verification evidence.

Current implementation and end-to-end delivery work is limited to Codex and Claude Code. The fake backend remains an offline testing tool. Other adapters and optional services remain deferred specification work and must not be advertised as working or required to accept the two-harness delivery. This does not reduce the required engine, recovery, configuration, CLI, packaging, documentation or engineering-quality work for these two harnesses.

## 49. Check exported Git content without changing the person's files

Commit verification exports the index through a temporary, separate Git index. Push verification inventories Git's advertised outgoing revisions and exports each revision. Do not let an unstaged fix certify staged content, or let a later fix hide an earlier outgoing defect. A missing remote object stops with fetch instructions; unknown new-branch history receives conservative verification.

Link exported workspace dependencies to exported workspace sources. Reuse prepared external dependencies only at their pinned versions and require matching lockfiles. Routine hooks do not download dependencies, pull images or build the product. Reject tracked symbolic links and submodules until contained export behavior is implemented and tested. Preserve and clean up temporary exports on failure.

Secret scanning uses the complete tracked-file inventory, including force-added ignored files, and checks commit messages before displaying Conventional Commits errors. Hook-policy fixtures reject missing or weakened jobs and missing push input. The first hook implementation does not reuse check receipts and reports per-stage timing. Its initial enforced checks do not establish completion of the full reference-rule registry.

The latest instruction restores ordinary checked delivery after the explicitly authorized incomplete review increment. Do not use that one review authorization as a permanent exception. Continue with small commits and pushes once their applicable checks pass.

## Workspace snapshot bounds

Snapshot limits belong to the shared limits schema and the run's frozen effective configuration. Default allowances are 10,000 included entries, 1 GiB of file content and 64 path components; fixed schema ceilings are 100,000 entries, 16 GiB and 128 components. Count directories before descent, including empty ones, and count streamed file bytes before scanning and hashing. Skip reserved metadata and dependency trees. The root itself does not consume an entry. Empty directories are not part of the delivered file manifest.

Use asynchronous directory iteration instead of collecting an entire directory before checking limits. Validate manifest paths and budgets before creating copy targets, propagate the frozen settings through every engine snapshot, and validate combined ancestor manifests after each merge. Exceeding a budget blocks operationally without a quality refutation. This bounds snapshot processing; live agent disk quotas, filesystem races and platform sandbox evidence remain separate work.

## Frozen request allowance

Request count is a run setting under requests.max_per_run, with default and fixed safety ceiling 256 and minimum 1. Home configuration may lower it. Limited configuration layers keep or lower the inherited allowance. New runs freeze the result before work; later file changes affect new submissions. Every record consumes capacity, including answered records. Existing creation retries remain available when full. Admission and replay use the smaller of this allowance and the ledger safety limit. Refusing a new opening does not advance the journal.

Make the section explicit in new resolved settings, but optional without a parse-time default in stored configuration schemas. Old journal state and configuration hashes must not change during parsing. A legacy snapshot retains its original 256 allowance. This does not add history pruning or approved allowance revisions.

## Owner request operation queue

Home-owner server.max_pending_request_operations controls outstanding request mutations across runs. It defaults to 256 and accepts integers from 1 to 256, using the ledger’s central schema. The count includes active and queued mutations. Server startup validates it before admitting work and passes it to the shared engine ledger. A full queue refuses a new mutation without changing its request or journal cursor. Releasing the active operation admits an explicit retry. Project, selected-file, workflow and CLI overrides cannot change this owner setting. Restart applies a changed home allowance; individual frozen run settings do not replace that process budget. Legacy snapshots without the optional field keep their original shape and hash.

## Migration Plan

Nothing is deployed. Build in the order of decision 36, with tasks from each package and its tests together. `research/acceptance-map.tsv` maps each scenario to its owning task and delivery stage. A stage preview states its subset; it does not reduce the full change's scope.

Before the workspace exists, run the Python specification check and strict OpenSpec validation. During implementation, keep every unbuilt scenario visible as pending with its open task. Run focused checks while editing and scoped hooks at commit and push. Require the complete default local check before merge or release. Full release rejects all remaining required pending scenarios. Keep live evidence separate from default test results.

Package the CLI, guide, schema, examples and helpers together. Test installation outside the repository before publishing. Preserve earlier run files and shared state on upgrade. Before the first stored-format change, add a versioned migration and a rollback test. Until then, refuse unknown stored formats instead of guessing. A rollback must not replay an external action or reuse an approval for a changed operation.

## Open Questions

These are evidence gates, not permissions to claim support. Historical observations above do not answer them for a future package version.

| Question                                                                         | Owner and completion evidence                                                                                   | Blocks                                                          |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Which harness variables, role settings, tool and skill bindings work?            | Tasks 1.1 through 1.7, then adapter and guide live tests. Save pinned primary sources and transcripts.          | Each affected adapter and automatic detection.                  |
| Can each adapter deny token reads, intercept external actions and cancel?        | Tasks 1.6, 1.11, 22.19 and 22.20. Record denied-access tests or the trusted-agent limitation.                   | Claims of human-only enforcement and external-action readiness. |
| Does the Antigravity SDK meet the port?                                          | Tasks 1.3 and 1.4. No silent command-line fallback; a different binding needs a recorded decision and contract. | Antigravity readiness.                                          |
| Which platforms support vector search and the test boundary?                     | Tasks 1.9 and 22.18. Linux is the first target, not a verified claim.                                           | Platform-specific readiness. Word search remains available.     |
| What happens after RunPod cancel, timeout or lost acknowledgement?               | Tasks 1.10, 22.11 and 22.12, with paid live tests only when authorized.                                         | RunPod release readiness and stop claims.                       |
| Does Lean isolation work on an ordinary non-root Linux host?                     | Task 24.5. If it fails, record a new sandbox decision and rerun the cheat cases.                                | Lean readiness.                                                 |
| Do learning and improvement help real tasks?                                     | Tasks 25.15 and 25.16 with a frozen comparison protocol.                                                        | Promotion and effectiveness claims.                             |
| Can each pinned adapter checkpoint events, files and session state consistently? | Tasks 28.2 through 28.4, with interruption and old-writer tests for its actual SDK version.                     | Checkpoint and native-restoration readiness for that adapter.   |
| Can the packed runtime run outside the workspace on the named host?              | Tasks 31.1 and 31.2, including Bun compatibility, optional runtimes and native dependency loading.              | Installed preview and platform claims.                          |
| Is the proposed package scope available and controlled by the release owner?     | Task 31.1 records registry ownership before advertising package installation.                                   | Public package names and distribution instructions.             |
| Can historical quoted evidence be reproduced?                                    | Task 22.16 restores source ids and hashes without altering quotations.                                          | Reliance on missing historical claims.                          |

Default persona permissions are read-only. Editing is limited to candidate folders and listed capabilities; actions outside them need the scoped approval path. Paid-run waiting time counts against the deadline. The main agent starts a checked workflow without an extra blanket confirmation, subject to individual approvals. Dashboard mutation, extra proof kinds and A2A task routes remain outside this change.

## Structured request turns

Codex and Claude personas may opt into request_turns: true. Their native output is an object with result and requests. Normal completion has an empty requests array. Waiting has a null result and strict request descriptions containing kind, scope and expires_at. Titan assigns ids and execution origins. Personas without this optional field retain their current output schema and stored hashes.

The runner commits the complete batch and the phase's pending identities in one request_turn_opened event. A waiting worker keeps its working files without publishing a candidate. A waiting checker keeps the completed worker checkpoint. Both release active capacity. Independent work continues; dependent work remains pending. With no runnable work, the run becomes waiting and retains exit code three. Resume with an unanswered request starts no turn. Once every request is answered, the runner sends only that phase's decisions to its retained session. Intentional continuation does not spend recovery allowance or a quality attempt. An actual interruption remains an operational failure.

The pending state records its asking execution, so later execution ids cannot change answer ownership. The batch and its pending membership must agree during replay. Batches share the frozen run request allowance and retain existing record, input and journal byte limits; the complete batch is limited to the existing one-MiB structured-data allowance. No partially admitted batch is published. Lost acknowledgement is recovered from the atomic event. A synchronous journal refusal restores live state; asynchronous writes need reload and reconciliation.

Run format three fences this pending phase state from older runtimes. Existing formats remain readable without inserted defaults. Later ordinary request decisions must not lower a format-three header. This structured path does not by itself register persona MCP tools, implement automatic approvals, grant new tools or perform approved external actions. Those accepted requirements and tasks remain open. Native MCP needs its own checked turn-ending boundary; stopping an SDK process is not sufficient evidence.

### Pending request projection publication

Each run has a requests.json projection with schema_version, run_id, through and its unanswered requests. The through cursor identifies the journal prefix used to publish that file; unrelated later execution events do not require another request-file write. Answers remove their record and escalation preserves its pending audit. Request mutations publish the complete file before acknowledgement. Encoding uses independent pages of at most 64 KiB, with a complete allowance derived from 256 records of at most 512 KiB plus metadata. The file is for inspection and never authorizes an operation.

Loading a run rebuilds requests.json from validated journal history, ignoring its old contents. A missing or malformed file cannot change a decision. A failed publication after append may already have recorded the mutation: the writer refuses further committed reads and writes until explicit reload. Repair the filesystem problem and reload before retrying; inspect the recovered request and observed version. Failure to rebuild prevents run admission. The board projection callback runs inside the existing append queue and receives the detached event state. Request replay consumes that explicit journal prefix, without waiting on the same queue through snapshot. Run load rebuilds before the engine retains the run. Standalone board stores preserve their optional callback contract. The projection format does not upgrade the run header or reinterpret older records. Native persona tool registration and operation execution remain separate work.

## Owner run and submission queue admission

The owner configures server.max_pending_run_operations and server.max_pending_submissions independently. Both default to the central 4096 ceiling and admit integers from one through 4096. Each count includes active and queued entries. A submission retains its client/submission identity entry while taking one run entry. Using separate queues avoids reserving two entries from one queue, which would make a limit of one unusable. No operation acquires the queues in the opposite order. Request mutations also pass the separate request-ledger budget.

Saturation refuses new admission with capacity, without acknowledging a mutation. Callers release held work and retry explicitly. Submission retries retain the stored identity and request hash. These are separate in-memory budgets, not a durable scheduler or a combined HTTP request count. Startup applies home-owner settings; lower layers cannot change them. Stored fields remain optional without parse defaults so legacy configuration shapes and hashes remain unchanged.

Submission preparation and retention belong to the server-owned RunSubmissions component. The HTTP handler delegates validated transport bodies and maps submission conflicts to HTTP 409. Named methods keep fingerprinting, identity admission, run admission and create-or-load logic out of the route body. Existing fingerprint semantics remain stable, including empty versus absent workflow_path values.

## Optional caller session labels

An explicitly supplied harness_session_id belongs to the submitting caller. It remains an opaque bounded string, separate from native phase session ids and authentication. CLI, HTTP and MCP carry the field without guessing vendor environment variables. The submission fingerprint includes it only when present, preserving legacy fingerprints. Run format four retains it in the header and available summaries. Request-turn publication upgrades older formats only; it never downgrades format four. Durable receipts and indexed session filtering remain separate work.

RunStore retains the first journal record's client, submission and optional caller session as a small origin value. For caller-labelled history, initialized commits and every replayed event must match that value. A legacy journal cannot introduce a caller session later. Removal through a format downgrade also fails. Live refusal happens before sequence advancement or append; a valid commit remains possible. Replay validates origin before repairing projections or retaining an engine run. Unlabelled legacy identity behavior remains unchanged. This does not add cross-process writer fencing or permit appending to an existing journal through an uninitialized store.

## Resident run configuration

Home-owner server.max_resident_runs defaults to 1024 and accepts integers from one through 1024. Lower layers cannot override this process budget. It bounds retained run, journal-store, active-work and controller collections. An inactive run can be evicted and later reloaded; an active run keeps its slot. Full active residency refuses a peer without executing it. Creation may already have recorded that peer before retention fails. After release, retry the same submission and explicitly resume its blocked run. This does not reserve capacity before filesystem work or limit the durable catalog. Legacy stored configurations without the optional field retain their shape and hash. Engine accepts one named settings object validated by the central engine schema. Eviction tests use actual limits of one, two and three instead of creating a thousand durable runs for each boundary. CI timeouts remain unchanged.

## Duplicate active resume

Engine.resume checks terminal refusal first, then returns any existing active work before resetting recoverable node states. This ordering protects the current phase origin without changing terminal behavior. Concurrent controls share the same work and append no extra event. Actual HTTP controls repeat three times while a strict Codex or Claude executable fixture remains active. Request admission must still accept that exact origin before the existing cancellation or daemon-death recovery proceeds. Direct engine cases also hold checker turns and completed parallel peers.

## Codex user configuration admission

The pinned SDK receives an additive ignoreUserConfig launch option through a small checked dependency patch. Default CodexBackend construction always supplies true. The SDK adds the native --ignore-user-config flag for start and resume without changing CODEX_HOME. Explicit Titan invocation settings still apply. A native-only offline probe observes home and trusted-project MCP commands when the flag is absent and no startup markers when present. Both cases authenticate to a loopback refusal using a synthetic auth.json. No real credential or model service is used.

The preview embeds the patched SDK in its bundles. It declares the native CLI version found in that prepared SDK's own package manifest, validated as an exact version through bounded asynchronous reads. It does not rely on a checkout-only patch being applied to a freshly installed external SDK. The native CLI remains an installed pinned dependency so the bundled SDK's public executable discovery can resolve its platform package. Default tests and installed workflow tests keep strict vendor executables stubbed. Managed settings, operating-system credential stores and full persona tool confinement remain separate acceptance work.

## Committed usage inspection

The engine streams validated journal snapshots through a cursor bounded by the declared worker and checker phases. Each cursor retains the logical attempt, physical execution count, usage-record count and prefix hash. New attempts retain prior totals; repeated snapshots add only deltas. Unknown measures stay incomplete, and physical starts without a final report make every measure incomplete. The strict versioned result binds run id and committed cursor. CLI usage, authenticated HTTP and MCP share this engine result. Reads do not start work. The initial implementation scans history on each read; indexing and normalization of interrupted native-stream usage remain open.

## 53. Bounded caller-session and project navigation

Run listing now adds caller-session and project selectors to the existing client filter. The initial implementation filters committed summaries from a bounded catalog page, rather than loading all runs or introducing an incomplete index migration. The page count therefore limits inspected rows. Version two explicitly permits an empty matching page with a descending continuation cursor. Existing requests retain version one. Client validation binds both protocols and every supplied selector. A missing or corrupt run cannot supply trustworthy session or project metadata; unfiltered inspection retains its diagnostic. Indexed lookup, global snapshots and dashboard filtering remain pending under task 26.6.

## 54. Native usage counter scope

Claude usage records are cumulative within a native session. Titan retains raw records and adds only increases in each measure within a phase and quality attempt. Codex records remain additive per turn. Backend selection uses the frozen persona, configuration default and run fallback in that order. New quality attempts retain their independent totals. An observed counter drop keeps the highest known subtotal and makes only that measure incomplete; a later report cannot restore completeness after a missing value. Interrupted starts remain unreported even when a later cumulative result includes their usage. Native USD cost is an SDK estimate, not a billing receipt. Hidden counter resets without an observed drop cannot be reconstructed from these records. The bounded history cursor retains one high-water value per measure and declared phase. This cursor is derived during inspection and is not a stored run-format change.

## 55. Structured Claude retry admission

Claude system/api_retry events now enter Titan recovery when their fields are valid and their cause matches their HTTP status: rate_limit with 429, or overloaded/server_error with a server-error status. Native delay is retained alongside the configured backoff; values above 2,147,483,647 milliseconds are refused before scheduling. The frozen recovery.max_retries allowance limits physical continuations. The same phase, native session, files and quality attempt remain in use; completed peers stay complete. Unknown causes, billing errors, contradictory statuses and malformed delays block without automatic retry or a quality refutation. Ordinary rate_limit_event notices do not replace a successful final result. Native retries without final usage records remain explicit unreported starts. Codex errors still lack a verified structured classification and block for diagnosis and explicit resume. Raw retry events commit before the adapter yields an operational failure. The normal SDK iterator cleanup and host path remain in use. Offline cases require observed executable exit; this does not establish complete descendant-process containment on every platform. Backoff interruption and restart fairness remain separate acceptance work.

## 56. Schedule durable backoff without retaining a node slot

A classified transient failure closes its owned session before recording its cause and retry date. It then returns scheduling control to the engine. The node remains pending with its existing phase and attempt; it does not occupy a per-run active-node slot. Ready independent nodes can run even when max_parallel is one. The engine waits for the earliest retained retry date only when it has no executing work. Its abortable wait also respects pause, cancellation and the hard deadline. A retry consumes allowance only when another physical execution starts. Resume and reload do not replace dates or counters.

Committed status follows physical work: a running node keeps the run running; stopped retry waits without running work project recovering. Started, deferred, completed and control events retain this projection. Existing run formats already support pending nodes, retry dates and recovering status. This increment does not add a dashboard or claim vendor transcript restoration.

## 57. Strict byte counting without recursive generator delegation

The shared synchronous JSON admission check counts container tokens directly. Short strings use bounded native escaping; longer strings retain the segmented encoder. The counter rejects the same unsupported data, accessors, sparse arrays, custom prototypes, cycles and excessive nesting as byte encoding. Shared references remain valid. It counts escaped object keys, delimiters and UTF-8 bytes before admitting a journal record. It does not retain an encoded document, call custom serialization hooks or change protocol callback ordering.

This repairs measured CPU cost in forty-node execution without removing any journal commit, synchronization, replay validation or file verification. The existing twelve-second graph budget remains unchanged. Exact-budget positive and negative cases and deliberate counter mutations accompany normal complete verification. Local timing alone does not establish CI or production readiness.

## 58. Complete TypeScript source scope

The root compiler includes supported TypeScript files under apps, packages, testing and tooling scripts. Ordinary workspace configuration includes src/**/*; the testing root includes **/*. Directory patterns let the pinned compiler discover TS, TSX, MTS and CTS without enabling JavaScript checking or adding a JSX runtime. Strict configuration admission binds the pattern to the workspace layout and rejects arbitrary includes. Product coverage and package-boundary inventories name all four suffixes explicitly. The exact unused-code policy does the same and retains supported test discovery names.

Temporary real-file cases invoke the pinned compiler at root and package scope with valid and invalid assignments for each suffix. Separate cases invoke the actual coverage command and unused-code scanner. Boundary inventory cases retain exact read-budget behavior. These checks close reproduced source omissions; they do not establish complete reference parity, browser support or JSX rendering behavior.

## 59. Manifest direction and test ownership

Dependency policy inspects root plus every declared workspace, in runtime and development scopes. The accepted foundation split and runtime composition remain the architecture: core uses foundations, adapters use core and their registered vendors, and runtime constructs adapters behind transport handlers. Central name-to-directory ownership prevents a library from impersonating runtime or test support. Test dependencies flow downward from aggregation through factories to framework. Product packages carry no test framework dependencies.

Native adapter contracts use public backend APIs in the central integration tier, with tables, factories and executable vendor stubs under testing. The default offline command selects only unit, integration and e2e. The existing bounded flat-test job also refuses registrations outside those roots and conventionally named support directories under products or tooling. This does not prove transitive unit purity or arbitrary non-source fixture ownership. See the package direction evidence for detected mutations and remaining acceptance.

## 60. Keep backend waiters outside active run slots

Home-only server.backend_limits adds optional positive safe integer or null limits for Codex, Claude and fake. Missing and null values add no ceiling beyond the shared agent limit. Preserve absent legacy fields and their configuration hashes. Apply these owner settings when constructing the engine; edits take effect after daemon restart. They are not workflow overrides or adapter-advertised capabilities.

The capacity owner admits under global, per-run and backend ceilings together. It scans each queued run for an eligible call and rotates runs after admission. A blocked backend cannot reserve an active run slot. The graph scheduler retains ready work in the bounded pending-agent queue instead of treating every waiting step as an active agent. Worker input preparation, checker preparation and worker checkpoint copying run within admission, so this change does not start unbounded workspace copies. Counters advance only after preparation and complete turn validation. Existing recovery, deadlines, targeted cancellation and request-turn rules remain in force. Durable queue events, live budget updates and adapter-declared maxConcurrentSessions remain separate acceptance work.

## 61. Bind Codex role configuration to the session

The pinned Codex SDK accepts structured client config and serializes developer_instructions as one TOML string override. The official SDK and configuration references document this path. A default client is constructed for each session with the role captured from its invocation, alongside the existing isolation settings. Both starts and resumes use that client's configuration. Retain the role prefix in the prompt for compatibility with injected clients; a caller-supplied client owns its native configuration. Never mutate a shared default client's config to select the current persona.

Strict executable fixtures compare the complete developer-instruction argument to the role supplied with the prompt. Separate roles, quotes, newlines, native resume and peer cancellation exercise the same public adapter. This proves SDK argument mapping, not live model compliance or an exact Codex tool allowlist. Skill and MCP server bindings and the live self-development exercise remain open.

### Recoverable host-owned knowledge publication

A kept set needs one stable publication id and its ordered input digest. The storage owner checks every observed entry version and the complete resulting entry, content and index budgets before recording intent. A duplicate entry id is invalid. Any conflict leaves the set unpublished. The durable journal carries all before text and all replacements. Recovery validates the complete journal and current files before replay, repairs the index before readiness and records a bounded receipt before removing intent. Identical retry returns that receipt without changing the current global revision. Reusing the publication id for different input fails. A failure after intent fences reads and writes until reopen.

Atomicity applies to reads through the owner queue and to recovery before readiness. File replacements are individual atomic renames; arbitrary filesystem readers cannot obtain a multi-file snapshot. External editors must stop the owner first. Optional owner-only limits bound publication count, journal bytes and retained receipts. They do not add fields to older frozen settings when omitted. Receipt retention is finite and currently refuses new ids when full; it never silently forgets an acknowledgement.

This storage contract does not establish private attempt ownership or kept-candidate integration. The runner must later bind a private set to run, step, part, candidate and attempt, complete its checks, then use a stable id for publication before committing step success. Native Codex and Claude tools must use scoped capabilities. Final-entry CLI and main-agent MCP operations are not worker credentials. Tasks 4.1, 25.12 and 26.8 remain open until those complete scenarios pass.

## Private knowledge set storage

The knowledge owner retains bounded private sets outside the final index. Their identity binds run, step, nullable part, candidate and logical attempt. A caller must supply the observed private revision to replace, publish or discard a set. Replacing content increments that revision while preserving the publication id. A normal final admission conflict leaves the proposal open. Immediately before final durable intent, the owner records the private prepared state. Once prepared, a set cannot change or be discarded; recovery retries its stable publication id. Final receipts allow a lost acknowledgement to complete without duplicate versions. Published and discarded states retain durable records and cannot return to open. An empty proposal needs no final publication receipt.

Private operations share a bounded serial queue on the home owner. Shutdown refuses new admissions and drains accepted work. If final publication fences the owner, queued private operations recheck owner health before execution. Optional owner attempts settings bound retained sets, mutation count and staged document bytes. Tombstones consume capacity; automatic retention remains open. These identifiers are not credentials, and this host API does not claim operating-system privacy from arbitrary same-user filesystem readers. The runner and native tool capabilities must enforce ownership before exposing private data. Broader private-publication and native-binding tasks remain open.

## Runner publication boundary

The server injects its private knowledge owner through a typed runner port. The currently supported one-candidate execution uses worker as candidate identity and retains run, step, nullable part and logical attempt. Multi-candidate selection remains unsupported by the current workflow validator and needs its own candidate identities before that restriction can be lifted. Operational continuations retain the logical attempt and private set.

After all falsifiers survive, step execution rechecks the saved candidate hash, publishes the private set and then commits step success. A base-version conflict records the publication id, entry ids and observed versions, and makes the step and run fail without a quality refutation or automatic overwrite. Publication interruption blocks recovery. Reopen and resume retain completed phases, retry the same publication id and then complete step success. A refuted attempt discards its private proposal before either advancing its attempt or ending failed. Agent capabilities and private CRUD tools remain separate unfinished work.

The host-owned private entry view requires two observed values for edits: the proposed entry version and the attempt's private revision. Repeated pending edits keep one final mutation against its original base version. Private add followed by delete cancels that mutation. The view cannot publish or discard, and persona deletion still requires approval. Native tools must bind this host view to an authorized active attempt; scope ids alone do not grant access. The host view also supports private word search; exposing it to native agents remains part of native integration acceptance.

## Scoped private word search

A host-owned view reads one private revision together with one committed revision. Keep the private queue held while waiting for the final queue; publication uses the same lock order. Private text enters a temporary memory-only FTS5 database and never the public database or index. Await its lazy query before disposing that database. Use the same word parsing, highlighting and kind filter as final search. Meaning-only searches remain unavailable; both mode reports its word fallback.

For the owning scope, pending additions and updates replace final versions, and pending deletions remove final matches before the SQL count limit. Put matching private entries first, then final entries in their existing rank and id order. Return pending or final visibility, the private revision and a readable path for each result. Private results point to the bounded proposal document. Count and byte ceilings apply after scoped metadata is added. Other scopes receive only committed results. Closed proposals add no private matches. No search call grants write, publication or human decision authority. Native credentials and startup checks remain unfinished.

## Native tool authority under construction

The local owner needs a dedicated capability surface for native agents. It must not pass its main-agent MCP facade to a worker or checker. A host registration binds a copied run, role, step, nullable part, candidate, logical attempt and execution. Only the host supplies that registration and its current-execution check. An opaque random credential authorizes requests; supplied ids do not. The registry and pending request queue are bounded by owner settings. Revocation refuses new calls and waits for admitted work before releasing its slot.

The owner broker uses a separate authenticated MCP HTTP route internally. The bundled tool-server command still needs its specified stdio bridge for vendor agents. That bridge, runner injection, credential delivery, startup readiness and board audit are not delivered by the broker alone. Worker tools use the bound private view; checker tools read only committed entries and do not register write or human decision tools. Credentials must remain ephemeral and absent from durable run records and diagnostics. The current draft supports only the worker and checker roles already used by the first runtime; additional roles remain required.

## Bundled native tool bridge under verification

The bundled tool-server command loads strict loopback connection settings through the central configuration package. It validates the host's ready scope and both reported and listed role inventories before serving MCP over stdio. The credential stays in the environment. Scoped ids cannot replace it. Input framing uses the shared byte ceiling; explicit EOF cleanup closes the transport and owner client. Source-process acceptance uses a real local owner and the actual command, without vendor calls. Automatic runner registration, both SDK configurations, pre-task startup enforcement, board audit and installed acceptance remain required. This draft does not close the broader native delivery tasks.

## Volatile native bindings in the local adapters

AgentSpec remains free of execution credentials. A strict optional native binding travels through backend validation, start, resume and the isolated host envelope. It binds the run and execution, loopback connection and host-selected absolute executable. Argument count and sizes are bounded. Configuration composes inherited vendor environment and native connection variables; adapters receive a callable factory rather than importing configuration. Home-only native owner settings bound registrations, pending operations and startup time.

Codex configuration forwards variable names through env_vars and requires live connection readiness. Credential values stay in the child environment. Bound execution refuses injected clients because Titan cannot prove their required server configuration. Claude uses an asynchronous user-message source held behind initialization and connected-inventory checks, under deadline and cancellation. Only the exact role tools receive native permission. Pending, failed, missing, duplicate and incomplete inventories cannot release a task. Ordinary unbound calls retain their previous behavior.

Options, native setup and event processing have separate modules in each adapter. The host separates protocol dispatch from failure capture and event acknowledgement. Offline SDK fixtures start the actual bundled stdio process and exercise search and get before and after native resume, directly and in isolated hosts. These adapter contracts do not yet mint a runner credential or retain its guard through checkpoint capture. Board audit, automatic owner composition, installed use and live compatibility remain acceptance work. Tasks 6.10 and 25.22 stay open.

### Native execution lifecycle in the runner

EngineServices may supply a native execution owner. The runner opens its lease after the durable physical start, binds it to the current logical attempt and phase, and forwards it separately on backend start or resume. An execution guard checks raw events, the complete answer and lifecycle failures before those values enter durable state. The lease stays active through all checkpoint reads and writes. Closure precedes phase completion and knowledge publication. Late event callbacks observe a closed execution and cannot append records. Operational rejection preserves the logical attempt and is not a refutation. An engine without the optional owner retains its unbound behavior. Automatic server composition, metadata-only audit and installed native workflows remain separate acceptance work.

### Automatic local native composition

Runtime supplies a strict bundled launch when starting the local service. Source runs resolve the public @titan/server/native-tool-bridge entry. Installed runs resolve native-tool-host.js beside the runtime bundle. The dedicated helper serves the same stdio bridge as the tool-server command without loading the command registry. ServerOptions.nativeTools keeps that host port explicit for embedded callers. The server owns NativeToolAuthority and NativeExecutions, using home-owner native_tools limits. It dispatches the native route to execution authentication before ordinary actor authentication. Scanners compose inherited and execution secrets through config. Scope and run directory validate before capacity is consumed. Active execution pauses while the listener remains available, followed by listener stop, authority drain and knowledge closure. The installed probe reuses the source native workflow case table and bundles its test-only native helper so no workspace dependency is required. Metadata-only tool audit and live vendor evidence remain separate acceptance work.

### Direct local native transport

Automatic native composition adds an owner-selected HTTP mode while retaining the stdio bridge. Repeated process measurements show that spawning a full MCP helper for every physical turn can exceed the existing mixed workflow deadline under the fixed offline budget. Both vendors document native HTTP support with environment-based credentials. This is a transport choice, not permission to skip scope or inventory validation.

Runtime injects a typed readiness port into each adapter. A focused server client module owns the existing authenticated owner connection, exact scope and inventory checks, bounded response fetch and cancellation. Adapters depend on that port rather than importing server implementation. Runtime loads the implementation only for HTTP bindings. Each HTTP send waits for it before vendor work; an absent port refuses startup. Codex configuration names the bearer environment variable. Claude configuration contains an environment reference in its authorization header. Neither includes the credential value in arguments. Explicit stdio bindings retain their existing test cases and launch contract.

The central transport field remains optional in frozen records. Fresh configuration supplies the selected default explicitly so adding the setting does not change a legacy configuration hash. Source mixed parallel delivery and complete installed acceptance must pass before automatic HTTP composition is treated as delivered. Offline evidence cannot establish live vendor compatibility.

### Runner-owned setup delivery proof

A runner execution reservation records prepared delivery before minting its volatile tool lease. Before any backend start or resume call, a second durable transition records uncertain delivery and increments a separate dispatch counter. The board schema checks these fields together. Usage totals count dispatch attempts, while reservation and retry counters retain every admitted setup and its spent allowance. A legacy record retains its conservative former totals.

Prepared delivery is the only missing-session exception. An owner or bound-validation refusal closes its lease and can explicitly resume on the same logical attempt, with existing files and completed phases retained. Uncertain delivery and missing legacy proof cannot authorize a fresh start without reconciliation. Committing uncertainty before backend startup deliberately leaves a conservative gap if the process dies before the actual call. Native-host dispatch acknowledgement and broader session reconciliation remain separate acceptance work; this marker does not prove that an arbitrary child failure made no vendor call.

### Native tool metadata admission

The native authority observes admitted MCP call envelopes and bounded JSON responses. Its audit writer commits a strict metadata schema before acknowledgement. Names outside the declared inventory become a fixed safe marker. The runner resolves the persona from the matching frozen step and phase; the caller cannot supply it. Audit data contains no query, argument, result body, credential or exception text. A failed audit poisons the volatile lease. Future calls, the execution value guard and lease completion refuse success, but cleanup still drains admitted work and releases capacity. Global authority shutdown drains every binding. This prevents a private proposal or checked artifact from being published after an audit failure. Existing raw vendor event projection remains a separate review concern; this increment alone must not close the full tool-server task.

Native event admission scans the original event for execution credentials, then projects native SDK tool traffic before the board commit. Codex projections retain call id, declared tool name, status and activity. Claude native tool-use messages retain call id and declared name. Claude tool-result messages can lack server identity after recovery, so all such result messages are projected while native tools are enabled; unassociated results use the unknown marker. Partial Claude messages are also projected. No correlation store or invented identity is introduced. Strict metadata validation bounds identities, names and block counts; malformed metadata blocks operationally. The authoritative native audit keeps the trusted persona, outcome and entry ids separately. Ordinary messages and executions without native tools keep their existing behavior.

## Scripted fake answers in the local runtime

The offline scripted adapter uses a strict version-1 document with an `answers` array. Each entry carries a persona, exact task, JSON answer and positive attempt and execution numbers. The two numbers default to 1. The schema rejects duplicate coordinates and unknown fields. Admission checks the complete encoded JSON against one MiB and limits the array to 1,024 entries. The pure JSON counter belongs to core so adapters retain their foundation-only dependencies. Streams keeps its existing counter export.

Run configuration stores the parsed script in `backends.fake.script`. Home, project, workflow and CLI layers use the same schema. The setting is optional, preserving hashes for existing configurations. It is separate from owner-only executable launch settings under `server.backends`. The CLI reads `--fake-script` once and submits those exact parsed overrides after local validation. Saved run settings and their hash bind the answers. Editing the original answer file leaves saved runs intact.

The engine passes frozen settings into backend construction and durable persona, quality-attempt and physical-execution coordinates into each turn. The scripted adapter validates the matching reply before the execution counter advances. Missing replies block that phase with the task named in the error. Completed peers and quality attempts retain their existing state. Each invocation returns a detached answer, and constructing an adapter detaches the caller's script. Matching uses saved coordinates across native resume and concurrent phases.

Workflow commands accept `--harness codex`, `--harness claude` and `--harness fake` as backend selectors. They reject a simultaneous `--backend` and conflicting general overrides. Skill installation retains its existing harness selector. The legacy generated-answer preview remains available while scripted-fake acceptance is delivered. Tasks 6.1, 8.4 and 20.2 retain their remaining acceptance requirements, including the exact example commands and the complete default fake contract.

## Bounded spelling batches

The maintained inventory reached the original 1024-file admission ceiling while exact workflow examples remained undelivered. Spelling now streams the canonical scope into sequential invocations bounded by the unchanged 1024-file ceiling and a new, smaller 16 MiB source-byte ceiling. Each source retains its 1 MiB admission limit. A first discovery pass admits all sources before any checker starts. A second bounded pass produces explicit file arguments for the pinned local CSpell command. Fixed canonical patterns identify earlier matches without an inventory-wide set. The scope, dictionary, isolated environment and first-failure behavior remain checked. Strict test budgets can reduce limits. Complete-scope batch fixtures and real misspelling cases verify every command boundary.

## Default run observation

Run now defaults to watching the accepted daemon work until it reaches a terminal outcome or needs intervention. Explicit detach selects immediate accepted submission. These modes share the existing run identity, polling and exit mapping. Parsing refuses conflicting watch, detach and dry-run flags before workflow loading or server contact. Dry run produces a local checked plan. Status and recovery commands accept an explicit watch option. Source and installed scripted process fixtures submit sequential and parallel plans, inspect the selected run id through status and events, verify blocked worker and checker exits and preserve logical attempts. Automatic daemon startup, complete output envelopes, observer interruption and the remaining lifecycle contracts stay open under their existing tasks.

### Checked public workflows and bounded batch validation

The four specified examples ship with versioned scripted answers under tests. Registrations, factories and case tables stay under testing. Parallel business-plan branches write distinct files. Scripted runs prove orchestration and records. Native SDK file-write contracts remain separate evidence.

The check command accepts up to 256 positional paths so shell-expanded examples work. Each file is loaded, configured and validated sequentially. Human output emits ok per successful file. Multi-file JSON returns a versioned ordered workflows array bounded to 1 MiB. Single-file JSON retains its existing shape. Invalid files retain their typed error and add the offending path. No check starts a server or run.

### Automatic local connection after validation

CLI client factories accept an optional asynchronous connector. Existing API callers retain their explicit connection behavior. CLI run, inspection, recovery, request and knowledge calls use a shared bounded daemon probe and launch path. Invalid payloads are checked before this path. CLI MCP starts its daemon before attaching stdio transport.

The launcher uses the source entry under Bun or the installed titan.js bundle. It detaches the process group and ignores all three standard streams. The home's process-owned SQLite lease fences concurrent launch attempts. A client waits for an authenticated schema-checked health response even when its competing child exits before the winning owner is ready. It never retries a submitted mutation. Failed startup kills and reaps only the child launched by that invocation.

The owner may reduce server.startup_timeout_ms from its 5000 ms ceiling in config.yaml. Shared constants bound probes to 250 ms and polling to 25 ms within the remaining deadline. Health data is read through the existing bounded stream utility. Live observer events and interruption remain separate acceptance work for task 14.4.

### Durable CLI submission receipts

The CLI owns submissions.db in its selected home. A short SQLite immediate transaction saves version, caller id, submission id and an input digest before server-client creation. SQL uses the asynchronous Bun interface and full synchronization. A receipt binds source bytes as well as the checked plan and settings. Generated caller ids belong to their receipt. Retrying a known submission without --client-id reuses its unique caller. Ambiguous ids require the explicit caller. Independent callers may use the same submission id. Changed intent fails before network work. Capacity never evicts old identities, and identical retries remain usable when full. The optional owner-only client.max_submission_receipts setting preserves older frozen configuration shapes. Transport uncertainty exposes both ids and the ledger path. Observation failures after an accepted response retain the observation error contract.

The transaction and adapter behavior follows the primary [Bun SQL documentation](https://bun.sh/docs/runtime/sql). Runtime verification uses the pinned repository version.

### Nonblocking MCP submission acknowledgement

The main-agent run tool uses the shared typed run client. Its acknowledgement assigns a run id after durable server admission and never waits for workers or checkers to finish. The acceptance fixture keeps sequential or parallel workers suspended until after the tool returns within the existing one-second contract. It then releases work and observes the same run through completion. Invalid workflow inputs start no agent. Malformed active or settled acknowledgements become MCP errors. These integration cases use an explicit FakeBackend handler. Vendor acceptance remains separately scoped.

### CLI output and event observation

Ordinary JSON uses schema version one with operation, identifiers, state, data, error, events, after, next_cursor, has_more and truncated. Data retains the operation-specific payload. Missing identifiers and state are explicit null values. Structured errors carry code, message, paths, retryable and recovery. A blocked run carries a resume action and watch exits three. A successful status query still exits zero. Lost submission responses retain the saved caller, submission and receipt path in error.recovery. Observation failures retain an already known run id and a status action, preserving transport exit four and unknown state. Transport uncertainty without a retained safe recovery identity grants no blind retry.

Run responses include their first bounded committed event page. Finite event queries wrap the same typed page and expose its next cursor and truncation. Events --follow drains bounded pages before polling. Human following emits compact event lines. With --format jsonl, every line has a version, exact run id and event cursor. It rejects --json before network work. The observer process can stop independently of the daemon. MCP and native protocols retain their framing, and serve readiness retains its existing object. The default CLI renderer owns serialization. Injected output ports receive semantic values and typed operation/page context. Ordinary result serialization checks its central response byte bound before allocating the final text.

### Saved attempt input integrity

Before continuing an existing attempt, reconstruct its expected input through the existing verified base and dependency assembly owner. Compare the captured input tree with that reconstruction before any worker or checker execution. Both continuation and publication comparisons share the engine capacity owner, the frozen per-run parallel limit and finite active and pending budgets. They add no agent execution or usage. Repeat the comparison before deriving and publishing delivered file changes. Missing or inconsistent input blocks operationally on the same quality attempt. Preserve completed phases and native session ids. Existing records use this reconstruction without acquiring a new trusted hash from mutable files. This increment covers immutable attempt input. Consistent mutable workspace and vendor conversation manifests remain part of task 28.2.

### Completed candidate commitment

After durable worker snapshot copying and atomic sidecar publication, retain the candidate tree digest in the phase before committing PhaseCompleted. The enclosing board record supplies run, step, logical attempt, execution, session, workflow and effective configuration binding. Candidate readers compare both the sidecar and this saved digest. Dependency assembly applies the same binding before reusing a passed ancestor. Ordinary and executable files share the existing tree identity rules and finite workspace limits. Legacy completed phases without this optional field retain their prior sidecar contract. Do not adopt a commitment retroactively from mutable files. This field covers completed worker candidates. Native transcript positions, pending tool boundaries, full checkpoint manifests and exclusively restored mutable folders remain in task 28.2.

### Shared live filesystem decision

The user confirmed that the swarm shares the same filesystem and project tree as other actors. Default live execution must not be replaced with isolated project copies. Exclusive recovery ownership means negotiated access to affected file scopes in that tree, after earlier writers stop or relinquish them. The blackboard records intent, contention, acquisition and release across server-owned runs. Contention yields automatically, spends no vendor call or quality refutation, and does not prevent independent scopes from progressing. Snapshot evidence remains immutable even though execution uses the shared tree.

Preserve external edits during refused-attempt restoration. Bind reconciliation decisions to current identities and require another decision after a newer edit. File claims are cooperative; they do not fence arbitrary external programs. Protected paths, interrupted-owner reconciliation and publication after changed shared contents retain explicit acceptance work under tasks 28.2, 33.12 and 33.19. The repair change owns cross-run negotiation and journal recovery regression cases.
