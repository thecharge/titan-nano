# Research: a hive that trains its own orchestration, and agents on RunPod

**Reader:** a developer new to `titan`. **Purpose:** see how `titan` learns to run the hive better after each run, without falling back to one agent at a time. Also see how agents can run on RunPod serverless within 1 hour for each workflow.

On 2026-11-05 the user said that the design in `research/hive.md` would lead to _serial collapse_. They asked for a native self-training orchestration with reinforced loops, so that the hive works like a self-organising organism. They also asked where agents can be added on top of RunPod serverless, with a limit of 1 hour for each workflow.

All tests ran on 2026-11-05 on Linux x86-64 with Bun 1.3.10. Every quote below is copied from the fetched page. The page text is in `orchestration-sources/<id>.txt`, and the links are in `orchestration-sources/urls.tsv`. All 20 pages returned HTTP 200. To check the quotes, run this from the `research/` folder:

```bash
python3 -I check-quotes.py orchestration.md orchestration-sources probes
```

## Words used here

- An _orchestrator_ decides which agents to start, how many at once, and with which task.
- _Serial collapse_ is when an orchestrator learns to run everything with one agent, even when it could run several agents at once.
- _Empty agents_ are agents that an orchestrator starts with no real part of the work. Kimi's report calls this "spurious parallelism".
- The _critical path_ is the longest chain of steps that must run one after another. Its length is the shortest time the run can take.
- A _reward_ is the number that tells a learning orchestrator how good a run was.
- _GRPO_ (Group Relative Policy Optimization) is a way to learn from rewards. It compares each try with the mean of a group of tries for the same task.
- A _trail_ is a count of good results for one choice, which fades a little with each new result. The name comes from ant trails, which fade unless ants keep using them.

## 1. What serial collapse is, and what others do about it

> [O2] "A common failure mode is serial collapse , where the orchestrator defaults to single-agent execution despite having parallel capacity."

> [O1] "The reward r parallel r_{\text{parallel}} is introduced to mitigate serial collapse —a local optimum where the orchestrator defaults to single-agent execution."

> [O1] "It is used to prevent spurious parallelism , a reward-hacking behavior in which the orchestrator increases parallel metrics dramatically by spawning many subagents without meaningful task decomposition."

> [O1] "the hyperparameters λ 1 \lambda_{1} and λ 2 \lambda_{2} are annealed to zero over the course of training"

> [O2] "we evaluate performance using Critical Steps , a latency-oriented metric inspired by the critical path in parallel computation"

> [O1] "During training, sub-agents are frozen and their execution trajectories are excluded from the optimization objective; only the orchestrator is updated via reinforcement learning."

In plain words: Kimi K2.5 trains only the orchestrator. It adds a reward for starting agents in parallel and a reward for agents that finish real work. It lowers both rewards step by step to 0. It measures time as the length of the critical path, not as the total number of steps.

A survey of 2026 lists the failures that come back when orchestrators are trained:

> [O3] "As auxiliary orchestration rewards decay in Kimi PARL, a naive orchestrator can collapse to never spawning, regressing to a single-agent baseline."

> [O3] "Under shared reward, the orchestrator routes nearly all delegations to a single sub-agent that happens to be slightly above-average."

> [O3] "Orchestrators inflate message volume to farm message-level process rewards."

> [O3] "O5—when to stop—has no entry in our pool that trains it explicitly"

## 2. Candidates for the best orchestration

