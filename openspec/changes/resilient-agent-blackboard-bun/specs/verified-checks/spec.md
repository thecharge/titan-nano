## ADDED Requirements

### Requirement: A goal or a step can have proof checks

The workflow file SHALL accept a top-level `verify` list for the goal and a `verify` list on each step. Each entry is a _proof check_: a program that gives a fixed answer, with no model. Each entry MUST have a `kind`: `lean`, `smt` or `script`. A step's checks MUST run on each candidate result, after its `do` part and before its falsifiers. The goal's checks MUST run on the final result, after the last step. Their failure MUST follow the goal-failure rule in spec workflow-run. A proof check counts as a falsifier, so a step that has only proof checks still meets the rule of spec step-falsification.

#### Scenario: A step with a Lean check

- **WHEN** a step has `verify: [{ kind: lean, statement: proofs/sum.lean, theorems: [sumTo_formula] }]` and no other falsifier
- **THEN** `titan check` accepts the file
- **AND** the run checks each candidate with `lake comparator` before the step can pass

#### Scenario: A check of an unknown kind

- **WHEN** a `verify` entry has `kind: coq`
- **THEN** `titan check` fails at the path of that entry with the text `kind must be lean, smt or script`

### Requirement: Each check answers proven, refuted or not proven

Each proof check SHALL give one of three answers:

- `proven`: the checker accepted the proof, or the script ended with exit code 0;
- `refuted`: the checker found that the claim is false, and `titan` saved the counterexample;
- `not proven`: anything else, such as an error, a time limit, a cheat that the checker found, or an answer that `titan` cannot read.

A result MUST survive only when every check gives `proven` with a completed execution state. Proof observations and execution states MUST be separate fields. A normally completed solver `unknown` MUST be a semantic `not proven`; tool timeouts, launch errors and signals MUST recover instead. A completed semantic rejection MUST reject the result with its evidence, as in spec step-falsification. Operational errors and interruptions MUST keep a separate execution state and MUST NOT count as result refutations. An interrupted observation MAY say `not proven`, but MUST NOT advance the result attempt or declare the claim false. A time limit MUST never count as `proven`.

#### Scenario: Not proven gives a new attempt

- **WHEN** a Lean check ends with "error: Illegal axiom detected: 'sorryAx'"
- **THEN** the check answer is `not proven`
- **AND** the next attempt's task holds that error text

### Requirement: Lean checks use lake comparator

A `lean` check SHALL run `lake comparator` of Lean 4.35.0 or later. It MUST NOT treat a plain build, `lean <file>` or `lake check` as a proof. `titan` MUST write `comparator.json` from the entry. The challenge module is the locked statement, and the solution module is the agent's file. The file also names the theorems and the permitted axioms `propext`, `Quot.sound` and `Classical.choice`. The entry MAY add `paranoid: true`, and then `titan` MUST add `--paranoid`. `titan` MUST pin the Lean version in `lean-toolchain` for each check. Exit code 0 with "Your solution is okay!" MUST give `proven`. Any other end MUST give `not proven`.

#### Scenario: The five cheats of the probe

- **WHEN** an agent hands in a solution with `sorry`, a weakened statement, a changed definition, an extra axiom, or `native_decide`
- **THEN** each one gets the answer `not proven`
- **AND** the evidence holds the comparator's error line, such as "Challenge and solution theorem statement do not match: 'sumTo_formula'"

#### Scenario: A real proof

- **WHEN** an agent hands in a solution that proves `sumTo_formula` and `sumTo_100` with the locked definitions
- **THEN** the check answer is `proven`

### Requirement: Lean checks run sealed off

`titan` SHALL run every `lean` check on Linux, where Lake's bubblewrap sandbox works. The check MUST run as a user that is not root, and with no network after the Lean toolchain and the locked imports are in place. The check MUST build the locked statement and its recorded imports in a fresh folder. It MUST NOT load candidate-controlled Lake configuration, plug-ins or toolchain overrides. The agent MUST supply only its solution module and declared data files. `titan` MUST stop a check after `timeout_s` seconds, with the answer `not proven`. The default `timeout_s` MUST be 300. Every check MUST also fit the remaining run deadline. The 300 is a guess that has not been measured. On another system, `titan check` MUST fail for a `lean` check with the text `lean checks need Linux`.

#### Scenario: Lean check on macOS

- **WHEN** a workflow with a `lean` check is checked on macOS
- **THEN** `titan check` fails with the text `lean checks need Linux`

