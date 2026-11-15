# Research: other multi-agent frameworks and papers, and what `titan` takes from them

**Reader:** a developer new to `titan`. **Purpose:** know which ideas from other open-source multi-agent frameworks and recent papers `titan` takes, which it leaves out, and why. Each pick has a source quote or a test that tried to prove it wrong.

On 2026-11-05 the user asked for research on competing open-source swarm frameworks and how they run and control their agents. They asked to use and check the open-source ones and to read the papers, so that `titan` meets the current industry standard. They asked for the result in OpenSpec and in plain language.

All tests ran on 2026-11-05 on Linux x86-64 with Bun 1.3.10. The probe is in `probes/swarm/`, with its versions in `versions.txt`. No test called a real model: each one used a fake model or no model, behind the guard file of spec test-strategy. Every quote below is copied from the fetched page. The page text is in `swarm-sources/<id>.txt`, and the links are in `swarm-sources/urls.tsv`. All 32 pages returned HTTP 200. To check the quotes, run this from the `research/` folder:

```bash
python3 -I check-quotes.py swarm.md swarm-sources probes
```

## Words used here

- A _multi-agent framework_ is a library that runs several AI agents on one task and decides who works when.
- A _handoff_ is when one agent gives the rest of a conversation to another agent. The first agent stops.
- An _agent as a tool_ is when one agent asks another agent a question, gets the answer, and keeps working. In `titan`, this is the `ask` request.
- A _guardrail_ is a check that can stop an agent. A _blocking_ guardrail runs before the agent starts. A _parallel_ guardrail runs at the same time as the agent.
- A _checkpoint_ is a saved copy of a run's state, so the run can go on after a crash.
- A _stall count_ is a number that goes up when a run makes no progress, and down when it does.
- A _failure kind_ is a name for the way a multi-agent run went wrong, from the list in the MAST paper (S20).
- A _span_ is one timed piece of work in a trace, such as one agent's turn. _OpenTelemetry_ is an open standard for traces, and its GenAI rules name the spans of AI agents.
- An _agent card_ is a JSON file that tells other programs what an agent can do and where to call it. It comes from the A2A (Agent2Agent) protocol.
- _Correlated errors_ are mistakes that several samples share, because they come from the same model or the same wrong idea.

## 1. The frameworks, side by side

The table lists what each project says about itself, from its own README or docs page. "Tested here" means a test in `probes/swarm/` ran the package.

| Framework                       | How it runs agents                           | Saves state       | Waits for a person | Traces            | Status                     | Tested here   |
| ------------------------------- | -------------------------------------------- | ----------------- | ------------------ | ----------------- | -------------------------- | ------------- |
| OpenAI Agents SDK, JS (S1–S3)   | handoffs, agents as tools, guardrails        | sessions          | yes                | own tracing       | no notice on the page      | yes, 0.21.0   |
| OpenAI Swarm (S4)               | handoffs                                     | no                | no                 | no                | replaced by the Agents SDK | no            |
| LangGraph (S5, S7, S31)         | a graph of nodes                             | checkpoints       | interrupts         | LangSmith         | no notice on the page      | yes, JS 1.5.2 |
| LangGraph Swarm (S6)            | handoff tools on LangGraph                   | through LangGraph | through LangGraph  | through LangGraph | no notice on the page      | no            |
| CrewAI (S8)                     | crews of agents, and flows                   | not read          | not read           | not read          | no notice on the page      | no            |
| Microsoft Agent Framework (S9)  | graph workflows                              | checkpoints       | yes                | OpenTelemetry     | no notice on the page      | no            |
| AutoGen (S10, S30)              | group chats with stop conditions             | not read          | not read           | not read          | archived                   | no            |
| Google ADK for TypeScript (S11) | agents and workflow agents                   | not read          | not read           | not read          | no notice on the page      | no            |
| Mastra (S12)                    | `.then()`, `.branch()`, `.parallel()`        | storage           | suspend and resume | not read          | no notice on the page      | no            |
| Ruflo, once claude-flow (S13)   | a "queen" that leads a swarm                 | vector memory     | not read           | not read          | no notice on the page      | no            |
| MetaGPT (S14)                   | fixed procedures for a team                  | not read          | not read           | not read          | no notice on the page      | no            |
| CAMEL (S15)                     | role-playing agents                          | not read          | not read           | not read          | no notice on the page      | no            |
| Strands Agents (S32)            | multi-agent patterns, tool servers           | sessions          | not read           | not read          | no notice on the page      | no            |
| Claude Code agent teams (S18)   | a lead and teammates with a shared task list | not read          | not read           | not read          | experimental               | no            |