| Candidate                      | What it learns                                                               | Needs model training? | Kept?                                                              |
| ------------------------------ | ---------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------ |
| Kimi K2.5 Agent Swarm (O1, O2) | An orchestrator model that starts up to 100 agents                           | Yes, of a large model | The rewards, yes. The model training, no.                          |
| Puppeteer (O4)                 | An orchestrator that picks the next agent, trained by reinforcement learning | Yes                   | The idea of picking the next agent from the board, yes.            |
| ToolOrchestra (O12)            | A small orchestrator model (8B) that calls bigger models and tools           | Yes                   | As a later, optional step on RunPod.                               |
| Agent Lightning (O9)           | Training kept apart from the agents that run                                 | Yes                   | The split, yes: `titan` writes traces, training happens elsewhere. |
| MaAS (O5)                      | A spread of workflow shapes, sampled for each query                          | No model training     | Yes: the shape of a plan is picked for each kind of goal.          |
| AFlow (O6)                     | Better workflows by tree search over code                                    | No model training     | The archive of tried workflows, yes.                               |
| GPTSwarm (O7)                  | Better prompts and links between agents in a graph                           | No model training     | Partly: the improve loop already changes prompts.                  |
| DyLAN (O8)                     | A score for each agent, to pick a team                                       | No model training     | Yes: the persona measures in `research/hive.md` play this part.    |
| Self-Organized Agents (O11)    | More agents when the problem grows                                           | No model training     | Yes: agents add steps when a part is too big.                      |
| Ant colony optimization (O13)  | Trails that grow with good results and fade over time                        | No model training     | Yes: the reinforced loop.                                          |

> [O4] "This orchestrator is trained via reinforcement learning to adaptively sequence and prioritize agents, enabling flexible and evolvable collective reasoning."

> [O12] "We show that small orchestrators managing other models and a variety of tools can both push the upper bound of intelligence and improve efficiency in solving difficult agentic tasks."

> [O12] "ToolOrchestra explicitly uses reinforcement learning with outcome-, efficiency-, and user-preference-aware rewards."

> [O9] "Agent Lightning achieves complete decoupling between agent execution and training"

> [O5] "they typically seek to identify a static, complex, one-size-fits-all system, which, however, fails to dynamically allocate inference resources based on the difficulty and domain of each query"

> [O6] "iteratively refining workflows through code modification, tree-structured experience, and execution feedback"

> [O8] "we utilize an $\textit{agent selection}$ algorithm, based on an unsupervised metric called $\textit{Agent Importance Score}$"

> [O11] "A key feature of our framework is the automatic multiplication of agents based on problem complexity, allowing for dynamic scalability."

> [O13] "Pheromone evaporation also has the advantage of avoiding the convergence to a locally optimal solution."

> [O10] "we introduce Group Relative Policy Optimization (GRPO), a variant of Proximal Policy Optimization (PPO)"

**Why `titan` does not train a model by default:** `titan` runs agents on Claude, Codex, Antigravity and model APIs, and their models cannot be trained by `titan`. So the native learning in `titan` changes the choices it makes, not model weights. Those choices are: how wide to split a step, which persona to pick, and which plan shape to suggest. Training an open-weight orchestrator model, as ToolOrchestra does, is an optional later step (section 5).

## 3. Test: can serial collapse happen, and which reward stops it? (`probes/orchestration/`)

The toy has goals with 1, 4 or 8 independent parts. An orchestrator learns how many agents to start, with GRPO-style groups of 4 tries. Parallel agents start worse at splitting the work and get better with practice. Each reward was trained 200 times.

With a reward for the outcome only, the toy collapsed to one agent:

> [probe:orchestration/simulate-output.txt] "serial collapse (k=1 for 8 parts): 38.5 % of runs; empty agents (k>4 for 4 parts): 21.5 % of runs"

With the time on the critical path in the reward (reward B), collapse went away, but empty agents came in:

> [probe:orchestration/simulate-output.txt] "serial collapse (k=1 for 8 parts): 0.0 % of runs; empty agents (k>4 for 4 parts): 52.5 % of runs"

Kimi's rewards (reward C: a parallel bonus and a finish reward, both lowered to 0) made it worse in the toy. When the bonuses reach 0, nothing in the reward charges for an agent:

> [probe:orchestration/simulate-output.txt] "serial collapse (k=1 for 8 parts): 0.0 % of runs; empty agents (k>4 for 4 parts): 100.0 % of runs"

A small cost for each agent started fixed both, with or without Kimi's bonuses (rewards G and I):

