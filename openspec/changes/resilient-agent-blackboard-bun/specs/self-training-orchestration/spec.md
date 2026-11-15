## ADDED Requirements

### Requirement: titan keeps a policy for each kind of goal

`titan` SHALL keep a _policy_ for each kind of goal in `~/.titan/policy/<kind>.json`. A policy is the set of choices `titan` makes for that kind of goal, with the counts behind each choice. The kind MUST come from the tags that the main agent sets in `policy.kind` in the workflow file. When the file sets no kind, `titan` MUST use the kind of the nearest earlier goal from a knowledge hub search, or `general`.

#### Scenario: Kind from the workflow file

- **WHEN** a workflow file has `policy: { kind: code-fix }` and the run ends
- **THEN** `~/.titan/policy/code-fix.json` holds that run's choices and reward

### Requirement: A reward for each run

After each run, `titan` SHALL compute a _reward_: the number that says how good the run was. The reward MUST be: the share of results that survived, minus `w_time` × the time on the critical path in minutes, minus `w_agent` × the number of agents started. The _critical path_ is the longest execution chain under the dependency and resource-order rules below. When the person gave a verdict on the result, the share of results that survived MUST be replaced by 1 for a yes and 0 for a no. The default weights MUST be `w_time` 0.05 and `w_agent` 0.01. They are guesses from the test in `research/orchestration.md`, not measured on real runs.

#### Scenario: Reward in the run record

- **WHEN** a run ends with 4 of 5 results survived, a critical path of 2 minutes and 6 agents started
- **THEN** the run record holds `reward: 0.64`, because 0.8 − 0.05 × 2 − 0.01 × 6 = 0.64

The survival share MUST be 0 when the run produced no results. A waiting run MUST NOT update policy counts. Each learning-eligible terminal run MUST update counts once, keyed by run id, even after server restart. Infrastructure-only outcomes MUST follow the eligibility rule below.

#### Scenario: Empty run has a finite reward

- **WHEN** a run fails before producing any result, with no elapsed critical-path time and no agent starts
- **THEN** its reward is 0 and no division by zero occurs

#### Scenario: Restart cannot learn twice from one run

- **WHEN** a terminal run already updated its policy and the server restarts
- **THEN** its counts and trails are unchanged by replay

### Requirement: The person sets the price of time and of agents

The person SHALL set `w_time` and `w_agent` in `~/.titan/config.yaml`. A workflow file MUST NOT set them. In the test, a large `w_agent` made the hive use too few agents, so this choice is the person's.

#### Scenario: Weights in the workflow file

- **WHEN** a workflow file has `policy: { w_agent: 0 }`
- **THEN** `titan check` fails with the text `only the person sets w_agent, in ~/.titan/config.yaml`

### Requirement: The policy learns the split width

For a step with `split` and no `width` in the file, `titan` SHALL pick the width from 1, 2, 4 or 8 with the policy. After each run, `titan` MUST compare its score with the mean score of up to the last 4 earlier runs of the same kind. This uses a group-relative comparison inspired by GRPO (Group Relative Policy Optimization), with the explicit update rule below. It MUST raise the chance of the chosen width when its comparison score was above that mean, and lower it when it was below. The group of 4 is a guess that has not been measured.

#### Scenario: Width that does better is picked more

- **WHEN** a test with the fake adapter and a fixed seed runs 200 runs of goals with 8 parts, where each part takes the same time and every part survives
- **THEN** in the last 50 runs, the width 1 is picked in fewer than 10 % of runs

### Requirement: An alarm for serial collapse

_Serial collapse_ is when the policy learns to run everything with one agent, even when it could run several. `titan` SHALL count, in the last 20 runs of each kind, the split steps with 4 or more parts that ran with width 1. When they are more than half of those steps, `titan` MUST add the bounded comparison bonus below for widths above 1 for that kind. It MUST lower the bonus to 0 over the next 20 runs, and tell the main agent on the board. The numbers 20 and half are guesses that have not been measured.

#### Scenario: Policy collapsed to one agent

- **WHEN** 12 of the last 20 runs of kind `code-fix` ran their 4-part splits with width 1
- **THEN** the board of the next run has a line with `"kind":"alarm"` and `serial collapse`
- **AND** the policy for `code-fix` shows the bonus and the run at which it reaches 0