"Not read" means that the fetched page did not say, and no other page was read for it. "No notice on the page" means that the page did not say that the project is archived, replaced or experimental.

What the sources say, in their own words:

> [S2] "Handoffs let an agent delegate part of a conversation to another agent."

> [S2] "Handoffs are represented as tools to the LLM."

> [S2] "If the specialist should stay behind the original agent, use agents as tools instead."

> [S4] "Swarm is now replaced by the [OpenAI Agents SDK](https://github.com/openai/openai-agents-python)"

> [S5] "Build agents that persist through failures and can run for extended periods"

> [S6] "The system remembers which agent was last active"

> [S8] "It gives developers autonomous agent collaboration through Crews and precise, event-driven control through Flows."

> [S9] "Build multi-agent systems with graph-based workflows supporting sequential, concurrent, handoff, and group collaboration patterns; includes checkpointing, streaming, human-in-the-loop, and time-travel"

> [S9] "Built-in OpenTelemetry integration for distributed tracing, monitoring, and debugging"

> [S10] "This project has been archived and is no longer actively maintained by Microsoft."

> [S10] "New users should start with [Microsoft Agent Framework](https://github.com/microsoft/agent-framework)."

> [S12] "Mastra workflows use an intuitive syntax for control flow (`.then()`, `.branch()`, `.parallel()`)."

> [S13] "Queen-led hierarchy (Raft, Byzantine, Gossip)"

> [S14] "`Code = SOP(Team)` is the core philosophy."

> [S15] "CAMEL is an open-source community dedicated to finding the scaling laws of agents."

> [S18] "Agent teams are experimental and disabled by default."

> [S18] "In agent teams, teammates share a task list, claim work, and communicate directly with each other."

> [S30] "They can be combined using the AND and OR operators."

What this means for `titan`: most frameworks now offer the same few parts. These are handoffs or agents as tools, a saved state that survives a crash, a pause for a person, and traces. `titan` already has a board that survives a crash, a pause for a person, and the `ask` request. The parts it lacks are a stall count, failure kinds, a blocking check on each task, a standard trace and an agent card. Sections 3 to 7 test the frameworks and the ideas that can run without a real model. Failure kinds were not tested.

## 2. What the papers say about many agents

### More agents help only when the parts are independent

> [S21] "tasks where single-agent performance already exceeds 45% accuracy experience negative returns from additional agents"

> [S21] "all multi-agent variants universally degrade performance on tasks requiring sequential constraint satisfaction"

> [S21] "Relative performance change compared to single-agent baseline ranges from + 80.8 % {+}80.8\% on decomposable financial reasoning to − 70.0 % {-}70.0\% on sequential planning"

> [S21] "The framework identifies the best-performing architecture for 87% of held-out configurations"

> [S18] "For sequential tasks, same-file edits, or work with many dependencies, a single session or [subagents](https://code.claude.com/docs/en/"

In plain words: when one agent already does well, or when each step needs the one before it, more agents make the result worse. They help when the work splits into parts that do not depend on each other. Anthropic gives the same advice for its own agent teams. (The numbers in the S21 quote appear twice because the page repeats its math as text.)

### A central check stops errors from spreading

> [S21] "Independent systems amplify trace-level errors 17.2 × 17.2\times through unchecked error propagation"

