# script-sandbox-distribution Specification

## Purpose

Preserve the owner's Apache-2.0 distribution requirement, shared live filesystem containment and reproducible verification of the delivered script sandbox.

## Requirements

### Requirement: Owner-controlled Apache distribution

Titan MUST retain Apache-2.0. The repair MUST replace the rejected GPL helper and remove its packaged artifacts. The implementation MUST follow the owner's existing replacement authorization.

#### Scenario: Distribution excludes the rejected helper

- **WHEN** a Linux release archive is produced
- **THEN** it contains no Syd executable, Syd source archive or Syd license artifact
- **AND** its component inventory identifies the source and terms of the replacement

#### Scenario: Existing replacement authorization is applied

- **WHEN** the owner has required Apache-2.0 and directed replacement of the GPL helper
- **THEN** the repair proceeds under that authorization without introducing an approval requirement to retain the rejected helper

### Requirement: Preserve shared filesystem containment

The replacement MUST enforce the existing script file claims against the shared live filesystem for the script and its descendants. It MUST preserve missing-file and missing-parent creation, private temporary storage and protected project metadata.

#### Scenario: Missing claimed file is created live

- **WHEN** an approved script claims `generated/deep/note.txt` and its parents are absent
- **THEN** the script can create those parents and that file on the shared filesystem
- **AND** it cannot create an unclaimed sibling

#### Scenario: Mutation flags cannot bypass a read claim

- **WHEN** a script opens an outside file with read-only access and a truncation flag
- **THEN** the operation is refused
- **AND** the outside file retains its original contents and permissions

#### Scenario: New protected names remain protected

- **WHEN** a root-scoped script attempts to create `.env.test` or `nested/.env`
- **THEN** both operations are refused
- **AND** ordinary claimed files remain writable

#### Scenario: Descendants keep the same boundary

- **WHEN** an approved script starts a child command that writes outside its claim
- **THEN** the write is refused and the outside file remains unchanged

### Requirement: Reproducible package verification

The repair MUST verify the actual release archive and its installed execution path. A blocking check MUST reject the removed helper and missing or inconsistent component inventories.

#### Scenario: Removed helper is reintroduced

- **WHEN** a package fixture contains the Syd executable or source archive
- **THEN** the distribution check fails

#### Scenario: Installed package preserves the boundary

- **WHEN** the release archive is installed in a disposable directory
- **THEN** its approved-script and read-claim cases pass through the installed command
- **AND** the package contains the recorded replacement identity and required notices
