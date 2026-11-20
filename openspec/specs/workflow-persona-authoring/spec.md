# workflow-persona-authoring Specification

## Purpose

TBD - created by archiving change improve-workspace-agent-experience. Update Purpose after archive.

## Requirements

### Requirement: Discover registered personas

Titan SHALL list reusable persona versions with their scope, lifecycle state and selection reference through a direct persona command.

#### Scenario: Reuse an existing reviewer

- **WHEN** a registered reviewer exists in a selected catalog
- **THEN** the CLI displays its versioned reference and a generated workflow can select that exact definition.

### Requirement: Create portable persona definitions

Titan SHALL create schema-valid persona definitions with selected tools and skills and preserve the existing registration and lifecycle rules when they are used.

#### Scenario: A destination already exists

- **WHEN** a user creates a definition at an existing file
- **THEN** Titan refuses the overwrite and preserves the original bytes.

### Requirement: Create executable workflow templates

Titan SHALL create schema-valid reviewed and parallel workflow templates using selected skills or registered personas and an optional script verification step.

#### Scenario: Generate a parallel delivery

- **WHEN** a user requests a parallel template with a verification command
- **THEN** Titan writes independent work branches, independent checks and a joined script step that passes titan check.
