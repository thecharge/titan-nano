# Research: the hive, approvals, the persona lifecycle, the server and the harness plug-in

**Reader:** a developer new to `titan`. **Purpose:** see which pattern was picked for each part of the hive, which ones were rejected, and the evidence for both.

The user asked for this on 2026-11-05: `titan` is an adaptive software factory that solves one or many problems as a _hive_. Any agent can add a step, or ask the main agent or the person to approve or to do something. The same goes for skills, tools and everything else. `titan` plugs into an agent tool through a skill or a command. Other programs use an API: a command-line tool and a server that does the work. The user also asked for more on how agents work together, how to measure when a persona needs an update or a delete, and the lifecycle of a persona.

All tests ran on 2026-11-05 on Linux x86-64 with Bun 1.3.10. Each test is one run, not a benchmark. Every quote below is copied from the fetched page. The page text is in `hive-sources/<id>.txt`, and the links are in `hive-sources/urls.tsv`. All 29 pages returned HTTP 200. To check the quotes, run this from the `research/` folder:

```bash
python3 -I check-quotes.py hive.md hive-sources probes
```

## 1. How agents work together

**Candidates**

| Pattern                  | What it is                                                                                             | Kept?                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Fixed pipeline           | Each agent hands its result to the next one, in an order fixed at the start.                           | No                                                                              |
| Lead agent and workers   | One lead agent splits the work and gives each part to a worker.                                        | Partly: the main agent leads, but it does not have to know every step up front. |
| Blackboard               | All agents read and write one shared board. The next agent to act is chosen from what is on the board. | Yes                                                                             |
| Open call (Contract Net) | A task is posted without naming who does it. Agents that fit offer to do it, and one is chosen.        | Yes, for steps that name no persona                                             |
| Traces (stigmergy)       | One agent's result on the board is the signal that starts the next agent.                              | Yes: a new board entry wakes the scheduler.                                     |

**Evidence for the blackboard**

> [H1] "agents that will take actions are selected based on the current content of the blackboard"

> [H2] "master-slave multi-agent systems rely on a rigid central controller that requires precise knowledge of each sub-agent's capabilities"

> [H2] "a central agent posts requests to a shared blackboard, and autonomous subordinate agents - either responsible for a partition of the data lake or retrieval from the web - volunteer to respond based on their capabilities"

> [H3] "a manager proposes a task to several agents. The latter make a proposal among which the manager chooses to allocate the task."

> [H4] "A tuple space is an implementation of the associative memory paradigm for parallel/distributed computing."

> [H5] "The principle is that the trace left in the environment by an individual action stimulates the performance of a succeeding action by the same or different agent."

**Evidence against a hive with no limits**

> [H6] "Early agents made errors like spawning 50 subagents for simple queries, scouring the web endlessly for nonexistent sources, and distracting each other with excessive updates."

> [H6] "multi-agent systems use about 15× more tokens than chats"

> [H6] "Each subagent needs an objective, an output format, guidance on the tools and sources to use, and clear task boundaries."

> [H7] "cascading hallucinations caused by naively chaining LLMs"

**Test: a hive on a server, where agents add steps** (`probes/hive-server/`)

A fake planner agent added three steps while the hive ran. A runaway agent tried to add 50 steps under a limit of 10.

> [probe:hive-server/test-output.txt] "PASS agents add steps: 4 steps, steps 2-4 added by s1 (the planner)"

> [probe:hive-server/test-output.txt] "PASS other steps run while one waits: coder and tester done, deploy is "waiting""

> [probe:hive-server/test-output.txt] "PASS runaway agent is stopped: 10 steps, 41 refused, 1 request to the main agent to raise the limit"

**Pick:** a blackboard with limits. The main agent writes the first plan. Every agent may then add steps and requests to the board. A step that names no persona is an open call: `titan` searches the register and picks a persona as in section 3. Each hive has a step limit and a limit on agents at the same time. Going over a limit is a request to the main agent, never a silent stop. A step that an agent adds needs a falsifier, like any other step.