> [S21] "Centralized coordination, however, contains this to 4.4 × 4.4\times"

In plain words: when agents work alone and their results are joined with no check, one agent's mistake reaches the end result much more often. `titan` already checks each result with a falsifier before it moves on, which is this kind of central check.

### Why multi-agent runs fail: the MAST list

The MAST paper (S20) sorted failures in multi-agent runs into 14 failure kinds:

> [S20] "These include failing to follow task requirements (FM-1.1, 11.8%) or agent roles (FM-1.2, 1.5%), step repetitions (FM-1.3, 15.7%), context loss (FM-1.4, 2.80%), or not recognizing task completion (FM-1.5, 12.4%)."

> [S20] "proceeding with wrong assumptions instead of seeking clarification (FM-2.2, 6.80%), task derailment (FM-2.3, 7.40%), withholding crucial information (FM-2.4, 0.85%), ignoring other agents’ input (FM-2.5, 1.90%), or mismatches between reasoning and action (FM-2.6, 13.2%)."

> [S20] "including premature termination (FM-3.1, 6.20%), no or incomplete verification (FM-3.2, 8.20%), or incorrect verification (FM-3.3, 9.10%)."

> [S20] "Systems with explicit verifiers like MetaGPT and ChatDev generally show fewer total failures"

> [S20] "However, the presence of a verifier is not a silver bullet, as overall MAS success rates can still be low."

> [S20] "a straightforward system workflow adjustment ensuring the CEO had the final say contributed to a +9.4% increase in overall task success rate."

The 14 names, as the paper's list of examples gives them:

- FM-1.1 Disobey task specification
- FM-1.2 Disobey role specification
- FM-1.3 Step repetition
- FM-1.4 Loss of conversation history
- FM-1.5 Unaware of stopping conditions
- FM-2.1 Conversation reset
- FM-2.2 Fail to ask for clarification
- FM-2.3 Task derailment
- FM-2.4 Information withholding
- FM-2.5 Ignored other agent's input
- FM-2.6 Reasoning-action mismatch
- FM-3.1 Premature termination
- FM-3.2 No or incomplete verification
- FM-3.3 Incorrect verification

In plain words: a falsifier helps, but it does not catch everything. The most common failures are steps that repeat, agents that do not see that the work is done, and actions that do not match the plan.

### Finding which agent failed is hard

> [S27] "The best method achieves 53.5% accuracy in identifying failure-responsible agents but only 14.2% in pinpointing failure steps"

> [S26] "AgentLocate, a framework that attributes failures to both a specific agent and the earliest decisive step."

In plain words: even the best tools find the wrong agent about half the time when they read a long chat log afterwards. `titan` keeps a verdict for each step on the board, so the failed step is known when it fails. A failure kind given by a falsifier is still a guess by a model, and it is kept as a hint only.

### A stall count starts a new plan

> [S19] "The Orchestrator also maintains a counter for how long the team has been stuck or stalled. If a loop is detected, or there is a lack of forward progress, the counter is incremented."

> [S19] "As long as this counter remains below a threshold ( ≤ 2 \leq 2 in our experiments)"

> [S19] "However, if the counter exceeds the threshold, the Orchestrator breaks from the inner loop, and proceeds with another iteration of the outer loop."

In plain words: Magentic-One counts turns with no progress. Past 2, it stops and writes a new plan. Step repetition is the most common failure kind in MAST, so `titan` takes this count.

### Voting helps only when the errors are independent

> [S22] "we find that Majority Voting alone accounts for most of the performance gains typically attributed to MAD."

> [S23] "We find that, simply via a sampling-and-voting method, the performance of large language models (LLMs) scales with the number of agents instantiated."

> [S28] "We prove that sampling n independent outputs with error rate p achieves system error O(p^{ceil(n/2)}), enabling exponential reliability gains."

> [S28] "Even using cheaper models with 5% per-action error, consensus voting with 5 agents reduces error to 0.11%"

