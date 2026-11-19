## Context

The existing CLI lists runs from one engine home and returns a full run snapshot for status. Full snapshots include managed file observations and become large. The dashboard already has filtering and run detail pages. Persona registration and versioned reuse exist in the knowledge hub. Persona schemas accept skill names, while execution does not supply their contents.

A home is an engine's local data directory. A skill is a directory containing SKILL.md and optional references. A persona is a reusable agent definition. A resource approval is Titan's existing recorded decision to permit an external input.

## Goals / Non-Goals

The delivery covers ordinary CLI inspection, skill discovery and execution, public resource reads, authoring commands and visible persona reuse. Public fixtures must demonstrate the behavior through the normal command and native tool entry points. The sibling editorial work remains a separate private delivery.

## Decisions

### Inspect runs through supported projections

Add compact status output that contains step state, attempts, current errors, usage availability and waiting requests. Keep full inspection available explicitly and preserve existing JSON callers. Listing supports the current project, the selected home and all registered homes. Record homes when used through the CLI. Report unavailable homes individually. Reuse existing authenticated clients and dashboard routes. A registry provides predictable discovery without searching arbitrary directories.

### Discover skills at the selected project and user scope

Recognize .agents/skills, .codex/skills and .claude/skills and the corresponding configured user directories. Project definitions take precedence over user definitions. Show origin and duplicate resolution. Support ordinary skill links to canonical repository definitions with containment checks. Discover an index automatically, resolve explicit persona skill names, and provide execution-bound reads for skill instructions and references. Record hashes and selected content with the run so resume uses the same instructions. This replaces copied skill text with a built-in resolution path.

### Acquire web input through the resource policy

Provide public HTTPS reads as a native tool and a CLI command. Apply the existing resource approval setting and recorded requests. Explicit owner policy can permit autonomous reads. Retain requested and final URLs, retrieval time, media type, digest and real failure information. Use central bounds for bytes, time and redirects. Recheck each redirect destination. Keep acquisition distinct from a supported factual claim and report binary extraction limits.

### Extend existing persona and workflow services

Provide persona listing and portable definition creation through the CLI. Show registered versions and workflow references, and use the existing registration and lifecycle rules. A workflow creation command writes valid reviewed or parallel templates with optional script verification and selected skills or persona references. Writes refuse existing destinations. Reuse the workflow schema and existing examples.

### Deliver using Titan itself

Use a separate local engine home and a retained baseline runtime. Workers edit the shared source tree. The workflow implements the capabilities, independently challenges them, and runs local verification through an approved script step. Evidence uses synthetic projects and generic descriptions. The existing unrelated untracked integration test is preserved.

## Risks / Trade-offs

Skill links and references can escape an intended root. Resolve canonical paths and test permitted links and refused escapes. Home discovery can encounter an offline or incompatible runtime. Report that home's failure while preserving other results. Web sources can fail or redirect. Retain observed failures and bound each request. Concurrent source edits can invalidate a retained result. Keep implementation writes coordinated through Titan and retain reconciliation evidence.

## Migration Plan

Add optional compatible stored fields and keep older records readable. Build and check the installed package as well as source entry points. Run the repository's required local gate and hooks. Verify GitHub Actions remains disabled before the authorized push to main. Record the pushed revision and actual acceptance results.

## Open Questions

Implementation must confirm where selected skill snapshots belong in the existing retained execution input. It must also verify the current persona catalog scopes before choosing public command defaults. These are source-level integration decisions within this change.

## Execution defects found during delivery

The real delivery exposed missing-path errno loss, executable argument rewriting under the identity host-root mapping, and private temporary FIFO fixture rejection. The pinned source patch must preserve write confinement and device refusal while correcting those cases. Ordinary script actions need an explicit bounded deadline, and script proofs need a write claim when their declared verification output changes. Preserve retained results and independently check output changes before acceptance. All corrections keep current dependency versions and licensing.

## Native command telemetry

A real repository search returned about 8 MB of historical run records. The raw Codex command event exceeded the one-MiB host frame and repeated on resume. Bound command/output telemetry excerpts before the host boundary. Preserve the original UTF-8 byte count and SHA-256 in the excerpt notice. Leave final answers, usage, command status, native session identity and frame refusal unchanged. Retained telemetry is explicitly partial. Test ordinary, large, UTF-8 and JSON-escaped output across new and resumed sessions.

## Offline skill preflight

Check and dry run resolve the same declared skill names and bounded files as run admission. JSON reports each persona’s selection, the skill origins and file hashes. It omits file contents. Admission still retains and validates its own input, since the workspace can change after a check. Normal submission keeps its existing retry behavior. A successful check confirms which inputs can be supplied. It cannot grade what a model learned from them.