## 2. Who may approve what

**Candidates**

| Pattern                        | What it is                                                                                                                     | Kept?                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| Approve everything             | Every added step, tool or skill waits for the person.                                                                          | No: the person would answer all day. |
| Approve nothing                | Agents add what they like.                                                                                                     | No: see the runaway test above.      |
| Levels per kind                | A policy says, for each kind of request, who decides: `titan` alone (`auto`), the main agent (`main`) or the person (`human`). | Yes                                  |
| Agent waits inside a tool call | The agent calls a tool such as `ask_human` that returns only when the answer comes.                                            | Only for short asks between agents   |

**Evidence**

> [H8] "Use permission modes and rules to define what’s allowed automatically, and the canUseTool callback to handle everything else at runtime."

> [H10] "When an interrupt is triggered, LangGraph saves the graph state using its persistence layer and waits indefinitely until you resume execution."

> [H9] "Servers MUST NOT use elicitation to request sensitive information."

> [H21] "Timeout (seconds) for the server to run a tool. Default: 60"

The last quote falsifies the idea that an agent can wait inside a tool call for a person. Codex stops a tool call after 60 s by default, and a person may answer hours later. So a request to the main agent or the person ends the agent's turn. The agent's session is continued when the answer comes, as the board decision in the design already does.

**Test: approvals on the server** (`probes/hive-server/`)

> [probe:hive-server/test-output.txt] "PASS request goes to the human: request r1 to human, kind approve_deploy"

> [probe:hive-server/test-output.txt] "PASS main agent cannot answer for the human: status 403"

> [probe:hive-server/test-output.txt] "PASS two answers at once: statuses 200 and 409"

Control run, with the version check turned off:

> [probe:hive-server/control-output.txt] "CONTROL no version check: statuses 200 and 200, 2 answer events for one request"

**Pick:** levels per kind of request, set in the workflow file, with defaults. A request for a person can only be answered by a person. Every answer names the version of the request it saw, and only the first answer wins.

## 3. How personas live and die

**What to measure**

A persona's main number is its _survival rate_: the share of its results that survived falsification. The register also keeps these numbers for each version:

- how often it was used;
- how often other agents asked it for help;
- the usage numbers that the backend reports;
- for a falsifier: how many results it refuted;
- for a falsifier: how many results it passed that a later check refuted.

**Candidates for "this persona needs an update"**

| Rule                                         | Kept?                                |
| -------------------------------------------- | ------------------------------------ |
| Survival rate below the bar after 3 uses     | No: it flags good personas often.    |
| Survival rate below the bar after 10 uses    | No: still flags 1 good persona in 5. |
| The 95 % Wilson upper bound is below the bar | Yes                                  |

The _Wilson upper bound_ is the highest survival rate that still fits the results seen so far, with 95 % confidence. When even that is below the bar, the persona is very likely below the bar.

> [H11] "It can be safely employed with small samples and skewed observations."

**Test: simulated personas** (`probes/persona-lifecycle/`)

The bar was 0.6, a guess that has not been measured. Each case had 20000 simulated personas with 30 uses each, and a fixed seed.

> [probe:persona-lifecycle/simulate-output.txt] "true rate 0.75: 39.4 % flagged, median use 4"

That line is for the 3-use rule: it flagged 39.4 % of good personas (true rate 0.75). For the Wilson rule:

> [probe:persona-lifecycle/simulate-output.txt] "true rate 0.75: 2.2 % flagged, median use 3"

> [probe:persona-lifecycle/simulate-output.txt] "true rate 0.35: 89.5 % flagged, median use 8"

**Candidates for "which persona to pick"**

| Rule                                                                                               | Kept? |
| -------------------------------------------------------------------------------------------------- | ----- |
| Always the one with the best rate so far (_greedy_)                                                | No    |
| Thompson sampling: draw a likely rate for each persona from its results, and pick the highest draw | Yes   |