#### Scenario: A check that runs too long

- **WHEN** a `lean` check with `timeout_s: 5` is still running after 5 s
- **THEN** `titan` stops it and the answer is `not proven`, with the evidence `time limit of 5 s reached`

### Requirement: SMT checks read the answer word of z3

An `smt` check SHALL run the `z3` program as a separate process, not inside the `titan` process. It MUST pass `-T:<timeout_s>`, with a default of 30 s. The 30 s is a guess that has not been measured. The locked file MUST hold the opposite of the claim. `titan` MUST read the first word of the output and MUST NOT use the exit code:

- `unsat` gives `proven`;
- `sat` gives `refuted`, and `titan` MUST save the model that follows as the counterexample;
- `timeout`, `unknown` and anything else give `not proven`.

The agent's output MUST enter the check only as values that `titan` writes with `define-fun`. `titan` MUST NOT paste agent text into the SMT file as assertions.

#### Scenario: Three answers with exit code 0

- **WHEN** z3 answers `unsat`, then `sat` with `(define-fun x () Int 1)`, then `timeout`, each with exit code 0
- **THEN** the answers are `proven`, `refuted` with the counterexample x = 1, and `not proven`

#### Scenario: An agent tries to add an assertion

- **WHEN** a step output for an `smt` check holds the text `(assert false)`
- **THEN** `titan` writes it only as a string value with `define-fun`, and the check is not `proven` because of it

### Requirement: SMT checks find assumptions that contradict

Before an `smt` check, `titan` SHALL run z3 on the locked file without the opposite of the claim. The locked file MUST mark the opposite of the claim with the comment `; claim`. When z3 answers `unsat` without it, the assumptions contradict each other. The check MUST then give `not proven` with the evidence `the assumptions contradict each other`, because such a file proves anything.

#### Scenario: Contradicting assumptions

- **WHEN** a locked SMT file holds `(assert (> x 1))` and `(assert (< x 0))` before the line `; claim`
- **THEN** the check answer is `not proven`, with the evidence `the assumptions contradict each other`

### Requirement: Script checks give a fixed answer

A `script` check SHALL run a shell command that the main agent wrote, in an isolated copy of the candidate files, or the assembled final files for a goal check. Exit code 0 MUST give `proven`. Any other exit code MUST give `not proven`. The output MUST be the evidence. The main agent MUST write `deterministic: true` on the entry, and the guide MUST say that a script check must give the same answer for the same files. `titan` MUST run the script twice on the first candidate of each run. When the two answers differ, the check MUST give `not proven` with the evidence `the script gave two different answers`.

#### Scenario: A script that changes its answer

- **WHEN** a script check exits with code 0 the first time and code 1 the second time on the same files
- **THEN** the check answer is `not proven`, with the evidence `the script gave two different answers`

### Requirement: The statement is locked before the work starts

Each `lean` and `smt` check SHALL name a locked statement file. The main agent MUST write it. Before the first attempt, `titan` MUST send a `lock_statement` request with the file's text, as in spec approvals. After approval, `titan` MUST copy the file to `locked/` in the run folder, and write its SHA-256 hash to the board. Before each check, `titan` MUST compare the file with that hash. When the hash differs, the check MUST give `not proven` with the evidence `the locked statement changed`. Agents MUST get the locked file only to read. A new statement needs a new `lock_statement` request, and any already-started work under the earlier statement MUST remain in the record. A changed statement after execution starts MUST use a new run, rather than reset an attempt allowance.

#### Scenario: The locked file is changed during a run

- **WHEN** a file in `locked/` is changed after its hash was written to the board
- **THEN** the next check of that statement gives `not proven` with the evidence `the locked statement changed`

#### Scenario: The statement waits for approval

- **WHEN** the `lock_statement` request of a step is still open
- **THEN** no agent of that step starts

### Requirement: Definitions are copied from the locked statement

The guide SHALL tell the main agent to put every definition that a theorem uses into the locked statement. It MUST tell the agent that writes the proof to copy these definitions exactly. In the probe, `lake comparator` rejected a definition that was equal but written another way. `titan` MUST add to the task of each Lean step the text `copy every definition from the locked statement exactly`.

#### Scenario: Task text of a Lean step

- **WHEN** a step with a `lean` check starts an agent
- **THEN** the task holds `copy every definition from the locked statement exactly` and the path of the locked file

