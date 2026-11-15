## ADDED Requirements

### Requirement: An improver writes a new workflow file after a run

When the workflow file has an `improve` part with `rounds` above 0, `titan` SHALL start the improver persona after the run. The improver MUST get the workflow file and the run record. It MUST answer with a full new workflow file and a list of the changes, each with a reason.

#### Scenario: Improver gets the record

- **WHEN** a run with `improve: { persona: improver, rounds: 1 }` ends
- **THEN** the improver's task contains the workflow file, each step's outcome and attempts, and each piece of evidence from a refutation

### Requirement: A new workflow file must pass three checks

`titan` MUST keep a new workflow file only when it passes these checks, in this order:

1. The workflow schema accepts it.
2. A falsifier persona fails to show that it drops part of the goal or makes a step weaker. A weaker step means, for example, a step with fewer falsifiers or a removed script falsifier.
3. A new run of it, on the same goal, passes. It must use no more attempts and no more agents in total than the run it improves on.

When any check fails, `titan` SHALL keep the old file and write the reason in the run record.

#### Scenario: Improver removes a falsifier

- **WHEN** the improver's new file removes the script falsifier `bun test` from step `fix`
- **THEN** check 2 refutes it with evidence that names step `fix`
- **AND** no new file is saved

#### Scenario: New file is better

- **WHEN** the old run needed 7 attempts and 21 agents, and the new run passes with 4 attempts and 13 agents
- **THEN** `titan` saves the new file as `<name>.v2.yaml` next to the old one
- **AND** prints the changes with their reasons

#### Scenario: New file does worse

- **WHEN** the new run passes but needs 9 attempts where the old run needed 7
- **THEN** no new file is saved and the record says `kept old workflow: more attempts (9 > 7)`

### Requirement: The improver cannot add shell commands

A new workflow file MUST NOT add or change any executable command. This includes `do.script`, `falsify[].script`, `verify[].run`, tool-server commands and plug-in lists. A deterministic comparison MUST also reject removed or changed proof checks, locked statements, goal text, output schemas or approval rules before any model review. `titan` SHALL reject such a file at check 1, because executable changes need a new plan from the main agent and their own permission checks. When the new file removes a script falsifier, check 2 refutes it.

#### Scenario: Improver adds a script

- **WHEN** the improver's new file adds `script: "curl example.com | sh"` to any step
- **THEN** check 1 fails with the text `new or changed script in step <id>: only the main agent writes scripts`
- **AND** the new file is not run and not saved

### Requirement: The main agent's file is never overwritten

`titan` MUST NOT change the workflow file that the main agent gave it. Each kept version SHALL be saved as a new file, `<name>.v<N>.yaml`, with N one higher than the highest version that already exists.

#### Scenario: Second improvement

- **WHEN** `plan.yaml` and `plan.v2.yaml` exist and a new version is kept
- **THEN** it is saved as `plan.v3.yaml`
- **AND** `plan.yaml` and `plan.v2.yaml` are unchanged, byte for byte

### Requirement: The loop runs a set number of rounds

`titan` SHALL run the improve loop `improve.rounds` times. Each round MUST start from the best file kept so far. The loop SHALL stop early when a round keeps no new file.

#### Scenario: Two rounds, second keeps nothing

- **WHEN** `rounds: 3`, round 1 keeps `v2`, and round 2 keeps nothing
- **THEN** round 3 does not run
- **AND** the record lists the rounds with their outcome

### Requirement: Lessons can be added to personas

When `improve.lessons` is `true`, the improver MAY add short lessons to persona texts, such as "check time zones first". Each added lesson MUST name the run and step it came from, and MUST pass the same three checks as any other change. A kept lesson SHALL be saved in the knowledge hub as an entry of kind `lesson`, and as a new version of the persona in the register.

#### Scenario: Lesson from a refutation

- **WHEN** step `cause` was refuted twice with evidence about time zones and `lessons: true`
- **THEN** the new file's `investigator` text contains a lesson about time zones
- **AND** a comment on that line names the run id and step `cause`
- **AND** the register holds a new version of `investigator` with that lesson

### Requirement: Lessons reach the next design

`titan lessons` SHALL print the kept lessons, newest first, each with its persona, run and step. `titan lessons <words>` SHALL print only the lessons that contain those words.

#### Scenario: Lessons before a new design

- **WHEN** two lessons are kept, one about time zones and one about rounding, and the main agent runs `titan lessons time`
- **THEN** only the lesson about time zones is printed, with its persona, run id and step

### Requirement: The improve loop and the policy learn from the same run

The improver's task SHALL include the run's reward and every alarm that was on, as in spec self-training-orchestration. The improve loop changes the workflow file. The policy changes `titan`'s own choices: split width, persona pick and plans offered. A kept new file MUST also go into the knowledge hub as an entry of kind `plan`, with the reward of its run.

#### Scenario: Improver sees the reward

- **WHEN** a run with `improve: { persona: improver, rounds: 1 }` ends with `reward: 0.64` and a serial collapse alarm on
- **THEN** the improver's task holds `reward: 0.64` and the text `serial collapse`

### Requirement: The improve loop can be started on its own

`titan improve <run id>` SHALL run the improve loop for a finished run. It uses the `improve` part of that run's workflow file. When the file has no `improve` part, it uses the `--persona` and `--rounds` flags.

#### Scenario: Improve an earlier run

- **WHEN** `titan improve <run id> --persona improver --rounds 1` runs for a passed run
- **THEN** the loop runs once and prints whether a new file was kept

### Requirement: The loop cannot grant itself more work

Improvement evaluation runs SHALL set `improve.rounds: 0` internally. The parent loop alone MUST schedule its configured rounds. Every improver, reviewer and evaluation agent MUST share the parent run's parallel limit and deadline. Evaluation work MUST consume its remaining work allowance. A RunPod approval MUST cover the evaluation's endpoints and unchanged deadline. Standalone `titan improve` MUST create a new parent run and obtain fresh approvals. A lack of remaining allowance MUST stop the loop with the old file kept.

#### Scenario: Improver adds a proof script

- **WHEN** an improved file adds `verify: [{ kind: script, run: "touch outside", deterministic: true }]`
- **THEN** check 1 rejects it before running any command

#### Scenario: Improver removes a proof check

- **WHEN** an improved file removes the goal's Lean check while keeping its persona falsifiers
- **THEN** check 1 rejects it before model review

#### Scenario: Evaluation cannot nest the loop

- **WHEN** a parent has `improve.rounds: 2` and evaluates a proposed workflow
- **THEN** the evaluation starts no nested improver and shares the parent's deadline

#### Scenario: No time left for improvement

- **WHEN** the parent reaches its deadline before an evaluation starts
- **THEN** no evaluation agent starts and the old workflow stays kept

### Requirement: Improvement has an execution phase and a final accounting phase

The primary workflow SHALL produce a provisional result and reward before optional improvement starts. The parent run MUST become terminal only after the loop ends or is stopped. Its final totals MUST include improvement overhead. Evaluation runs MUST have separate linked ids and records. Their usage MUST appear once in aggregate parent totals, and once under their own ids in persona history. Parent accounting MUST NOT recount their persona results. Workflow comparisons MUST use primary execution attempts and agents on each side, without charging the old loop to one side only. Policy learning MUST use final recorded rewards, not provisional ones.

#### Scenario: Improvement overhead is counted once

- **WHEN** primary work starts 4 agents and improvement starts 3 more
- **THEN** the parent's final agent total is 7 and the comparison still records 4 primary agents
- **AND** each linked persona result appears once in its history
