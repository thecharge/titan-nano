## ADDED Requirements

### Requirement: Every persona is saved in the register

`titan` SHALL keep each persona as one YAML file in `~/.titan/knowledge/persona/`. The folder `~/.titan` MUST change to the value of `TITAN_HOME` when that variable is set. A persona file MUST hold the name, description, tags, role text, tools, skills, model, backend, inputs, outputs, versions and history.

#### Scenario: New persona from a run

- **WHEN** a workflow file defines a new persona `fixer` and `titan run` starts
- **THEN** `~/.titan/knowledge/persona/fixer.yaml` exists with version 1
- **AND** the run record names `fixer@1`

#### Scenario: Other home folder

- **WHEN** `TITAN_HOME=/tmp/t` is set and a run registers `fixer`
- **THEN** `/tmp/t/knowledge/persona/fixer.yaml` exists
- **AND** nothing is written in `~/.titan`

### Requirement: The main agent searches the register first

`titan kb search --kind persona "<question>"` SHALL list matching personas. Each match MUST show name, latest version, description, state, and history: runs, results survived and results refuted. The states and the pick rule for open calls are in spec persona-lifecycle.

#### Scenario: Find a skeptic

- **WHEN** the register holds `skeptic@5` with description "Tries to prove a claim wrong" and the main agent runs `titan kb search --kind persona "prove a claim wrong" --json`
- **THEN** the first match is `skeptic` with version 5, its state and its history counts

### Requirement: A persona can be reused, mutated or created

A workflow file SHALL refer to a persona in one of three ways: `use: <name>@<version>`, `mutates: <name>@<version>` with changed fields, or a new persona. `titan` MUST save a mutated persona as the next version, with the version it came from. `titan` MUST NOT change a saved version.

#### Scenario: Mutate a judge

- **WHEN** the register has `judge@1` and `judge@2`, and a workflow file has `mutates: judge@1` with a new `role`
- **THEN** `titan` saves `judge@3` with `parent: judge@1` and the new role
- **AND** the files for `judge@1` and `judge@2` are unchanged

#### Scenario: Unknown version

- **WHEN** a workflow file has `use: skeptic@9` and the register has only versions 1 to 5
- **THEN** `titan check` fails with the text `persona "skeptic@9" is not in the register`

### Requirement: A persona's history is updated after each run

After each run, `titan` SHALL add to the history of each persona used: the run id, and how many of its results survived or were refuted. As a falsifier, it MUST record how many results it refuted. Interrupted execution segments MUST remain operational history, not quality outcomes, under spec persona-lifecycle.

#### Scenario: History after a run

- **WHEN** a run ends in which `investigator@2` made 3 candidates and 2 survived
- **THEN** the history of `investigator@2` has an entry with the run id, `survived: 2` and `refuted: 1`

### Requirement: Run history is replay-safe

Persona history SHALL key each result by run, step, part, candidate and attempt ids. Terminal replay MUST NOT add a result twice. Interrupted executions MUST retain usage but MUST NOT become survived results. A shared persona's next version MUST be allocated by the server writer. An initially declared persona MUST start as `proposed` and require the effective `new_persona` approval before it becomes `trial`.

#### Scenario: Two runs create a persona version

- **WHEN** two runs mutate `judge@1` at the same time
- **THEN** the server assigns two distinct new version numbers and overwrites neither version

#### Scenario: Replay does not increase persona uses

- **WHEN** a finished run's board is replayed twice
- **THEN** its persona uses, verdict counts and usage totals stay unchanged
