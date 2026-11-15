## ADDED Requirements

### Requirement: Two RunPod backends from one plug-in

The plug-in package `@titan/backend-runpod` SHALL add two backends through the backend port, as in spec backend-plugins:

- `runpod-vllm`: the agent's turn runs in `titan`, and the model runs on a private RunPod vLLM endpoint. vLLM is a server for open-weight models that speaks the OpenAI API.
- `runpod-worker`: a whole persona session runs in a RunPod queue endpoint, with the `titan worker` handler in its container. One RunPod job is one agent turn.

A persona MUST name its endpoint with `runpod: { endpoint, model }`.

#### Scenario: Backend listed when the plug-in is loaded

- **WHEN** the config names `@titan/backend-runpod`, its key is set, and release evidence verifies both backends and their stop behavior
- **THEN** `titan backends` lists `runpod-vllm` and `runpod-worker` as `ready`

### Requirement: The RunPod key comes only from the environment

`titan` SHALL read the RunPod key only from `RUNPOD_API_KEY`. It MUST NOT write the key to any file, the board, the run record or a trace. When the variable is not set, `titan backends` MUST print the two backends as `not ready`, with the reason `RUNPOD_API_KEY is not set`.

#### Scenario: Key not set

- **WHEN** `RUNPOD_API_KEY` is not set
- **THEN** `titan backends` prints `runpod-vllm` and `runpod-worker` as `not ready`, with the reason `RUNPOD_API_KEY is not set`

#### Scenario: Key not in the record

- **WHEN** a run uses `runpod-vllm` with the fake RunPod endpoint
- **THEN** no file in the run record or in `~/.titan` contains the key's value

### Requirement: A vLLM persona gets tools only through tool servers

A persona on `runpod-vllm` SHALL get only the tools of tool servers, as for a model API in spec backend-selection. `titan backends --probe` MUST send one tool call to each named endpoint and print `tools: yes` or `tools: no`. RunPod's docs say that tool calls depend on the model.

#### Scenario: Model without tool calls

- **WHEN** the fake endpoint answers a tool call with plain text
- **THEN** `titan backends --probe` prints `runpod-vllm <endpoint> tools: no`
- **AND** `titan check` fails for a persona on that endpoint that lists a tool server

### Requirement: A worker on RunPod uses no local tool servers

A persona on `runpod-worker` MUST NOT list a tool server that runs as a program on the person's computer. `titan check` SHALL fail for such a persona and name the tool server.

#### Scenario: Local tool server on a worker

- **WHEN** a persona on `runpod-worker` lists a tool server with `command: ./tools/search`
- **THEN** `titan check` fails with the text `a runpod-worker persona cannot use the local tool server "search"`

### Requirement: A run that uses RunPod lasts at most 1 hour

A workflow file SHALL set `limits.max_minutes`. For a run with any persona on a RunPod backend, `limits.max_minutes` MUST be 60 or less, and the default MUST be 60. The hour MUST be counted on the clock from the start of the run. It includes time spent waiting for answers.

#### Scenario: Limit above one hour

- **WHEN** a workflow file with a `runpod-worker` persona has `limits.max_minutes: 90`
- **THEN** `titan check` fails with the text `limits.max_minutes is 90, but a run that uses RunPod may last at most 60 minutes`

### Requirement: RunPod jobs receive the remaining deadline and cancellation

For each RunPod job, `titan` SHALL send an `executionTimeout` and a `ttl` that are no longer than the time left in the run. `titan` MUST cancel every open job 30 s before the deadline with `/cancel`. It MUST NOT send a job when the time left minus 30 s is under 10 s, RunPod's smallest `ttl`. The 30 s is a guess that has not been measured.

#### Scenario: Short jobs inside the hour

- **WHEN** a run sends 3 jobs to the fake endpoint, each taking 5 minutes
- **THEN** all 3 end as `COMPLETED`
- **AND** no job was sent with a `ttl` above 60 minutes

#### Scenario: A 2-hour job is stopped

