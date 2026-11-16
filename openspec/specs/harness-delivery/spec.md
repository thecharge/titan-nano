# harness-delivery Specification

## Purpose

Record verified harness repairs, shared-file preservation, backend authorization and production service acceptance. Preserve remaining release requirements and verification limits.

## Requirements

### Requirement: Delivery records match observed acceptance

The delivery record SHALL link each completed repair to its owning product tasks, observed acceptance output and tested source identity. Counterexamples MUST reopen affected completion claims. Pending requirements MUST remain visible.

#### Scenario: A checked rollback task has a counterexample

- **WHEN** a refused attempt restores `note.txt` over a concurrent user edit
- **THEN** the file-preservation task is recorded as incomplete with the failing case
- **AND** a passing unrelated suite does not close that task

#### Scenario: A production service has only component proof

- **WHEN** a run-lesson test passes with an injected service but the installed server omits that service
- **THEN** production lesson delivery remains incomplete

### Requirement: Refused attempts preserve user work

A refused, failed or cancelled attempt MUST preserve concurrent user edits and MUST NOT leave unapproved writes outside its allowed scope. A conflicting restoration MUST preserve the current user data and produce inspectable conflict evidence for reconciliation. Live execution SHALL remain the default on the shared filesystem. File access MUST be coordinated through durable blackboard intent across runs. Overlapping scopes SHALL yield and continue automatically after release without a manual resume, a vendor execution or a quality refutation for the wait. Independent scopes MUST continue. Claims MUST NOT be described as operating-system fencing against nonparticipating programs.

#### Scenario: User changes a file before rollback

- **WHEN** an attempt changes `note.txt` and the user changes it again before the attempt is refused
- **THEN** the user's latest contents remain
- **AND** the run reports the restoration conflict

#### Scenario: Worker tries an unlisted write

- **WHEN** a step allows only `note.txt` and its worker tries to change `outside.txt`
- **THEN** the unapproved change is prevented from reaching the user's project
- **AND** the run records the refusal

#### Scenario: Runs negotiate overlapping live scopes

- **WHEN** a live run holds a file scope and another run requests the same file or a containing directory
- **THEN** the second run records its waiting intent without dispatching its worker
- **AND** release automatically admits that run against the latest shared contents without a quality refutation

#### Scenario: Independent file scopes continue

- **WHEN** one live run is waiting for an occupied file scope and another requests an independent file
- **THEN** the independent run can complete before the occupied scope is released

#### Scenario: A waiting claim is cancelled

- **WHEN** a run is cancelled while waiting for a live file scope
- **THEN** its worker never dispatches and its intent is withdrawn
- **AND** later work can acquire that scope

#### Scenario: A changed file invalidates reconciliation approval

- **WHEN** an external edit changes after approval of a restoration conflict
- **THEN** the earlier approval cannot authorize restoration over the newer contents
- **AND** a new hash-bound reconciliation request is required

#### Scenario: Native hosts share independent scopes

- **WHEN** two admitted Claude Code or Codex turns target independent files in the same live project
- **THEN** both can execute before either host exits
- **AND** their working directories resolve to the same project rather than execution copies
- **AND** each retained board claim names its execution

#### Scenario: Shared readers yield to an earlier writer

- **WHEN** two read claims overlap and a writer waits for their scope
- **THEN** both readers can proceed together
- **AND** later readers do not indefinitely postpone the waiting writer
- **AND** host admission preserves the board order

#### Scenario: Scope expansion releases the earlier claim

- **WHEN** an admitted execution needs another scope that a peer holds
- **THEN** the board records the expanded intent and releases its earlier claim before waiting
- **AND** it reacquires the combined claim without holding one scope while waiting for another
- **AND** cancellation withdraws the combined intent without dispatching another vendor turn

#### Scenario: A changed read requires fresh reconciliation

- **WHEN** a file read by an attempt changes outside its declared write paths
- **THEN** the prior checks cannot authorize publication against the changed dependency
- **AND** an explicit reconciliation turn retains the earlier candidate and current version observations
- **AND** the new evidence generation needs fresh checks before publication

#### Scenario: An interrupted received result is reconciled once

- **WHEN** a validated worker result is durably received but file capture fails
- **AND** the controller restarts after the live project has changed
- **THEN** resume retains that result and its usage without repeating the original worker command
- **AND** an explicit reconciliation generation records its original result and current file identities
- **AND** only freshly checked reconciled evidence can publish
- **AND** a received script or split aggregate uses its explicitly declared reconciliation persona and task
- **AND** its original command output or aggregate remains the downstream result while recovery answers and usage remain separately recorded
- **AND** unknown recovery personas and self-falsification are rejected before dispatch

### Requirement: Backend authorization precedes dispatch

The runtime MUST reject an unapproved backend before any vendor call. Retries, recovery and limits MUST NOT select another backend without explicit authorization.

#### Scenario: Selected backend reaches a limit

- **WHEN** an approved Claude run reaches a usage limit and Codex is available
- **THEN** the run waits or blocks with the reason
- **AND** no Codex call occurs

#### Scenario: Resume requests an unapproved backend

- **WHEN** a run is resumed with a backend that the owner has not authorized
- **THEN** the request is refused before vendor dispatch

### Requirement: Installed workflows use complete production services

Installed workflow acceptance SHALL exercise the production server with approvals, checks, knowledge and run journals. Recovery MUST retain their evidence and authorization boundaries.

#### Scenario: A failed check returns to the builder

- **WHEN** an installed workflow has an approved check that fails on its first attempt and passes after correction
- **THEN** the builder receives the failing output and the run passes only after the check succeeds

#### Scenario: A later workflow reads the earlier journal

- **WHEN** a workflow finishes and the server restarts before another workflow begins
- **THEN** its journal remains in the project hub
- **AND** the next workflow records reading that journal before building

#### Scenario: A journal retry retains durable lesson references

- **WHEN** journal persistence fails after step lessons were committed and the engine is recreated
- **THEN** retry reconstructs the journal's lesson references from committed blackboard events
- **AND** both passed and refused step lessons remain linked

### Requirement: Readiness requires complete release evidence

A production-readiness claim MUST require complete local verification, installed-package acceptance and all applicable Claude Code and Codex requirements. Unverified live vendor behavior MUST be named explicitly and cannot be described as verified.

#### Scenario: Source tests pass but the package check fails

- **WHEN** source tests pass and the installed knowledge probe rejects the public `scope` field
- **THEN** the release remains blocked until the intended public contract and package acceptance agree

#### Scenario: Applicable product requirements are pending

- **WHEN** required dashboard, installation or workflow acceptance is still pending
- **THEN** the delivery report names the missing behavior and does not declare production readiness