> [probe:orchestration/simulate-output.txt] "I. outcome, time and a small agent cost (0.01), no bonuses"

> [probe:orchestration/simulate-output.txt] "serial collapse (k=1 for 8 parts): 0.0 % of runs; empty agents (k>4 for 4 parts): 0.0 % of runs"

A cost that is too large (reward H, 0.1 for each agent) used too few agents. On goals with 8 parts, the time on the critical path was 4.41 instead of 2.00:

> [probe:orchestration/simulate-output.txt] "on goals with 8 parts: share of parts done 0.90, time on the critical path 4.41"

**What the test shows, and what it does not show**

- Serial collapse is real even in a small toy, when the reward counts only the outcome.
- In this toy, the time on the critical path stops collapse, and a small cost for each agent stops empty agents. Kimi's parallel bonus was not needed. This disagrees with Kimi's report. The toy has no delayed or sparse feedback, which Kimi names as the cause, so the toy cannot rule the bonus out.
- The cost for each agent sets how much time is worth against money. That is the person's choice, not `titan`'s.

## 4. Test: picking personas when they change (`probes/persona-lifecycle/drift.ts`)

`research/hive.md` picked Thompson sampling. Its test assumed that a persona's rate never changes. This test swaps two personas' rates halfway through:

> [probe:persona-lifecycle/drift-output.txt] "plain Thompson (no fading): after the swap, 22.7 % of picks went to the persona that is now better"

> [probe:persona-lifecycle/drift-output.txt] "Thompson, counts fade by 0.98 per pick: after the swap, 69.3 % of picks went to the persona that is now better"

The survey warns that one slightly better agent can get almost all the work. With two personas at 0.62 and 0.60:

> [probe:persona-lifecycle/drift-output.txt] "plain Thompson: the less-used persona got 25.5 % of picks on average; it got under 10 % in 17.3 % of runs"

> [probe:persona-lifecycle/drift-output.txt] "Thompson with a floor of 10 % of picks for each persona: the less-used persona got 32.1 % of picks on average; it got under 10 % in 0.3 % of runs"

**Pick:** Thompson sampling on trails. A trail is the count of survived and refuted results, and it fades by 0.98 with each new result. Each persona that matches also gets at least 10 % of picks. The 0.98 and the 10 % are guesses that have not been measured.

## 5. Pick: the reinforced loops in titan

`titan` keeps a _policy_ for each kind of goal. A policy is the set of choices `titan` makes, with the trails behind each choice. After each run, three loops change it:

1. **Split width.** A step can split its work into parts. The policy picks how many agents work on the parts at once. The reward is: the share of results that survived, minus a weight for the time on the critical path, minus a weight for each agent started. The update compares the run with the mean of the last 4 runs of the same kind, as in GRPO.
2. **Persona pick.** Thompson sampling on fading trails, with a floor of 10 %, as in section 4.
3. **Plan shapes.** The plans of earlier runs, with their rewards, form an archive in the knowledge hub. When the main agent designs a plan, `titan` shows it the plans of the same kind of goal that had the highest rewards.

Two alarms watch each policy:

- _Serial collapse alarm:_ in the last 20 runs of one kind, more than half of the steps with 4 or more parts ran with one agent. `titan` then adds Kimi's parallel bonus for that kind and lowers it to 0 over the next 20 runs. It tells the main agent.
- _Empty agent alarm:_ more than 10 % of the agents started had no part. `titan` then raises the weight for each agent for that kind and tells the main agent.

All numbers in this section (4 runs, 20 runs, half, 10 %) are guesses that have not been measured.

The learned policy only picks among choices that pass the checks, the limits and the approvals. It cannot remove a falsifier, go over a limit or change who must approve what.

**Optional later step: train an orchestrator model.** `titan` writes each run's choices and rewards as _traces_. Someone can train an open-weight orchestrator model on them outside `titan`, as Agent Lightning separates training from running. The trained model can run on a RunPod endpoint (section 6). It then enters `titan` as a persona on trial, and it must do better than the built-in policy, by the persona rules in `research/hive.md`.

