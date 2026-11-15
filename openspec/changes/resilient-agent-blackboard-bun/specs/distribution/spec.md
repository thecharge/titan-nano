## ADDED Requirements

### Requirement: Release packages install independently of the monorepo

The release SHALL publish a versioned @titan/cli package and every runtime @titan dependency it needs. The CLI MUST expose the titan binary and declare its supported Bun range. Each package MUST declare exports and an explicit files list. Packed manifests MUST contain resolvable versions, without workspace, catalog or local file dependencies. Registry scope availability MUST be verified before advertising an install command. Release evidence MUST include tarball hashes, dependency inventory, licenses and version compatibility. Installing MUST need neither this checkout nor its development dependencies. Publishing itself MUST require separate release authorization.

#### Scenario: Install without workspace links

- **WHEN** packed release packages install into a clean directory from an isolated test registry with no repository access
- **THEN** the installed titan binary loads every advertised runtime package and runs the offline example

#### Scenario: Missing transitive package

- **WHEN** a packed CLI references an unpublished internal version
- **THEN** the isolated installation gate fails before release

#### Scenario: Secret in package files

- **WHEN** a staged package includes a token or private run record
- **THEN** the package inventory and secret gate reject the release

### Requirement: Environment and optional capabilities are explicit

Installation documentation SHALL specify a tested OS, architecture, Bun version and package-manager matrix. It MUST distinguish required runtime dependencies from optional Git, Node, Python, Lean, Z3, native libraries and embedding models. Doctor MUST report each capability as ready, missing, unsupported or unverified, with repair instructions. Offline doctor MUST make no vendor calls and no model downloads unless `--fetch-model` is given. Configuration and artifact commands MUST work without optional proof or embedding tools. Installation MUST NOT silently grant agent permissions or install system tools. Installation MAY download the meaning-search model only as the knowledge-hub spec says. Native load failures MUST name the affected capability without claiming a supported platform.

#### Scenario: Minimal environment first use

- **WHEN** Bun is supported but Python, Lean and embeddings are absent
- **THEN** offline doctor reports those missing capabilities and the fake-backed document example still works

#### Scenario: Unsupported native dependency

- **WHEN** sqlite or embedding native loading fails on an unverified architecture
- **THEN** doctor reports the limitation and release support does not claim that capability

### Requirement: Install checks the needed tools first

`titan install` SHALL check the tools it needs before it writes any file. Bun at the version the package asks for and Git are required. The command of the chosen agent (`claude`, `codex` or `agy`), Python, Lean, Z3 and Podman are optional, because the skill can be installed before the agent. The check MUST name each tool as ready or missing, say how to fix each missing one, and MUST NOT install anything or call a vendor. If a required tool is missing, install MUST stop with exit code 2 and write no file. If only optional tools are missing, install MUST finish and list them. `titan doctor` MUST show the same list.

#### Scenario: Required tool missing

- **WHEN** `titan install --harness claude` runs and Git is not on the path
- **THEN** install exits with code 2, names `git`, says how to install it and writes no file

#### Scenario: Only optional tools missing

- **WHEN** `titan install --harness claude` runs with Bun and Git present and Lean or the `claude` command absent
- **THEN** install writes the skill and its output lists Lean as missing and optional

### Requirement: A start script works before Bun exists

The repository SHALL contain `install.sh`, a plain `sh` script that needs only a POSIX shell to start. It MUST check Bun at the version the package asks for, and Git. It MUST name each missing tool and print how to install it. It MUST exit with code 2 when a required tool is missing. It MUST NOT install anything unless the person passes `--install-bun`, and then it MUST only run the official Bun installer and say so first. When the required tools exist, it MUST install the repository packages, build the package with `bun run pack:preview`, add it to the chosen folder and run `titan doctor`.

#### Scenario: Bun absent at start

- **WHEN** `install.sh` runs on a computer where `bun` is not on the path
- **THEN** it exits with code 2, names `bun`, prints the download address and `--install-bun`, and changes nothing

#### Scenario: Git absent at start

- **WHEN** `install.sh` runs where Bun is present and `git` is not
- **THEN** it exits with code 2, names `git` and changes nothing

### Requirement: Titan tells the person when a newer version exists

