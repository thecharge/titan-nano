## ADDED Requirements

### Requirement: Every result is falsified before it counts

`titan` MUST run every configured falsifier on each completed candidate unless a preceding proof check already rejected it. A proof-only candidate MUST survive only when every proof check gives `proven`. To falsify means to try to prove the result wrong. A result SHALL survive only when every required check passes. An error, malformed answer or unavailable checker MUST NOT count as survival.

#### Scenario: All falsifiers fail to refute

- **WHEN** a step has one persona falsifier and one script falsifier, the persona answers `survived`, and the script exits with code 0
- **THEN** the result survives and the step is marked `passed`

#### Scenario: One falsifier refutes

- **WHEN** the persona falsifier answers `survived` and the script falsifier exits with code 1
- **THEN** the result is refuted
- **AND** the script's output is stored as the evidence

### Requirement: Falsifiers give a verdict with evidence

A persona falsifier MUST answer in this JSON form: `verdict`, which is `refuted` or `survived`, and `evidence`, which is text. `evidence` MUST NOT be empty when the verdict is `refuted`. A script falsifier refutes when its completed check exits normally with a nonzero code. Launch errors, signals and uncertain exits MUST follow operational recovery instead. Its standard output and standard error SHALL be the evidence.

#### Scenario: Refuted without evidence

- **WHEN** a persona falsifier answers `{"verdict":"refuted","evidence":""}`
- **THEN** the adapter treats the answer as not matching the schema and asks once more

### Requirement: Falsifiers do not see the worker's reasoning

A persona falsifier SHALL get the goal, the step's task, the result and its own falsify task. It MUST NOT get the worker agent's session or messages.

#### Scenario: Falsifier task content

- **WHEN** a falsifier runs
- **THEN** its task text in the run record holds the goal, the step task, the result and the falsify task, and nothing else from the worker

### Requirement: A refuted result is tried again with the evidence

When a result is refuted, `titan` SHALL run the step's `do` part again. It MUST add all evidence from the refutation to the new task. It MUST stop after `max_attempts` attempts. When all permitted completed result attempts are rejected, the step MUST be marked `failed`, with the last evidence. An unresolved interruption MUST block instead.

#### Scenario: Survives on the second attempt

- **WHEN** the first attempt is refuted with evidence "fails for an empty list" and the second attempt survives
- **THEN** the second task text contains "fails for an empty list"
- **AND** the step is `passed` with `attempts: 2`

#### Scenario: Never survives

- **WHEN** a step has `max_attempts: 3` and all three attempts are refuted
- **THEN** the step is `failed` with `attempts: 3`
- **AND** `result.md` shows the evidence of the third refutation

### Requirement: Several candidates compete and the best survivor wins

When a step has `candidates: N` with N greater than 1, `titan` SHALL make N results in parallel and falsify each one on its own. Each candidate gets its own attempts, up to `max_attempts`. When two or more survive, the step's judge persona MUST compare them two at a time. The winner of each pair goes on until one is left. Only a surviving candidate SHALL be judged or kept.

#### Scenario: Three candidates, two survive

- **WHEN** a step has `candidates: 3`, candidate 1 fails all attempts, and candidates 2 and 3 survive
- **THEN** the judge is called once, with candidates 2 and 3
- **AND** the kept result is the judge's choice
- **AND** the run record holds all three candidates, their verdicts and the judge's reason

#### Scenario: One candidate survives

- **WHEN** a step has `candidates: 3` and only candidate 2 survives
- **THEN** the judge is not called and candidate 2 is kept

#### Scenario: No candidate survives

- **WHEN** a step has `candidates: 3` and none survives
- **THEN** the step is `failed`

### Requirement: The judge answers with a choice and a reason

The judge persona MUST answer in this JSON form: `winner`, which is `A` or `B`, and `reason`, which is text that is not empty. Its task SHALL contain the goal, the step task, the judge text from the workflow file, and both candidates.

#### Scenario: Judge picks B