> [S25] "plurality voting over agents that answer directly realises almost none of this potential"

> [S25] "Multi-round revision raises accuracy considerably, yet the gain is nearly the same with one peer as with 29."

> [S25] "item-level biases shared across the samples of a model account for about 87% of the squared error, so averaging reduces error by only about 6%."

> [S25] "Combining model families helps on Fermi estimation but does not surpass the strongest member on disjunctive tasks."

In plain words: two papers say that voting gives most of the gain (S22, S23). The Six Sigma paper (S28) promises a very low error, but only for independent samples. The newest paper (S25) found that samples from one model share most of their errors, so voting did little. Section 6 tests this.

### Share the whole context

> [S24] "Principle 1 Share context, and share full agent traces, not just individual messages"

> [S24] "Principle 2 Actions carry implicit decisions, and conflicting decisions carry bad results"

> [S29] "graph structure performs the best among coordination protocols in the research scenario, and cognitive planning improves milestone achievement rates by 3%."

In plain words: agents that work on parts of one task must see what the others decided. `titan` already gives each worker the plan of its run, as in spec hive-collaboration. It keeps falsifiers blind to the worker's reasoning on purpose, so that a falsifier judges the result alone, as in spec step-falsification.

## 3. Test: handoffs, agents as tools and turn limits in the OpenAI Agents SDK

The test `probes/swarm/test/openai-agents.test.ts` runs `@openai/agents` 0.21.0 with a fake model that answers from a script. It needs no key.

> [probe:swarm/out/openai-agents-output.txt] "handoff tool names seen by the model: [ "transfer_to_refund_agent" ]"

> [probe:swarm/out/openai-agents-output.txt] "last agent: refund_agent | final output: refund done"

> [probe:swarm/out/openai-agents-output.txt] "agent-as-tool last agent: main | output: the answer is 42"

> [probe:swarm/out/openai-agents-output.txt] "maxTurns=3: MaxTurnsExceededError | tool runs: 3"

Result: the handoff gave the conversation to the refund agent, and it was the last agent. As a tool, the specialist answered and the main agent kept control. A loop of tool calls stopped after 3 turns. `titan` keeps its `ask` request, which works like an agent as a tool. It does not add handoffs, because the agent of a step must stay the one whose result is falsified.

## 4. Test: a blocking check against a parallel check

The same test file runs an input guardrail that takes 30 ms and always stops the run. The fake model counts its calls.

> [S3] "runInParallel: true (default) starts input guardrails concurrently with agent execution."

> [S3] "the model may already have consumed tokens or run tools if the guardrail later triggers."

> [S3] "runInParallel: false runs the guardrail before calling the model, preventing token spend and tool execution when the guardrail blocks the request."

> [probe:swarm/out/openai-agents-output.txt] "runInParallel=false: error=InputGuardrailTripwireTriggered, fake model calls=0"

> [probe:swarm/out/openai-agents-output.txt] "runInParallel=true: error=InputGuardrailTripwireTriggered, fake model calls=1"

Result: the docs were right. The parallel check stopped the run only after the model had answered once. The blocking check stopped it with 0 model calls. For `titan`, a check that a task holds no key must block. A key that reached a model once has already left the person's computer.

## 5. Test: checkpoints and resume in LangGraph

The test `probes/swarm/test/langgraph.test.ts` runs `@langchain/langgraph` 1.5.2 with plain functions as nodes, and no model.

> [probe:swarm/out/langgraph-output.txt] "log [ "a", "b" ]"

> [probe:swarm/out/langgraph-output.txt] "error: 'better-sqlite3' is not yet supported in Bun."

> [probe:swarm/out/langgraph-output.txt] "interrupt: paused = true | code before interrupt ran 2 times | log [ "answer=yes" ]"

> [S7] "MemorySaver does not persist between restarts"

> [S31] "The node restarts from the beginning of the node where the interrupt was called when resumed, so any code before the interrupt runs again"

Result:

