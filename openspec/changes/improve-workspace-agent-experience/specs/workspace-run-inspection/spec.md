## ADDED Requirements

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
