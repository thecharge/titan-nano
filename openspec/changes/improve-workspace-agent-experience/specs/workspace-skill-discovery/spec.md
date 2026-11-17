## ADDED Requirements

### Requirement: Repository and user skill discovery

Titan SHALL discover canonical repository and configured user skills and show each selected skill's name, description, origin and duplicate resolution.

#### Scenario: A project overrides a user skill

- **WHEN** the project and user directories both define a skill named review
- **THEN** the project definition is selected and both origins can be inspected.

### Requirement: Native skill access

Titan SHALL supply selected persona skills and bounded reference reads to real Codex and Claude executions through a common execution-bound interface.

#### Scenario: A worker follows a linked repository skill

- **WHEN** a persona selects a skill linked to its canonical repository directory
- **THEN** the worker receives the skill instructions and can read its contained reference file through Titan.

#### Scenario: A reference escapes its skill directory

- **WHEN** a worker requests a reference whose canonical path escapes the permitted skill root
- **THEN** Titan refuses the read with a useful error.

### Requirement: Retained skill evidence

Titan SHALL retain the selected skill content and hashes for a run and resume with that recorded version.

#### Scenario: The live skill changes during a paused run

- **WHEN** the run resumes after its selected skill file changes
- **THEN** its retained instructions remain identifiable and its recorded hash still describes the instructions used.