- With the checkpoint in memory, a crash in node `b` resumed at `b`, and node `a` did not run again. The run counts were `a: 1, b: 2`.
- The SQLite checkpoint package `@langchain/langgraph-checkpoint-sqlite` 1.1.0 failed under Bun 1.3.10, because its SQLite library does not load in Bun. This disproves the idea that `titan` could use LangGraph's saved state as it is.
- The code before `interrupt()` ran twice: once before the pause and once after the resume. The docs say so.

For `titan`: spec workflow-run already says that a resumed step starts again from its first attempt. That is the same rule as LangGraph's, and it has the same risk: work done before the pause can happen twice. `titan` keeps its own board in plain files and `bun:sqlite`, and does not take LangGraph as its engine.

## 6. Test: a vote when the errors are shared

The test `probes/swarm/test/titan-toys.test.ts` models 5 votes, each wrong 5 % of the time. With a chance called the _shared share_, all 5 samples make the same mistake. The random numbers have a fixed seed, and there are 200000 trials for each row.

> [probe:swarm/out/all-output.txt] "5 votes, 5 % error each. Exact independent error: 0.116 %"

> [probe:swarm/out/all-output.txt] "shared share 0: vote error 0.122 %"

> [probe:swarm/out/all-output.txt] "shared share 0.1: vote error 0.603 %"

> [probe:swarm/out/all-output.txt] "shared share 0.3: vote error 1.572 %"

> [probe:swarm/out/all-output.txt] "shared share 1: vote error 4.958 %"

Result: with independent errors, the vote error was about 0.12 %, close to the Six Sigma example. When 1 trial in 10 shared one mistake, the vote error was 5 times higher. When all trials shared it, the vote gave no gain over one sample. This is a toy, not a measurement on real models. With S25, it is enough to reject voting as a way to make `titan`'s results safe.

For `titan`: the falsifier and the judge stay. A step with several candidates can spread them over different backends, so that they share fewer mistakes. S25 found that mixing model families helped on some tasks and not on others, so this is a choice in the workflow file, not a default.

## 7. Tests: a stall count, OpenTelemetry spans and an A2A agent card

**Stall count.** The same toy file runs a small stall count with a limit of 2, as in Magentic-One.

> [probe:swarm/out/all-output.txt] "replan after \"run test\""

Result: 4 turns with the same output started 1 new plan. Ten turns with new output started none. This tests the rule only. It does not show that a new plan makes a real run better.

**OpenTelemetry spans.** The test `probes/swarm/test/otel.test.ts` turns a fake `titan` run record into spans with `@opentelemetry/sdk-trace-base` 2.12.0. The spans stay in memory, so nothing goes over the network.

> [S17] "**Status**: [Development][DocumentStatus]"

> [S17] "`invoke_agent` when an LLM drives the control flow through tool calls"

> [S17] "`invoke_workflow` when the application defines the control flow"

> [probe:swarm/out/all-output.txt] "execute_tool read_file <- invoke_agent coder"

> [probe:swarm/out/all-output.txt] "invoke_agent skeptic <- invoke_workflow fix-bug"

> [probe:swarm/out/all-output.txt] "invoke_workflow fix-bug <- (root)"

Result: the run became one `invoke_workflow` span, with one `invoke_agent` span for each agent, and one `execute_tool` span under its agent. `titan` defines its own steps, so `invoke_workflow` fits it. The GenAI rules are still in development, so the names can change. Sending spans to a trace server was not tested.

**Agent card.** The test `probes/swarm/test/a2a.test.ts` builds an agent card for `titan serve` with the types of `@a2a-js/sdk` 1.3.0. It writes the card as JSON and reads it back.

> [S16] "The Agent2Agent (A2A) Protocol is an open standard designed to facilitate communication and interoperability between independent, potentially opaque AI agent systems."

> [probe:swarm/out/all-output.txt] "card path: .well-known/agent-card.json | protocol: 1.0"

