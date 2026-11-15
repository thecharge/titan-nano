## ADDED Requirements

### Requirement: The workflow file is YAML checked against a schema

`titan` SHALL read the workflow file as YAML and check it against one zod schema before it starts any agent. zod is a TypeScript library that checks data against a description of its shape. When the check fails, `titan` MUST exit with code 2. It MUST name each wrong field by its path and say what is wrong.

#### Scenario: Missing goal

- **WHEN** `titan run bad.yaml` reads a file without a `goal` field
- **THEN** `titan` exits with code 2
- **AND** the message contains `goal` and `Required`
- **AND** no agent was started

### Requirement: The file states the goal

The workflow file MUST have a `name` and a `goal`. The goal is plain text that says what problem to solve and what a good answer looks like.

#### Scenario: Goal reaches every agent

- **WHEN** a workflow with `goal: "Plan a move to Sofia for under 3000 EUR"` runs with the fake adapter
- **THEN** every task text in the run record contains that goal

### Requirement: The workflow file is written by the main agent

The main agent SHALL write the workflow file. The person MUST NOT need to write personas, steps or any part of the file. `titan` MUST accept a file that the main agent writes with no change by a person.

#### Scenario: Person only describes the problem

- **WHEN** the live main-agent test gives the main agent the problem "Plan a move to Sofia for under 3000 EUR" and no workflow file
- **THEN** the main agent writes a workflow file that passes `titan check`
- **AND** no file in the test was written by a person

### Requirement: The file defines the personas

The workflow file MUST have a `personas` map. Each entry SHALL be one of three forms:

- `use: <name>@<version>`: a persona from the register, used as it is;
- `mutates: <name>@<version>` with the changed fields: a new version of a registered persona;
- a new persona with `description`, `tags`, `role`, and optional `tools`, `skills`, `tool_servers`, `model`, `inputs` and `outputs`.

Each form MAY also set `backend`, as in spec backend-selection. `tool_servers` follows spec tool-servers. The file MAY have a `plugins` list of package names, as in spec backend-plugins.

Every persona name used in a step, a falsifier, a judge or `improve` MUST exist in this map.

#### Scenario: Unknown persona

- **WHEN** a step uses `persona: chemist` and the `personas` map has no `chemist`
- **THEN** the check fails with the path of that step and the text `unknown persona "chemist"`

### Requirement: Each step defines what to do

Each step MUST have a unique `id` and a `do` part. The `do` part SHALL be one of three forms:

- a persona with a `task`;
- a `script` with a shell command;
- an open call, `call: { tags, task }`, as in spec hive-collaboration.

A step MAY also have `split`, as in spec hive-collaboration.

#### Scenario: Open call and split

- **WHEN** a step has `do: { call: { tags: [code], task: "Fix one file" } }` and `split: { parts: plan.files }`
- **THEN** the check passes

#### Scenario: Script step

- **WHEN** a step has `do: { script: "bun test" }`
- **THEN** `titan` runs `bun test` in the step's working folder and stores its output and exit code in the run record

#### Scenario: Two steps with the same id

- **WHEN** two steps both have `id: plan`
- **THEN** the check fails and names both paths

### Requirement: Each step defines how to falsify it

Each step MUST have at least one entry across `falsify` and `verify`. Either list MAY be absent or empty when the other has an entry. Each `falsify` entry SHALL be a persona with a `task`, or a `script` with a shell command. A persona falsifier MUST differ from the resolved worker version.

The check MUST compare resolved persona versions, not only local names. Open calls MUST exclude their falsifier's resolved version at selection time. Work counts and split widths MUST be finite positive integers. Recovery retry counts MUST be finite non-negative integers; zero MUST disable automatic retries. `max_minutes` MUST be finite and positive; `improve.rounds` MUST be a non-negative integer. `candidate_backends` MUST be non-empty when present, and every listed backend MUST pass that persona's capability checks.

#### Scenario: Aliases cannot falsify the same persona

- **WHEN** worker `fixer` and falsifier `reviewer` both resolve to `coder@2`
- **THEN** the check fails with `a step cannot be falsified by its own persona`

#### Scenario: Invalid limits fail before work starts

- **WHEN** a workflow has `max_attempts: 0`, `candidates: -1` or `split.width: 1.5`
- **THEN** the check fails at each invalid path before any program starts