- **WHEN** a job on the fake endpoint would take 2 hours
- **THEN** `titan` cancels it before 60 minutes have passed
- **AND** the step ends as `timed_out`

#### Scenario: Open jobs are cancelled at the deadline

- **WHEN** one job waits in the queue and one job runs as the deadline comes near
- **THEN** the fake endpoint gets one `/cancel` call for each of the two jobs

#### Scenario: Too little time left

- **WHEN** a step would start with 35 s left in the run
- **THEN** `titan` sends no job and the step ends as `timed_out`

### Requirement: A run that reaches its time limit ends as timed out

When a run reaches `limits.max_minutes`, `titan` SHALL end it with the state `timed_out` and exit code 1. `result.md` MUST list the results that survived and the steps that were cut off. The start time and deadline MUST survive server restarts. A timed-out RunPod run MUST NOT resume or raise its deadline past 60 minutes from its original start. Further work MUST use a new run id and a new paid-compute approval.

#### Scenario: Restart cannot reset the hour

- **WHEN** the server restarts 61 minutes after a RunPod run started
- **THEN** the run is `timed_out` and no new job starts for that run id
- **AND** `titan resume` refuses to extend that run past its original hour

#### Scenario: Result after a timeout

- **WHEN** a run reaches its limit after steps `a` and `b` survived and while step `c` runs
- **THEN** `result.md` lists `a` and `b` as survived and `c` as cut off
- **AND** `titan` exits with code 1

### Requirement: The person approves paid compute

Before the first RunPod job or vLLM request of a run, `titan` SHALL send one `paid_compute` request at level `human`. For queue workers, the request MUST show the planned worker-time allowance: `limits.max_parallel` × `limits.max_minutes`. It MUST say that this is not a guaranteed billing cap. The approval MUST name the endpoints, parallel limit and deadline. A new endpoint or higher parallel limit MUST need a new approval before more jobs start. RunPod bills worker time, whether a job succeeds or not. A missing cancel acknowledgement MUST be logged and retried. The record MUST show any job whose remote state is unknown after the deadline. The backend MUST remain `not ready` for release until live tests establish its stop behavior.

#### Scenario: Paid compute request

- **WHEN** a run has `limits.max_parallel: 4`, `limits.max_minutes: 60` and RunPod personas
- **THEN** before any RunPod job, there is one `paid_compute` request with the text `planned allowance: 240 minutes of RunPod worker time; billing cap not guaranteed`

#### Scenario: Cancel call fails

- **WHEN** the fake endpoint rejects a cancel call at the deadline
- **THEN** the run stops local work, records the unknown remote job state and retries cancellation
- **AND** the result does not claim the worker stopped

### Requirement: A remote worker uses a hub snapshot

A `runpod-worker` job SHALL start its own bundled `titan tool-server` inside its container. It MUST receive only a snapshot of final hub entries allowed for that run. Hub changes MUST return with the candidate result as pending changes. The host MUST check their base versions and publish only the kept candidate's changes. The worker MUST NOT receive the person's server or person tokens. Live shared hub access from remote workers is outside this change.

#### Scenario: Remote worker changes the hub

- **WHEN** a fake remote worker adds a fact through its bundled tool server
- **THEN** the fact returns as a pending change tied to the candidate attempt
- **AND** it becomes final on the host only when that candidate is kept

### Requirement: vLLM requests obey the paid run boundary

The `runpod-vllm` backend SHALL require paid-compute approval before its first model request. It MUST stop issuing requests at the deadline and cancel local in-flight calls. Its approval MUST say that stopping calls does not stop or deprovision the endpoint. Endpoint lifetime and idle billing MUST remain the person's responsibility and MUST NOT be described as capped by the run deadline.

#### Scenario: vLLM reaches its deadline

- **WHEN** a vLLM run reaches its deadline with a request in flight
- **THEN** local cancellation occurs and no further model request starts
- **AND** the result makes no claim that the endpoint stopped billing