### Requirement: An alarm for empty agents

_Empty agents_ are agents that the policy starts with no part of the work. `titan` SHALL count the agents started in the last 20 runs of a kind that had no part. When they are more than 10 %, `titan` MUST apply an effective agent-cost multiplier of 2 for that kind and tell the main agent on the board. It MUST NOT change the person's configured `w_agent`. The multiplier MUST stay at 2 while the alarm is active, rather than doubling again after each run. It MUST return to 1 when the window no longer triggers the alarm. The 10 % and the multiplier are guesses that have not been measured.

#### Scenario: Too many agents for the parts

- **WHEN** the last 20 runs of kind `research` started 100 split agents and 15 of them had no part
- **THEN** the board of the next run has a line with `"kind":"alarm"` and `empty agents`
- **AND** the policy for `research` shows the configured `w_agent` and its effective multiplier of 2

### Requirement: Choices that worked leave trails that fade

`titan` SHALL keep a _trail_ for each choice of a policy: a count of the rewards above and below the group mean. Once per new learning-eligible terminal run, `titan` MUST multiply every trail of that kind by 0.98, as in the update rule below. This is how a choice that stops working loses its pull. The 0.98 is a guess that has not been measured.

#### Scenario: Trail fades

- **WHEN** a trail has the count 10 and a new run of the same kind ends with a different choice
- **THEN** that trail has the count 9.8

### Requirement: Good plans are offered to the main agent

`titan` SHALL keep the plan of each run, with its reward, as an entry of kind `plan` in the knowledge hub. `titan plans <kind>` MUST print the 3 plans of that kind with the highest rewards. The guide MUST tell the main agent to run it before it writes a workflow file.

#### Scenario: Plans before a new design

- **WHEN** 5 runs of kind `code-fix` are kept with rewards 0.2, 0.7, 0.5, 0.9 and 0.4
- **THEN** `titan plans code-fix` prints the plans with rewards 0.9, 0.7 and 0.5, in that order

### Requirement: The learned policy stays inside the rules

The policy SHALL choose only among options that pass `titan check`, the limits and the approvals. It MUST NOT remove a falsifier, go over a limit, or change an approval level.

#### Scenario: Policy cannot go over the parallel limit

- **WHEN** the policy for a kind prefers width 8 and the run has `limits.max_parallel: 4`
- **THEN** no more than 4 agents run at the same time for that split step

### Requirement: The policy can be read and explained

`titan policy show <kind>` SHALL print each choice with its chance, its trail, the last 4 rewards, and any alarm that is on.

#### Scenario: Show a policy

- **WHEN** `titan policy show code-fix --json` runs
- **THEN** the output holds the widths 1, 2, 4 and 8, each with its chance and trail

### Requirement: Traces can be written for training a model elsewhere

`titan traces export <kind> <file>` SHALL write each run's choices, the board state when each choice was made, and the reward, one JSON line per choice. `titan` MUST NOT train model weights itself. A model trained elsewhere on these traces MUST enter `titan` as a persona in state `trial`, as in spec persona-lifecycle.

#### Scenario: Export traces

- **WHEN** 3 runs of kind `code-fix` made 7 choices in total and `titan traces export code-fix out.jsonl` runs
- **THEN** `out.jsonl` has 7 lines, each with the choice, the board state and the reward
- **AND** no line holds an API key

### Requirement: The reward counts proofs

This requirement covers runs with proof checks, as in spec verified-checks. In the reward, a result with checks SHALL count as survived only when every check gave `proven` and every falsifier said `survived`. The run record and the policy MUST also hold the _proven share_: N divided by M from the summary in spec verified-checks, including final goal checks. Attempt-check totals MUST be reported separately. `titan policy show` MUST print the proven share next to each choice. When a run has no checks, the proven share MUST be shown as "no checks", not as 0 or 1.

#### Scenario: Reward with a check that is not proven

- **WHEN** a run ends with 5 results: 3 survived, 1 was refuted by a falsifier, and 1 got a completed semantic `not proven` rejection from its check; the critical path is 2 minutes and 6 agents started
- **THEN** the run record holds `reward: 0.44`, because 0.6 − 0.05 × 2 − 0.01 × 6 = 0.44