## 6. Where agents can run on RunPod serverless

**Evidence**

> [O15] "executionTimeout Maximum time a job can run while being processed 600000 (10 minutes) Min 5 sec, max 7 days"

> [O15] "ttl Total lifespan of the job before deletion 86400000 (24 hours) Min 10 sec, max 7 days"

> [O15] "/cancel POST Stop a job in progress or waiting in the queue."

> [O16] "Asynchronous jobs process in the background and return immediately with a job ID."

> [O18] "vLLM workers implement OpenAI API compatibility, so you can use OpenAI client libraries with your deployed models."

> [O18] "Function/tool calling depends on model and vLLM support."

> [O19] "Serverless billing follows worker time, not request outcomes."

> [O14] "Execution timeout 600s (10 min) Max job duration Job TTL 24h Total job lifespan in system"

**Candidates**

| Place                                                        | What runs on RunPod                                                                                       | Kept?                                                             |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Model endpoint                                               | Only the model, served by a vLLM worker. The agent's turn runs in `titan`, through the model API adapter. | Yes, as backend `runpod-vllm`                                     |
| Agent worker                                                 | A whole persona session, in a container with a `titan worker` handler. One RunPod job is one agent turn.  | Yes, as backend `runpod-worker`                                   |
| Trained orchestrator                                         | An open-weight orchestrator model, served like a model endpoint                                           | Yes, as an optional later step                                    |
| RunPod's public endpoints, through `@runpod/ai-sdk-provider` | Models that RunPod hosts for everyone                                                                     | Not now. That package targets public endpoints, not private ones. |

Both backends come in one plug-in package, through the backend port in `research/patterns.md`. Another serverless GPU host can be added the same way.

**Test: 1 hour for each run** (`probes/runpod/`)

> [probe:runpod/test-output.txt] "PASS a 2-hour job ends by the deadline: status timed_out after 59.5 min"

> [probe:runpod/test-output.txt] "PASS open jobs are cancelled at the deadline: titan: timed_out, timed_out; cancel calls with the status before: job-1 IN_QUEUE; job-2 IN_PROGRESS"

> [probe:runpod/test-output.txt] "PASS no job is sent with under 10 s left: status timed_out, 0 jobs sent"

> [probe:runpod/test-output.txt] "PASS a 90-minute limit is refused: limits.max_minutes is 90, but a run that uses RunPod may last at most 60 minutes"

> [probe:runpod/test-output.txt] "6 passed, 0 failed"

Control runs, with the deadline turned off:

> [probe:runpod/test-output.txt] "CONTROL no deadline, 3-hour timeout sent: status COMPLETED after 120.1 min"

> [probe:runpod/tsc-output.txt] "tsc exit 0"

The first try failed. With the `ttl` equal to the time left, RunPod removed the jobs at the deadline before `titan` could cancel them. So `titan` cancels its jobs 30 s before the deadline, and keeps the `ttl` as a second guard. The 30 s is a guess that has not been measured.

**Pick**

- A run that uses RunPod has a time limit of at most 60 minutes, counted from the start of the run.
- Each job gets an `executionTimeout` and a `ttl` no longer than the time left in the run.
- `titan` cancels every open job 30 s before the deadline.
- A run on RunPod costs money while a worker runs, whether the job succeeds or not. So the person approves it once for each run, and sees the most worker time it can use.

## 7. What was not tested

- No live RunPod endpoint was called, because `RUNPOD_API_KEY` was not set. The fake endpoint follows the docs, which may differ from the real service.
- RunPod's docs do not say whether a worker stops when the `ttl` removes its job.
- Tool calls on a RunPod vLLM endpoint depend on the model. No model was tried.
- The orchestration test is a toy with independent parts. Real goals have parts that depend on each other.
- No orchestrator model was trained.
- All weights, fades, floors and alarm numbers are guesses that have not been measured.
- It is not known whether the hour should also count time spent waiting for a person's answer. This design counts it, as the strict reading of "maximum 1 hour per workflow".