- **WHEN** the judge answers `{"winner":"B","reason":"same result with half the steps"}`
- **THEN** the second candidate of the pair goes on
- **AND** the reason is in the run record

### Requirement: A refutation can name its failure kind

A persona falsifier's answer SHALL accept an extra field `failure`, which names a _failure kind_: the way the result went wrong. Its value MUST be one of the 14 names from the MAST paper, as listed in `research/swarm.md`, or `other`. The names are: `disobey-task`, `disobey-role`, `step-repetition`, `lost-history`, `unaware-of-stop`, `conversation-reset`, `no-clarification`, `task-derailment`, `information-withholding`, `ignored-input`, `reasoning-action-mismatch`, `premature-termination`, `incomplete-verification` and `incorrect-verification`. `titan` MUST store the failure kind with the verdict. `result.md` MUST list how many refutations of the run had each failure kind. A failure kind is a hint from a model, and it MUST NOT change the verdict.

#### Scenario: Failure kinds in the result

- **WHEN** a run has two refutations with `failure: step-repetition` and one with `failure: incomplete-verification`
- **THEN** `result.md` lists `step-repetition: 2` and `incomplete-verification: 1`

#### Scenario: Unknown failure kind

- **WHEN** a persona falsifier answers `{"verdict":"refuted","evidence":"loops","failure":"bad-vibes"}`
- **THEN** the adapter treats the answer as not matching the schema and asks once more

### Requirement: Candidates can run on different backends

A step with `candidates: N` SHALL accept `candidate_backends`, a list of backend names. `titan` MUST run candidate number i on the backend at place i mod L of the list, where L is the length of the list and both count from 0. The run record MUST name the backend of each candidate. Without `candidate_backends`, every candidate MUST run on its persona's backend. Samples from one model share most of their mistakes, as in `research/swarm.md`, so this spreads the candidates over models. It is not a default, because mixing models did not help on every task in that research.

#### Scenario: Three candidates on two backends

- **WHEN** a step has `candidates: 3` and `candidate_backends: [claude-sdk, codex-sdk]`
- **THEN** candidates 0 and 2 run on `claude-sdk`, and candidate 1 runs on `codex-sdk`
- **AND** the run record names the backend of each candidate

### Requirement: Proof checks run before the falsifier agents

When a step has a `verify` list, `titan` SHALL run its proof checks on each candidate before any falsifier agent, as in spec verified-checks. A completed semantic rejection MUST reject the candidate before any falsifier agent starts. The `do` part MUST then run again with the evidence within `max_attempts`. An incomplete operational check MUST recover against the same candidate without advancing its result attempt.

#### Scenario: A failed proof saves the falsifier agent

- **WHEN** a step has a `lean` check and one persona falsifier, and the first candidate's completed comparator check rejects its proof as `not proven`
- **THEN** the falsifier agent does not start for that candidate
- **AND** attempt 2 starts with the comparator's error text in its task

### Requirement: Checker outages never become candidate refutations

Falsifiers, judges, proof tools and final goal checks SHALL use the same operational recovery rules as workers. A valid completed negative answer MUST remain a content rejection. A crash, unavailable tool or malformed checker protocol MUST remain incomplete and MUST NOT request a new worker result. Bounded protocol repair MUST use the same checkpoint and candidate. Completed Lean rejection, solver counterexamples and deterministic assertion failures MUST retain their existing semantics. An unclassified failure MUST block. A judge interruption MUST preserve every surviving candidate.

#### Scenario: Falsifier rate limit

- **WHEN** a saved candidate survives one falsifier and the second reaches a rate limit
- **THEN** only the second falsifier recovers and no new worker result attempt starts

#### Scenario: Proof process was killed

- **WHEN** a checker is killed or reaches its execution timeout without a completed semantic answer
- **THEN** its observation is not proven with interrupted execution state and the same candidate remains pending

#### Scenario: Completed counterexample still rejects

- **WHEN** a normally completed check provides a valid counterexample
- **THEN** the candidate is rejected with evidence and the next result attempt runs within max_attempts