#### Scenario: Empty candidate backend list

- **WHEN** a step has `candidate_backends: []`
- **THEN** the check fails at that list's path

#### Scenario: Worker checks itself

- **WHEN** a step has `do: { persona: fixer, ... }` and `falsify: [{ persona: fixer, ... }]`
- **THEN** the check fails with the text `a step cannot be falsified by its own persona`

#### Scenario: Step without falsification

- **WHEN** a step has no entries in either `falsify` or `verify`
- **THEN** the check fails with the path of that step and the text `every step needs at least one falsifier`

### Requirement: The file states which steps run in parallel and which in sequence

In the `steps` shorthand, steps SHALL sit in groups. A group is either `sequential` or `parallel`. A group MAY contain steps and other groups. The top-level `steps` list MUST run as a sequential group.

#### Scenario: Nested groups

- **WHEN** a file has a sequential group with step `a`, then a parallel group with steps `b` and `c`, then step `d`
- **THEN** the check passes
- **AND** `titan run --dry-run` prints the order `a`, then `b` and `c` together, then `d`

### Requirement: Steps name the earlier outputs they need

A step MAY have an `inputs` map from each input of its persona to an output of an earlier step, written `<step id>.<output name>`. Each named step MUST finish before this step in every possible group order, or be a transitive dependency in graph mode. The format of the output MUST match the format of the input.

#### Scenario: Input from a step in the same parallel group

- **WHEN** step `c` has `inputs: { plan: b.plan }` and `b` and `c` are in the same parallel group
- **THEN** the check fails with the text `c uses b, but b may not be finished before c starts`

#### Scenario: Formats do not match

- **WHEN** step `fix` maps input `cause` (a string) to `cause.root_cause`, and that output is a list
- **THEN** the check fails and names both the input and the output with their formats

### Requirement: The file sets limits on the work

The workflow file SHALL accept these limits for each step: `max_attempts` (default 3) and `candidates` (default 1). It SHALL accept `improve.rounds` (default 0) for the loop. It SHALL accept these limits for the whole run, under `limits`:

- `max_steps` (default 50) and `max_parallel` (default 4), as in spec hive-collaboration;
- `max_minutes`, the most time the run may take, counted on the clock from its start. There is no default, except for a run with RunPod personas, as in spec runpod-backends.

The defaults are choices made for this design, not measured values.

#### Scenario: Run limits in the file

- **WHEN** a file has `limits: { max_steps: 20, max_parallel: 2, max_minutes: 30 }`
- **THEN** the check passes
- **AND** the run record shows those three limits

#### Scenario: Defaults apply

- **WHEN** a step sets neither `max_attempts` nor `candidates`
- **THEN** the run record shows `max_attempts: 3` and `candidates: 1` for that step

### Requirement: The file is the starting plan

The workflow file SHALL hold the plan that the main agent writes before the run. Agents MAY add steps during the run, as in spec hive-collaboration. `titan` MUST keep the main agent's file as it was, and MUST write the full plan at the end of the run to `plan.yaml` in the run record.

#### Scenario: Plan after added steps

- **WHEN** a file has 2 steps and an agent adds 1 step during the run
- **THEN** `plan.yaml` in the run record has 3 steps
- **AND** `workflow.yaml` in the run record has 2 steps

### Requirement: The file can name its kind of goal and raise approval levels

The workflow file MAY have `policy: { kind: <tag> }`, as in spec self-training-orchestration, and an `approvals` map that raises levels, as in spec approvals. The check MUST fail for any other field under `policy`, and name its path. For `w_time` and `w_agent`, the message MUST say that only the person sets them, as in spec self-training-orchestration.

#### Scenario: Unknown policy field

- **WHEN** a file has `policy: { kind: code-fix, speed: high }`
- **THEN** the check fails with the path `policy.speed`

### Requirement: A step with several candidates names a judge

A step with `candidates` greater than 1 MUST name a `judge` persona.

#### Scenario: Candidates without a judge

- **WHEN** a step has `candidates: 3` and no `judge`
- **THEN** the check fails with the path of that step and the text `candidates > 1 needs a judge`

### Requirement: Example files cover different kinds of problems