> [H12] "is a heuristic for choosing actions that address the exploration–exploitation dilemma in the multi-armed bandit problem"

> [probe:persona-lifecycle/simulate-output.txt] "greedy: the worse persona got most picks in 26.6 % of runs; 27.5 % of all picks went to it"

> [probe:persona-lifecycle/simulate-output.txt] "thompson: the worse persona got most picks in 1.8 % of runs; 12.3 % of all picks went to it"

That test assumed that a persona's rate never changes. A second test (`probes/persona-lifecycle/drift.ts`) swaps two personas' rates halfway through. Plain Thompson sampling failed it, and counts that fade passed it:

> [probe:persona-lifecycle/drift-output.txt] "plain Thompson (no fading): after the swap, 22.7 % of picks went to the persona that is now better"

> [probe:persona-lifecycle/drift-output.txt] "Thompson, counts fade by 0.98 per pick: after the swap, 69.3 % of picks went to the persona that is now better"

So the pick is Thompson sampling on counts that fade by 0.98 for each new result, with a floor of 10 % of picks for each matching persona. `research/orchestration.md` section 4 has the details. The 0.98 and the 10 % are guesses that have not been measured.

**Evidence for keeping old versions and learning from text**

> [H13] "a meta agent iteratively programs interesting new agents based on an ever-growing archive of previous discoveries"

> [H26] "Reflexion agents verbally reflect on task feedback signals, then maintain their own reflective text in an episodic memory buffer"

> [H6] "we use rainbow deployments to avoid disrupting running agents, by gradually shifting traffic from old to new versions while keeping both running simultaneously"

**Pick: the lifecycle**

1. _proposed_: an agent or the main agent writes a new persona. It waits for approval at the level the policy sets.
2. _trial_: the persona is used, but it has too few results to know how good it is.
3. _proven_: its 95 % Wilson lower bound is above the bar.
4. _needs update_: its 95 % Wilson upper bound is below the bar. `titan` asks the main agent for an improved version. The new version starts in _trial_, and both versions stay in use, picked by Thompson sampling, until one is better.
5. _retired_: a newer version is proven better, or a second update in a row also needs an update. A retired persona is not picked any more, but runs that used it can still be read.
6. _deleted_: only on a request that a person approves. The file moves to `.history/`. Nothing is removed.

Two personas whose texts mean almost the same are offered to the main agent as a merge. The threshold for "almost the same" is a guess that has not been measured.

## 4. The titan server and its API

**Candidates**

| Pattern                                                                                          | Kept?                                                                           |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Command-line tool only, as in the earlier design                                                 | No: the user asked for a server that does the work, so others can hook into it. |
| Server that keeps the state in memory                                                            | No: see the control run below.                                                  |
| Server whose truth is the board file, with the state rebuilt from it at start (_event sourcing_) | Yes                                                                             |
| Server on all network interfaces                                                                 | No                                                                              |

**Evidence**

> [H24] "Event Sourcing ensures that all changes to application state are stored as a sequence of events."

> [H23] "An event store is a type of database optimized for storage of events."

> [H14] "Bun.serve to start a high-performance HTTP server in Bun"

> [H15] "To open a connection to the server to begin receiving events from it, create a new EventSource object with the URL of a script that generates the events."

> [H16] "include the Last-Event-ID header to indicate the last event ID it received"

> [H16] "Servers MUST validate the Origin header on all incoming connections to prevent DNS rebinding attacks"

> [H16] "When running locally, servers SHOULD bind only to localhost (127.0.0.1) rather than all network interfaces (0.0.0.0)"

**Test** (`probes/hive-server/`)

> [probe:hive-server/test-output.txt] "PASS state survives a crash: steps after restart equal (12 board lines)"