#### Scenario: A run without checks

- **WHEN** a run has no `verify` entries
- **THEN** `titan policy show` prints "no checks" as its proven share

### Requirement: Learning uses a defined update and one owner

For each kind and eligible width, `titan` SHALL keep positive and negative trails starting at 0. A width MUST be eligible only when it fits the part count, run limit and configured server and backend caps. Momentary capacity used by other runs MUST queue work rather than change the recorded choice. A zero-part split MUST make no policy choice. It MUST draw from `Beta(1 + positive, 1 + negative)` and pick the largest draw, with smaller width winning a tie. With no earlier reward, the first run MUST create history without updating a trail. Later runs MUST compare their score with the mean score of up to the last 4 earlier learning-eligible terminal runs, excluding themselves. Every trail MUST fade by 0.98 once per learning-eligible terminal run. The comparison score MUST equal base reward, minus the extra agent penalty from the effective multiplier, plus the active width bonus. Compare it with the mean of earlier comparison scores recorded under their then-effective settings. An above-mean comparison score MUST add 1 to the chosen positive trail; a below-mean comparison score MUST add 1 to its negative trail. Equality MUST add neither. The server writer MUST serialize updates and record the seed, comparison mean and update id. These priors and increments are design guesses awaiting the benchmark.

#### Scenario: First policy result

- **WHEN** a kind has no earlier rewards and its first run finishes
- **THEN** the reward is saved and all width trails remain 0

#### Scenario: Concurrent policy updates

- **WHEN** two runs of one kind finish together
- **THEN** their updates get a durable order and each run contributes once

### Requirement: Reward measurements have one denominator

The survival share SHALL count every completed worker candidate attempt once, including split parts and losing survivors. Helpers, judges and improvers MUST NOT inflate that denominator. A final goal failure MUST force the run's survival term to 0. The critical-path duration MUST sum active execution time along the longest dependency chain, including retries and checks. It MUST include resource-order edges when limited places serialize independent parts. It MUST exclude time waiting for human or main-agent answers. The run record MUST also report total wall time and waiting time separately. A person's verdict MUST be part of terminalization; a later verdict MUST become feedback for a new evaluation, not rewrite a learned reward.

#### Scenario: Goal fails despite surviving steps

- **WHEN** all worker results survive but a final goal check fails
- **THEN** the reward's survival term is 0 and the failed goal check stays in the summary

### Requirement: Alarm adjustments are explicit and bounded

The serial-collapse alarm SHALL use only splits with at least 4 parts whose run, configured server and backend limits allowed width above 1. Its bonus MUST start at 0.1 and fall linearly to 0 across the next 20 learning-eligible terminal runs. This number is a design guess. It MUST affect only the width learner's comparison score for widths above 1. The recorded base reward MUST remain unchanged. Empty-agent multipliers MUST affect that score's agent penalty, not rewrite the base reward. A new alarm MUST NOT stack another bonus while one is active. The empty-agent share MUST be 0 when the window has no split workers.

#### Scenario: Parallel limit prevents width above one

- **WHEN** every 4-part split in the window was limited to `max_parallel: 1`
- **THEN** no serial-collapse alarm fires

### Requirement: Incomplete runs are ineligible for quality learning

Learning SHALL exclude operationally incomplete outcomes from quality updates, comparison baselines and plan promotion. Recovery time and cost MUST remain in run accounting and separate infrastructure reports. A completed resumed result MUST contribute once. An infrastructure-only terminal run MAY retain numeric reward zero for accounting, but MUST carry `learning_eligible: false` and its reason. Empty-run numeric rules MUST NOT manufacture training examples. Improvement comparisons MUST report interrupted evaluations as incomplete, never better or worse results.

#### Scenario: Provider outage cannot teach poor quality

- **WHEN** all worker starts end in operational failures without a completed verdict
- **THEN** the record includes costs and learning_eligible false; no persona, width or plan reward update occurs

#### Scenario: Recovered result updates once

- **WHEN** several execution segments produce one completed verdict and the daemon restarts after terminal accounting
- **THEN** the result contributes one quality observation with the full recorded cost
