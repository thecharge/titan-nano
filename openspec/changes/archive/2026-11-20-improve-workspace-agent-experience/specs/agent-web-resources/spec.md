## ADDED Requirements

### Requirement: Policy-controlled public source reads

Titan SHALL expose bounded public HTTPS resource reads to native agents and the CLI using the existing resource approval policy.

#### Scenario: Approval is required

- **WHEN** a worker asks for a source under person-controlled resource policy
- **THEN** Titan records a request identifying the URL and continues acquisition after its authorized answer.

#### Scenario: Autonomous reads are configured

- **WHEN** the effective owner policy permits a public source read
- **THEN** the worker can receive that source without an additional person prompt.

### Requirement: Source acquisition evidence

Titan SHALL retain the requested URL, final URL, status, retrieval time, media type, content digest and actual acquisition failures.

#### Scenario: A source redirects

- **WHEN** an allowed source redirects to another permitted public HTTPS destination
- **THEN** Titan checks the destination and records both URLs with the returned content evidence.

### Requirement: Bounded resource handling

Titan SHALL enforce central byte, timeout and redirect bounds and refuse private destinations or embedded credentials.

#### Scenario: A source exceeds its byte allowance

- **WHEN** the response exceeds the configured supported bound
- **THEN** Titan stops reading and reports the observed failure without recording successful source content.

#### Scenario: Binary source text is unavailable

- **WHEN** the acquired resource requires unsupported binary text extraction
- **THEN** Titan identifies the media type and extraction limit explicitly.
