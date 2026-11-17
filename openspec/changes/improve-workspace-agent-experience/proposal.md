## Why

People and agents need ordinary Titan commands to inspect work, reuse existing skills and personas, and prepare workflows. Current gaps lead callers to maintain private scripts and copy instructions into every workflow.

## What Changes

- Add concise run inspection and project, selected-home and known-home listing with state filters.
- Discover repository and user skills, show their origins, and supply selected instructions and references to real Codex and Claude executions.
- Provide bounded public web reads through the existing resource approval mechanism and retain source evidence.
- Create valid workflows and persona definitions through supported commands.
- List reusable persona versions directly and show how a workflow uses its registered versions.
- Cover these entry points with regression checks and plain-English documentation.
- Exercise delivery through a real Titan workflow using synthetic public-safe task context.

## Capabilities

### New Capabilities

- `workspace-run-inspection`: provides concise local and known-home run inspection.
- `workspace-skill-discovery`: discovers and supplies repository and user skills.
- `agent-web-resources`: retrieves public source material under existing resource policy.
- `workflow-persona-authoring`: creates workflows and supports visible persona reuse.

### Modified Capabilities

No changes to the two archived baseline capability contracts are required. This change extends the active product design.

## Impact

The command-line app, read-only dashboard where needed, native tool bridge, runner, workspace capture and persona knowledge interfaces are affected. Existing run records and explicit home selectors remain supported. The Apache license and dependencies' licensing remain unchanged. Fixtures, examples and delivery evidence use synthetic projects only. Private sibling repositories and their contents stay outside this change.