Titan SHALL compare its own version with the newest version at the update source. The source is a Git address set in the config file under `update.source`. By default, Titan checks at most once a day, with `git ls-remote --tags`, and sends no data about the person. A person can turn the check off with `update.check: never`. When a newer version exists, every command MUST print one line on the error stream that names the new version and says `titan update`. This line MUST NOT appear in `--json` output. A failed or slow check MUST NOT change a command result or delay it by more than two seconds.

#### Scenario: Newer version exists

- **WHEN** the update source has a tag newer than the installed version and a command runs
- **THEN** one line on the error stream names the new version and `titan update`, and the command result is unchanged

#### Scenario: Check turned off

- **WHEN** `update.check` is `never`
- **THEN** Titan makes no network call and prints no update line

### Requirement: Titan updates without losing data

`titan update` SHALL install the newest version, or the file given with `--from`. Before it changes anything, it MUST copy the whole Titan home to `HOME/backups/VERSION-TIME` and check that the copy can be read. It MUST install the new version beside the old one, run `titan doctor` from the new version, and switch only if that passes. If any step fails, it MUST keep the old version running, leave the home as it was, and say where the backup is. It MUST NOT delete a backup, a run, a knowledge entry or a config file. When the new version needs a new data format, it MUST follow the documented migration and keep the old files. `titan update --check` MUST only report and change nothing.

#### Scenario: Update that passes

- **WHEN** `titan update --from FILE` runs with a valid newer package
- **THEN** a backup exists and is readable, the new version answers `titan doctor`, and every run and knowledge entry is still there

#### Scenario: Update that fails

- **WHEN** the new package fails `titan doctor`
- **THEN** the old version still runs, the home is unchanged, and the output names the backup

### Requirement: The start script only starts the install

`install.sh` SHALL do only what cannot be done by a command, because Titan does not exist yet: check Bun and Git, build and add the package. Every later step, including checks, updates and repair, MUST be a `titan` command. People and agents MUST run the installed `titan` command, not a source script.

#### Scenario: Later steps are commands

- **WHEN** `docs/install.md` lists a step after the package is added
- **THEN** that step is a `titan` command

### Requirement: A plain-language install guide exists

The repository SHALL contain `docs/install.md`. It MUST say what the package is and how to build it with `bun run pack:preview`. It MUST say how to install it with `bun add` and a path. It MUST say what `titan install` checks, give the first three commands to run, and say what to expect on a new computer. The command-reference gate MUST check each command in it.

#### Scenario: Install guide matches the package

- **WHEN** the documentation check runs
- **THEN** every command in `docs/install.md` exists in the command list

### Requirement: A first working version has an executable acceptance path

The first local preview SHALL install from packed artifacts, initialize configuration, validate and dry-run a shipped example, and run it with deterministic vendor stubs. It MUST show parallel overlap, an injected interruption, daemon restart, same-attempt recovery, status, events, artifacts and safe application. Fixtures MUST contain no credentials and MUST require explicit fake-backend selection. Documentation MUST supply exact commands checked by the command-reference gate. This preview MUST work outside the repository with a clean home and project. One separately authorized real adapter rehearsal MUST follow before advertising real-agent readiness. A partial preview MUST identify deferred capabilities and MUST NOT be called the full production release.

#### Scenario: Installed preview survives restart

- **WHEN** the packed CLI runs its mixed-graph example with a scripted rate limit and daemon termination
- **THEN** resume preserves finished work and the interrupted attempt; checked final artifacts are inspectable and exportable

#### Scenario: Installed SDK checker survives daemon restart

- **WHEN** a pinned SDK checker exits after emitting its native identifier and the daemon is then killed or stopped
- **THEN** the installed CLI resumes that checker through the same identifier and candidate checkpoint without rerunning its completed worker
- **AND** exhausted recovery allowance cannot refill and the original project remains unchanged
- **AND** published files contain the declared delivery and original inputs without vendor fixture session state or invocation logs

#### Scenario: Installed mixed SDK plans retain independent file delivery

- **WHEN** two origins submit the same request identifier and workflow identifier to one daemon using both pinned SDK libraries with executable stubs
- **THEN** each run follows its own eight-step graph through a sequential seed, three live parallel workers, a join, two live parallel workers and a final join
- **AND** swapped backend assignments and reversed graph presentation preserve complete checked files and distinct run identifiers
- **AND** a parallel file conflict or a missing ancestor file blocks only the affected run without spending a quality attempt or publishing artifacts
- **AND** the companion run finishes, both runs remain visible, and the original project files remain unchanged

