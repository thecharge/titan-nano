## ADDED Requirements

### Requirement: A plug-in package adds backends and embedders

`titan` SHALL load plug-ins: npm packages that add backends or embedders. An embedder is the part that makes embeddings for meaning search. A plug-in's default export MUST be one object with `specificationVersion`, `name`, and the lists `backends` and `embedders`. Each backend in the list MUST fill the port `AgentBackend`. Each embedder MUST fill the port `Embedder`.

#### Scenario: New vendor from a plug-in

- **WHEN** the workflow file has `plugins: [titan-plugin-good]`, its import is approved, and that package adds `mistral-api`
- **AND** a persona has `backend: mistral-api`
- **THEN** `titan backends` lists `mistral-api`
- **AND** the run record shows that persona's agent with `"backend":"mistral-api"` and the plug-in's name and version

### Requirement: Plug-ins are named, never found by themselves

`titan` SHALL load only approved plug-ins named in the workflow file's `plugins` list or in `~/.titan/config.yaml`. It MUST look for each package from the user's project folder, not from its own folder.

#### Scenario: Plug-in installed in the project

- **WHEN** `titan-plugin-good` is installed in the user's project and not in `titan`'s own folder
- **AND** the workflow file names it in `plugins`
- **THEN** `titan` resolves it from that project and loads it only after its import approval

#### Scenario: Plug-in not installed

- **WHEN** the workflow file names `titan-plugin-missing` and no such package is installed
- **THEN** `titan check` fails with the text `titan-plugin-missing: not installed`

### Requirement: Plug-ins must match the version of the port

`titan` SHALL refuse a plug-in whose `specificationVersion` differs from its own. The error MUST name the plug-in and both versions. Version and duplicate-id checks that need module execution MUST wait for import approval. Static checks MAY inspect package metadata without executing it.

#### Scenario: Plug-in for an older port

- **WHEN** the workflow file names `titan-plugin-old` with `specificationVersion: "titan-plugin-v0"` and `titan` has `titan-plugin-v1`
- **THEN** `titan check` fails with the text `titan-plugin-old: wants titan-plugin-v0, titan has titan-plugin-v1`

### Requirement: A backend id is used only once

`titan` SHALL refuse a backend from a plug-in when its id is already used, by a built-in backend or by another plug-in.

#### Scenario: Two plug-ins with the same backend

- **WHEN** two plug-ins both add the backend `mistral-api`
- **THEN** `titan check` fails with the text `backend mistral-api already registered`

### Requirement: The meaning search uses an embedder port

The knowledge hub SHALL make embeddings only through the port `Embedder`. The default embedder MUST be `@titan/embedder-local`, with `Xenova/all-MiniLM-L6-v2`. A plug-in embedder MAY replace it. When the embedder changes, `titan kb search --mode meaning` MUST stop with a message to run `titan kb reindex`.

#### Scenario: Embedder changed

- **WHEN** the hub was indexed with the default embedder, and `~/.titan/config.yaml` now names another embedder
- **AND** `titan kb search "the clock is in UTC" --mode meaning` runs
- **THEN** it exits with code 2 and prints `run titan kb reindex`

### Requirement: The core does not depend on any adapter

In the repository, `@titan/core` SHALL depend only on the shared constants, types, errors and messages packages. An adapter package (a package whose name starts with `@titan/backend-` or `@titan/embedder-`) MUST depend only on those foundations, `@titan/core` and its registered vendor packages. The explicit `@titan/runtime` composition package SHALL construct concrete adapters; CLI handlers and ordinary product libraries MUST NOT depend on them. Shared tests MAY exercise adapters and vendor SDKs through declared test dependencies. Both runtime and development dependencies SHALL follow these rules. Workspace names SHALL remain bound to their directories so a renamed library cannot gain composition or test privileges.

#### Scenario: Wrong dependency

- **WHEN** a test adds `@titan/backend-claude` to the dependencies of `@titan/runner`
- **THEN** the dependency test fails and names `@titan/runner` and `@titan/backend-claude`

### Requirement: Import approval has a preflight path

After static validation, `titan check` SHALL create a preflight record when plug-in import approval is missing. It MUST return code 3 with the preflight id and its open `action` request. The record MUST bind the project, workflow hash and installed package hashes. The person MUST be able to answer it through the existing approval commands. `titan check --preflight <id>` MUST continue that check after approval. `titan run --preflight <id>` MUST reuse only the exact approved inputs. Changed inputs MUST invalidate that approval before import. Preflight MUST start no worker or tool server.

#### Scenario: Approve a plug-in before validation continues

- **WHEN** `titan check` reaches an installed plug-in whose import is not approved
- **THEN** it exits with code 3 and an answerable preflight request without importing the module
- **AND** after approval, checking the same preflight id completes capability validation

### Requirement: Claude query cleanup releases finished references

The Claude Code adapter SHALL release its active query reference after closing a completed or failed send. Cancellation, caller abort and explicit close during event handling SHALL close that query without closing it again during send cleanup. Repeated session close and cancellation SHALL NOT call a finished query's closer. A later turn SHALL own a new query while retaining the learned native session identifier. If the SDK closer throws, the adapter SHALL report that error and retain the reference for explicit cleanup instead of silently discarding it. Existing process termination, usage and operational failure checks SHALL remain required.

#### Scenario: Completed turns release their query

- **WHEN** a new or resumed Claude session completes one or two turns and is closed repeatedly
- **THEN** the adapter calls each query closer once, its iterator finishes and every turn's event is observed
- **AND** later session cleanup does not call a completed query's closer

#### Scenario: Failed turns release their query

- **WHEN** a new or resumed Claude session receives an operational failure or malformed usage
- **THEN** the original operational or protocol error remains observable
- **AND** its query and iterator finish before repeated session cleanup

#### Scenario: Cancellation cleanup does not close a query twice

- **WHEN** an event observer cancels or closes a new or resumed session, or the caller aborts the turn
- **THEN** that turn is rejected, its iterator finishes and the adapter calls its query closer once
- **AND** repeated close and cancellation leave that query untouched

#### Scenario: Failed SDK close remains available for explicit cleanup

- **WHEN** the SDK closer throws on the first cleanup of a new or resumed session and a later explicit close succeeds
- **THEN** the original close error is observable and the explicit close retries that same query
- **AND** subsequent cleanup does not close the finished query again