The repository SHALL ship four example workflow files in `examples/`. They are a code fix, a check of a science claim, a business plan and an everyday problem. Each MUST pass the schema check and run end to end with the fake adapter.

#### Scenario: All examples pass the check

- **WHEN** `titan check examples/*.yaml` runs
- **THEN** it prints `ok` for each of the four files and exits with code 0

#### Scenario: Batch check keeps ordered plans

- **WHEN** the shell expands multiple example paths for a JSON check
- **THEN** one response contains schema_version 1, ok and an ordered workflows array with each path, revision, nodes and resolved configuration
- **AND** checking a single file retains its existing JSON shape
- **AND** checking creates no server or run and changes no workflow file

#### Scenario: A later invalid file fails the batch

- **WHEN** a check receives a valid file followed by an invalid or missing file
- **THEN** it exits 2 and identifies the failing path
- **AND** JSON mode emits one error object with no partial success response
- **AND** human mode retains ok lines for preceding valid files

#### Scenario: Batch validation stays bounded

- **WHEN** a check receives an empty path, more than 256 paths or combined JSON plans larger than 1 MiB
- **THEN** it fails with invalid input and creates no run or server
- **AND** positional validation happens before loading any workflow

### Requirement: The file can set proof checks on the goal and on steps

The schema SHALL accept a `verify` list at the top level, for the goal, and on each step. Each entry MUST have `kind` (`lean`, `smt` or `script`). A `lean` entry MUST have `statement` (the path of the locked file) and `theorems` (a non-empty list of names), and MAY have `solution`, `paranoid` and `timeout_s`. An `smt` entry MUST have `statement` and MAY have `values` and `timeout_s`. A `script` entry MUST have `run` and `deterministic: true`, and MAY have `timeout_s`. Every check timeout MUST be finite and positive. The rules for each kind are in spec verified-checks.

#### Scenario: A Lean entry without theorems

- **WHEN** a step has `verify: [{ kind: lean, statement: proofs/sum.lean }]`
- **THEN** `titan check` fails at the path of that entry with the text `theorems must name at least one theorem`

#### Scenario: A goal check

- **WHEN** a file has a top-level `verify: [{ kind: script, run: "bun test", deterministic: true }]`
- **THEN** `titan check` accepts it, and `titan run --dry-run` lists the check after the last step

### Requirement: Names and paths stay within their stores

Step ids, persona names and policy kinds SHALL be single path components. They MUST NOT contain path separators, `..` or control characters. A statement path MUST resolve inside the recorded project folder. A symlink MUST NOT escape that folder. Unknown workflow fields MUST fail validation rather than be ignored.

#### Scenario: Step id escapes the run folder

- **WHEN** a step has `id: ../outside`
- **THEN** `titan check` fails at that id before creating a run folder

#### Scenario: Statement symlink escapes the project

- **WHEN** a statement path is a symlink to a file outside the project folder
- **THEN** `titan check` refuses it before reading its text

#### Scenario: Misspelled field

- **WHEN** a step sets `max_atempts: 3`
- **THEN** `titan check` fails at `max_atempts` as an unknown field

### Requirement: Groups and dependency graphs describe the same execution plan

A workflow SHALL contain exactly one of `steps` or `graph.nodes`. Existing groups MUST retain their ordering and same-parallel-group input restrictions. Graph nodes MUST use the same step schema plus an explicit `needs` list. Each input producer MUST be a transitive dependency. Validation MUST reject cycles, duplicate ids, missing dependencies and ambiguous scheduling forms. Array order in a graph MUST control presentation only. Groups MUST compile to equivalent dependency edges. Runtime additions MUST pass the same checks before admission.

#### Scenario: Mixed dependency graph

- **WHEN** a plan uses A, then B and C, then D depending on B, and E depending on C and D
- **THEN** validation accepts it and dry-run shows every edge without forcing C to finish before D starts

#### Scenario: Dependency cycle before work

- **WHEN** A needs B and B needs A
- **THEN** validation names the cycle and starts no agent

#### Scenario: Input without a dependency

- **WHEN** graph node D reads B.output without depending on B
- **THEN** validation rejects D.inputs with the missing dependency

#### Scenario: Two scheduling forms

- **WHEN** a workflow supplies both steps and graph.nodes
- **THEN** validation rejects the file before execution