> [probe:hive-server/test-output.txt] "PASS events resume without gaps: 15 of 15 events, in order, no duplicates"

> [probe:hive-server/test-output.txt] "PASS no token: status 401"

> [probe:hive-server/test-output.txt] "PASS foreign web page: status 403"

> [probe:hive-server/test-output.txt] "11 passed, 0 failed"

Control run, with the state in memory only:

> [probe:hive-server/control-output.txt] "CONTROL state in memory only: 4 steps before the crash, 0 after"

One gap came out of the test. A step that was running when the server stopped runs again after the restart. So a step can run more than once, and the board must say so.

**Pick:** `titan serve` runs a Bun HTTP server on 127.0.0.1 only. It needs a token, and it refuses web pages from other sites. The board file is the truth, and the server rebuilds its state from it when it starts. Live events go out as server-sent events, and a client that reconnects gets the events it missed. The `titan` commands are clients of this server.

## 5. How titan plugs into each agent tool

**Candidates**

| Pattern                                                                                                                                          | Kept?                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| A guide that the main agent must be told to read                                                                                                 | No: the main agent may not know `titan` exists.      |
| One skill per agent tool, written by hand                                                                                                        | No: the three tools read the same `SKILL.md` format. |
| One Claude Code plug-in with the skill and a tool server, installed in Claude Code, imported by Antigravity, and the same skill folder for Codex | Yes                                                  |

**Evidence**

> [H18] "Custom commands have been merged into skills."

> [H17] "Use a plugin when you want several skills, subagents, hooks, or MCP servers packaged as one unit."

> [H20] "For repositories, Codex scans .agents/skills in every directory from your current working directory up to the repository root."

> [H20] "A skill is a directory with a SKILL.md file plus optional scripts and references."

> [H27] "Antigravity defaults to .agents/skills"

> [H28] "Migrate existing extensions from ~/.gemini/extensions/ or ~/.claude/plugins/ (or pass a specific directory path)"

**Test: one plug-in folder in two tools** (`probes/harness-plugin/`)

The folder has `.claude-plugin/plugin.json`, the skill `skills/titan/SKILL.md`, and `.mcp.json` that starts `titan mcp`.

> [probe:harness-plugin/validate-output.txt] "Validation passed with warnings"

Antigravity's own check refused the same folder, because it looks for `plugin.json` in the top folder:

> [probe:harness-plugin/validate-output.txt] "Error: missing plugin.json: stat titan/plugin.json: no such file or directory"

Its import of the Claude Code form worked, in an empty home folder:

> [probe:harness-plugin/agy-import-output.txt] "skills : 1 processed"

> [probe:harness-plugin/agy-import-output.txt] "mcpServers : 1 processed"

**Pick:** `titan install` writes one plug-in in the Claude Code form. It holds the skill `titan` and the tool server `titan mcp`. For Claude Code, `titan install` installs the plug-in. For Antigravity, it runs `agy plugin import` on it. For Codex, it writes the same skill to `.agents/skills/titan/SKILL.md` and adds `titan mcp` with `codex mcp add`. The skill can be started by name: `/titan` in Claude Code and Antigravity, `$titan` in Codex.

> [H18] "you can invoke one directly with /skill-name"

> [H27] "Type /<skill-name> in the message box to explicitly invoke a skill."

> [H20] "In Codex, invoke it as: $skill-creator"

> [H21] "codex mcp add context7 -- npx -y @upstash/context7-mcp"

## 6. What was not tested

- No live agent loaded the skill in any of the three tools. Only the plug-in checks and the Antigravity import ran.
- `codex mcp add` was not run, so that the user's Codex settings stay as they are.
- The server test used fake agents with a 30 ms delay, not real agents.
- The simulation assumes that a persona's survival rate does not change over time. Real personas may get better or worse as the problems change.
- The bar of 0.6 and the threshold for a merge are guesses that have not been measured.
- The server ran with one hive at a time. Several hives at once were not tested.
