# workspace-run-inspection Specification

## Purpose

TBD - created by archiving change improve-workspace-agent-experience. Update Purpose after archive.

## Requirements

### Requirement: Scoped run listing

Titan SHALL list runs for the current project, the selected home, or all registered homes, with an optional state filter and explicit unavailable-home results.

#### Scenario: Inspect running work across known homes

- **WHEN** two registered homes contain running and passed runs and the user selects all homes and running state
- **THEN** Titan lists the running runs with their owning homes and reports an unavailable third home separately.

### Requirement: Compact run status

Titan SHALL provide compact human and JSON status with step states, attempts, errors, usage availability and waiting request identities, without including file bodies or transcript histories.

#### Scenario: A run contains large managed file observations

- **WHEN** a user requests compact status for that run
- **THEN** the output contains its current step and waiting requests and excludes managed file bytes.

### Requirement: Existing inspection compatibility

Titan SHALL preserve explicit home selection, full run inspection and authenticated dashboard links.

#### Scenario: Inspect an older retained run

- **WHEN** a supported older run is selected through its owning home
- **THEN** full inspection remains available and compact inspection reports missing measurements honestly.

### Requirement: Complete piped JSON output

Titan SHALL finish writing a bounded JSON response to stdout before returning its command exit status.

#### Scenario: Read an event page larger than the output pipe buffer

- **WHEN** the CLI returns a valid page larger than the operating system's pipe buffer
- **THEN** a downstream reader receives the complete JSON document and newline with its original events and continuation cursor.

#### Scenario: The downstream reader closes early

- **WHEN** stdout reports an error while Titan is writing its JSON response
- **THEN** Titan exits with a transport error and reports the write failure on stderr.
