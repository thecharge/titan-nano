## ADDED Requirements

### Requirement: Detect the agent tool from the environment

`titan` SHALL find out which agent tool started it by reading its environment variables. An agent tool is Claude Code, Codex or Antigravity. The variable `CLAUDECODE` with the value `1` MUST mean Claude Code. The variables for Codex and Antigravity MUST be the ones recorded in the repository by a test that ran `env` inside each tool.

#### Scenario: Started from Claude Code

- **WHEN** `titan run example.yaml` runs with `CLAUDECODE=1` in its environment and no `--harness` flag
- **THEN** `titan` uses the Claude adapter
- **AND** the first line of the run record's `events.jsonl` has `"harness":"claude"` and `"detectedBy":"env:CLAUDECODE"`

#### Scenario: Started from Codex

- **WHEN** `titan run example.yaml` runs with the recorded Codex variable in its environment and no `--harness` flag
- **THEN** `titan` uses the Codex adapter
- **AND** the run record names the variable that it used

#### Scenario: Started from Antigravity

- **WHEN** `titan run example.yaml` runs with the recorded Antigravity variable in its environment and no `--harness` flag
- **THEN** `titan` uses the Antigravity adapter
- **AND** the run record names the variable that it used

### Requirement: The flag wins over detection

`titan` SHALL use the agent tool named by `--harness claude`, `--harness codex` or `--harness antigravity` when that flag is given. The flag MUST win over the environment and over the `harness` field of the workflow file.

#### Scenario: Flag and environment disagree

- **WHEN** `titan run example.yaml --harness codex` runs with `CLAUDECODE=1` in its environment
- **THEN** `titan` uses the Codex adapter
- **AND** the run record has `"detectedBy":"flag"`

### Requirement: The workflow file can name the agent tool

`titan` SHALL use the agent tool named in the workflow file's `harness` field when there is no `--harness` flag and the field is not `auto`.

#### Scenario: Workflow file names Antigravity

- **WHEN** the workflow file has `harness: antigravity` and `titan run` gets no `--harness` flag
- **THEN** `titan` uses the Antigravity adapter
- **AND** the run record has `"detectedBy":"workflow"`

### Requirement: Stop with a clear message when no agent tool is found

`titan` MUST stop before starting agents when a persona needs a detected default backend and no agent tool is found. A run with every backend explicitly resolved MUST work from a plain shell. The message SHALL list which of the commands `claude`, `codex` and `agy` it found on the `PATH`, and how to use `--harness`.

#### Scenario: Run from a plain shell

- **WHEN** `titan run example.yaml` runs with none of the detection variables set, no `--harness` flag, and `harness: auto` in the file
- **AND** only `claude` and `codex` are on the `PATH`
- **THEN** `titan` exits with code 2
- **AND** the message says that no agent tool was detected, lists `claude` and `codex` as found and `agy` as not found, and shows `--harness claude|codex|antigravity`
- **AND** no agent was started

### Requirement: Show what was detected

`titan doctor` SHALL print the detected agent tool and the variable or flag that decided it. It SHALL also print, for each of the three agent tools, whether its command and its SDK package are installed.

#### Scenario: Doctor inside Claude Code

- **WHEN** `titan doctor` runs with `CLAUDECODE=1` set
- **THEN** it prints `harness: claude (env:CLAUDECODE)`
- **AND** it prints one line each for `claude`, `codex` and `antigravity` with `command: found|missing` and `sdk: found|missing`

### Requirement: The detected agent tool gives the default backend

`titan` SHALL use the SDK of the detected agent tool as the backend for every persona that has no other backend set. The order of backend choice MUST be the one in spec backend-selection.

#### Scenario: No backend set anywhere

- **WHEN** `titan run example.yaml` runs with `CLAUDECODE=1`, no `--backend` flag, and no `backend` field in the file
- **THEN** every agent in the run record has `"backend":"claude-sdk"`

### Requirement: Ambiguous detection needs an explicit choice

If environment variables identify more than one agent tool, `titan` SHALL fail with exit code 2 unless a flag or workflow field resolves the choice. It MUST NOT depend on the order of environment variables.

#### Scenario: Two harness variables

- **WHEN** both Claude and recorded Codex detection variables are set and no explicit harness is given
- **THEN** `titan` exits with code 2 and asks for `--harness`

#### Scenario: Explicit API backend in a plain shell

- **WHEN** every persona resolves to a ready model API backend and no harness variable is set
- **THEN** the run starts without requiring an installed agent tool

### Requirement: Detection belongs to each submitting client

The submitting CLI or MCP client SHALL resolve harness selection using its own environment and explicit choices. It MUST send the resolved name and detection source with each submission. The daemon MUST NOT use its startup environment as a default for later clients. Direct HTTP clients MUST provide explicit harness context or fully resolved backends. Recovery MUST reuse each run's recorded choice. No client MUST send its full environment.

#### Scenario: Codex submits to a Claude-started server

- **WHEN** Claude started the daemon and a Codex client submits without a backend override
- **THEN** the new run resolves its default to Codex and the earlier Claude run keeps Claude

#### Scenario: Daemon restarts in another harness

- **WHEN** runs resolved to different harnesses before restart
- **THEN** each retains its original resolved backend after restart