Result: the card passed the TypeScript check in strict mode and came back with the same name and skill. The A2A routes for tasks were not tested.

The whole probe: 12 tests passed and 1 failed. The failed test is the SQLite checkpoint under Bun, kept as evidence.

> [probe:swarm/out/all-output.txt] "12 pass"

> [probe:swarm/out/tsc-output.txt] "exit code 0"

## 8. Claims that were wrong or could not be checked

- A search summary said that AutoGen is in "maintenance mode". Its README says that it is archived and gets no security fixes (S10).
- A search summary said that the Finance Agent gain is 80.9 %. The paper says 80.8 % (S21).
- Ruflo says that its vector memory is "~1.9x faster at N=20k". Its README points to its own audit file for this. No test here checked it, and a search summary that said it saves 30–50 % of cost gave no measurement.
- The Six Sigma paper's error of 0.11 % holds only for independent samples. S25 and the toy in section 6 show that shared errors raise it.
- The OpenTelemetry page for agent spans has moved to the repository `open-telemetry/semantic-conventions-genai`. S17 is the moved file.
- The LangGraph link for durable execution now shows the persistence page (S7).
- LangGraph's SQLite checkpoint does not load under Bun (section 5).

## 9. All picks in one table

| Idea                                                                   | Source              | Pick                                                                                 | Where in the specs                                                      |
| ---------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| A stall count, and a new plan after more than 2 turns with no progress | S19, S20, test      | kept                                                                                 | spec hive-collaboration, "A run that makes no progress gets a new plan" |
| Failure kinds from MAST on each refutation                             | S20, S27            | kept, as a hint                                                                      | spec step-falsification, "A refutation can name its failure kind"       |
| Tell the main agent when not to split work                             | S18, S21, S25       | kept                                                                                 | spec main-agent-guide, "The guide says when not to split work"          |
| Candidates on different backends                                       | S25, S28, test      | kept, only when the file asks                                                        | spec step-falsification, "Candidates can run on different backends"     |
| A blocking check that no task holds a key                              | S3, test            | kept                                                                                 | spec backend-selection, "A task that holds a key is never sent"         |
| Spans with the GenAI names                                             | S9, S17, test       | kept, written to a file                                                              | spec workflow-run, "titan trace writes the run as spans"                |
| An A2A agent card for `titan serve`                                    | S16, test           | partly kept: the card only                                                           | spec titan-server, "The server shows an agent card"                     |
| Majority vote in place of the judge                                    | S22, S23, S25, test | not kept                                                                             | —                                                                       |
| Handoffs                                                               | S2, S6, test        | not kept: `ask` already works as an agent as a tool                                  | —                                                                       |
| Stop conditions joined with AND and OR                                 | S30                 | not kept: each `titan` limit stops a run on its own                                  | —                                                                       |
| LangGraph or the OpenAI Agents SDK as `titan`'s engine                 | S5, S7, test        | not kept: the SQLite checkpoint fails under Bun, and `titan` runs vendor agent tools | —                                                                       |
| A queen with Raft or Byzantine voting                                  | S13                 | not kept: one local server owns the board, and no claim was tested                   | —                                                                       |
| Share full traces with every agent                                     | S24                 | partly kept: workers see the plan, and falsifiers stay blind                         | already in spec hive-collaboration                                      |
| Resume replays the step                                                | S31, test           | already in spec workflow-run                                                         | a risk in design.md                                                     |

## 10. Not tested

- Sending spans to a trace server with the OTLP protocol.
- The A2A routes for tasks, and a client that calls `titan` through A2A.
- CrewAI, Microsoft Agent Framework, Google ADK, Mastra, Ruflo, MetaGPT, CAMEL, Strands and LangGraph Swarm. Their pages were read, but their code was not run.
- Whether a new plan after a stall makes a real run better.
- Whether a falsifier names the right failure kind. S27 shows that models find the failing step only 14.2 % of the time from a log.
- Whether candidates on different backends share fewer mistakes in real `titan` runs.