### Requirement: The run record holds every check answer

`titan` SHALL write `proofs.json` in the run folder. It MUST hold one entry for each check that ran. Each entry names its scope, kind and the hash of the locked statement when one exists. Step checks MUST name their step, part, candidate and attempt. Goal checks MUST follow the goal identity below. It also names the checker and its version, the answer, the time in ms, and the path of the full output. `result.md` MUST show the line `proven N of M` for the run, where M counts checks on kept step results plus final goal checks, and N counts those that gave `proven`. Failed candidate checks MUST appear in separate attempt totals. Each entry MUST also name a check id, candidate id and result hash. Goal entries MUST use scope `goal` without a step or attempt. Script entries MUST use a null statement hash and hold the approved command hash. `GET /runs/<run id>` MUST hold the same counts.

#### Scenario: Counts in result.md

- **WHEN** kept step results have 3 proven checks and the completed final goal check rejects its result as `not proven`
- **THEN** `result.md` holds `proven 3 of 4`
- **AND** the run is `failed` and `proofs.json` holds every check, including discarded attempts

### Requirement: Anyone can check a proof again

`titan proof recheck <run id>` SHALL rerun the summary checks: kept step checks and final goal checks, from `proofs.json` and `locked/`. It MUST use saved result files, commands, imports and checker versions, checked against their recorded hashes. Missing or changed inputs MUST cause exit code 2 without executing a check. Recheck MUST use the original permission rules. It MUST write a separate recheck record and MUST NOT change the original verdicts, rewards or persona measures. It MUST print each check with its old and new answer. It MUST exit with code 1 when any answer differs.

#### Scenario: Recheck of a finished run

- **WHEN** a person runs `titan proof recheck <run id>` on a run with `proven 3 of 4`
- **THEN** it prints 4 checks with their old and new answers
- **AND** it exits with code 0 when all 4 answers are the same

### Requirement: Recheck detects changed evidence

Before a recheck executes, `titan` SHALL validate the saved inputs described above. A failed recheck MUST NOT silently replace the earlier result.

#### Scenario: Recheck input changed

- **WHEN** a kept candidate's saved proof file differs from its recorded hash
- **THEN** recheck exits with code 2 and names the changed file
- **AND** no checker starts and the original `proofs.json` stays unchanged

### Requirement: Script checks compare answers from the same files

The two first-candidate executions of each script check SHALL start in separate copies of the same candidate files. Each check, including a goal check, MUST get this repeat check once per run. Neither execution MUST modify the saved candidate. Matching exit codes MUST NOT be described as proof of determinism.

#### Scenario: First script execution edits a file

- **WHEN** a script creates `marker` in its first check folder
- **THEN** the second execution starts without `marker` and the saved candidate has no `marker`

### Requirement: SMT values have a declared shape

An SMT statement SHALL declare the names and sorts of the values it accepts. `titan` MUST parse and type-check each supplied value before writing `define-fun`. It MUST reject unknown names and raw SMT expressions. The assumptions-only check MUST return `sat` before the claim check runs. `unknown`, a timeout or malformed output MUST give `not proven`. The `; claim` marker MUST identify exactly one final assertion of the negated claim.

#### Scenario: Assumptions cannot be checked

- **WHEN** the assumptions-only z3 call answers `unknown`
- **THEN** the check gives `not proven` and no claim check runs

### Requirement: Proof inputs and checker availability are explicit

A Lean entry SHALL accept `solution`, a relative path in the candidate snapshot, defaulting to `Solution.lean`. A goal check MUST resolve that path in the assembled final snapshot. The file MUST exist before the checker starts. SMT `values` MUST map declared names to typed candidate output fields; a goal check MUST use the assembled output map. A script check MUST have a finite `timeout_s`, defaulting to 300 seconds, a design guess. `titan check` MUST reject missing checker programs or unsupported isolation before starting any agent. Goal statements MUST be approved before any worker starts, with scope `goal` in the request.

#### Scenario: Missing Lean solution

- **WHEN** a candidate has no file at its Lean entry's solution path
- **THEN** the check gives `not proven` with the missing path as evidence

#### Scenario: Goal statement waits for approval

- **WHEN** a top-level Lean statement has no approval
- **THEN** no worker starts and its lock request names scope `goal`

#### Scenario: Checker not installed

- **WHEN** a workflow needs an SMT check and the `z3` program is missing
- **THEN** `titan check` fails before starting any agent