#### Scenario: Real adapter readiness needs evidence

- **WHEN** only the deterministic installed preview has passed
- **THEN** the support matrix marks real adapters unverified and the full release gate remains closed

### Requirement: Code documents research and operations have distinct completion evidence

Shipped examples SHALL include code changes, a document, cited research and a stubbed external operation. Code delivery MUST include a kept diff and reproducible check commands. Document delivery MUST include the file, declared format checks and content-review evidence. Research MUST preserve source references, retrieval dates and unresolved uncertainty. Operations MUST journal intent, authorization, idempotency key and observed outcome. Unknown external outcomes MUST block reconciliation and MUST NOT replay automatically. A successful local artifact MUST NOT imply successful deployment, publication or remote action.

#### Scenario: Remote operation response is lost

- **WHEN** a stub records an authorized action but its reply is lost before Titan commits the outcome
- **THEN** the action becomes unknown and requires reconciliation; no duplicate effect is sent

#### Scenario: Research report has uncertainty

- **WHEN** a research workflow cannot verify one requested claim
- **THEN** its artifact names the missing evidence and cannot report that claim as established

### Requirement: Titan can develop itself without changing its active runtime

A self-development example SHALL pin the installed Titan version and work on the shared live project tree under blackboard file-access negotiation. Active runs MUST NOT import newly edited runtime source or overwrite the installed binary. The candidate MUST pass the repository checks through approved scripts before its live source changes are offered for review. Committing, pushing and replacing the installed runtime MUST remain separate explicitly authorized operations. Future runs MAY select a verified new release; existing run recovery MUST use its recorded compatible runtime and format versions.

New run records SHALL use format five and record runtime_version from the shared installed Titan release. Format five MUST require that pin, and formats one through four MUST omit it. Recovery and append MUST require the exact recorded release before changing saved bytes. A release mismatch SHALL return unsupported_run_runtime naming the required and current releases and the documented recovery path. A journal MUST NOT acquire, remove or change its release pin between records. Legacy runs SHALL remain readable without fabricated runtime identity.

A validated worker result SHALL be retained before native cleanup and file checkpoint capture. Its journal SHALL upgrade to format six while retaining its original release and caller identity. A pending capture MUST retain the received answer and MUST NOT permit another worker dispatch or acceptance of later live contents as the original result. Completed capture SHALL clear the pending marker. Older readers MUST refuse the new format without changing saved bytes. An incomplete capture requires explicit reconciliation before publication.

#### Scenario: Titan edits Titan

- **WHEN** an installed release proposes and verifies a source change to this project
- **THEN** the running controller retains its original code and returns checked changes from the shared live tree for review

Unsupported positive integer journal formats MUST have a distinct unsupported_run_format diagnostic naming supported formats and recovery guidance. Replay, event inspection and control attempts MUST preserve the journal, its incomplete tail and state projection when that format is refused. An initialized writer MUST remain usable for an unchanged supported record after an unsupported append is refused.

#### Scenario: New version cannot read checkpoint

- **WHEN** a newer CLI sees an unsupported saved run format
- **THEN** it refuses writes and offers the compatible runtime or documented migration path

#### Scenario: Saved run requires its recorded release

- **WHEN** a CLI or daemon reads, inspects or controls a format-five checkpoint created by another Titan release
- **THEN** it returns unsupported_run_runtime with the required and current releases and recovery guidance, preserving the journal, incomplete tail and state projection

#### Scenario: Runtime pin is required from the first record

- **WHEN** a format-five journal omits its release pin from the first record or a later record removes, changes or downgrades that pin
- **THEN** replay and append refuse the record without changing saved bytes, and an initialized writer can still commit its unchanged supported record

### Requirement: Packaging bounds generated assets before decoding

Packaging SHALL read source manifests through bounded asynchronous byte readers. Each generated asset command MUST receive ignored standard input and independently bounded stdout and stderr. Both pipes MUST drain concurrently through the shared capped utility. Defaults SHALL be one MiB per pipe and ten seconds per command. Shared schemas MUST reject unknown, non-integer, zero or enlarged budgets before spawning. Successful commands MUST return the exact stdout bytes. Overflow or deadline expiry MUST kill and reap the direct generator before returning failure. A deadline MUST remain a deadline failure if delayed pipe reading also discovers overflow. Nonzero exits MUST fail without exposing captured diagnostics. These limits apply to the asset generators used by packing.

#### Scenario: Generated binary bytes remain exact

- **WHEN** a successful generator writes binary stdout exactly at its configured byte limit
- **THEN** packaging returns the same bytes without text conversion and confirms that the generator exited

#### Scenario: Both generator pipes can fill

- **WHEN** a successful generator writes one MiB to stdout and one MiB to stderr
- **THEN** concurrent pipe draining completes within the unchanged command deadline

#### Scenario: Either generator pipe exceeds its allowance

- **WHEN** stdout or stderr exceeds its own allowance, including a generator that remains alive
- **THEN** packaging refuses the output and confirms that the direct generator exited before returning

#### Scenario: Generator deadline takes precedence

- **WHEN** a generator ignores termination and exceeds its command deadline
- **THEN** packaging kills and reaps it and reports the deadline failure
- **AND** a delayed overflow observation cannot replace that deadline result

#### Scenario: Failed generator cannot supply an asset

- **WHEN** a generator exits with a nonzero status after writing stdout and stderr
- **THEN** packaging refuses the asset without including either captured stream in its diagnostic

#### Scenario: Invalid generator budgets cannot start work

- **WHEN** generator settings contain unknown fields or zero, fractional, string or enlarged budgets
- **THEN** schema admission refuses them before starting a process

### Requirement: Owned command capture has finite process and stream ownership

A shared process package SHALL validate command arguments and finite pipe and time allowances before spawning. It MUST ignore input and capture stdout and stderr as separate bounded Buffers through shared capped concurrency. Defaults SHALL remain one MiB per pipe and ten seconds. Callers MAY select a deadline up to ten seconds within the central schema. Packaging MUST retain its existing stricter settings, diagnostics and refusal of completed nonzero exits. A general capture MUST retain a normal nonzero exit and its exact output for the executor to classify. Cancellation and deadlines MUST close captured streams, stop the owned Linux process group and await the direct child. A failed group stop MUST attempt direct-child cleanup and remain a failure. The first capture or cleanup failure MUST survive subsequent cleanup failures. Container isolation, scoped approval, effect reconciliation and workflow accounting remain separate required executor responsibilities.

#### Scenario: Owned commands retain completed binary output

- **WHEN** an admitted owned command completes normally with zero or a nonzero exit
- **THEN** its exit code and exact independent binary stdout and stderr remain available within their finite ceilings
- **AND** empty companion arguments remain separate and valid

#### Scenario: Interrupted capture closes streams and owned children

- **WHEN** a command exceeds a pipe ceiling or deadline, receives a signal or is cancelled
- **THEN** capture refuses a completed result and awaits its owned direct child after closing its pipes
- **AND** a deadline stops descendants that retain inherited pipes in the owned process group
- **AND** cleanup failure cannot replace the first recorded failure

#### Scenario: Invalid command input cannot launch

- **WHEN** a command has an empty executable, a zero byte, excess arguments, excessive text or invalid capture allowances, or its signal is already cancelled
- **THEN** admission refuses the input before the process launcher is called

### Requirement: Updates can install by themselves without harming the user's work

A setting `update.mode` SHALL be `notify`, `auto` or `off`, with `notify` as the default. In `auto` mode, `titan` MUST install a newer version at a time when no run is active, and MUST do it the way `titan update` does it. Every update MUST first copy the whole home and the project hub to a backup. An update MUST NOT change or delete runs, hubs, personas, settings or databases. A new version that finds older data MUST upgrade a copy and keep the original. If the new version fails the doctor check, `titan` MUST go back to the old version and tell the person.

#### Scenario: Automatic update when idle

- **WHEN** `update.mode` is `auto`, a newer version exists and no run is active
- **THEN** the new version is installed and the backup exists

#### Scenario: Active run blocks the update

- **WHEN** `update.mode` is `auto` and a run is active
- **THEN** nothing is installed until the run ends or is blocked

#### Scenario: Old data survives

- **WHEN** an update installs a version with a newer data format
- **THEN** the old runs and hubs are still readable and a copy holds the upgraded data

#### Scenario: Failed update goes back

- **WHEN** the new version fails the doctor check
- **THEN** the old version runs again and the person's data is unchanged
