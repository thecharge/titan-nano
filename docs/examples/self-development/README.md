# Sanitized Codex self-development run

Run `5306657b-61fe-4294-8c5a-9adfdc53caa6` passed using the real Codex SDK backend. Two workers and their independent reviewers produced a runtime version-check repair and an inspection guide. The workflow includes a parallel group and a following script step with its own check.

This publication export replaces personal filesystem paths with generic paths and native session identifiers with deterministic UUID aliases. Usage totals are omitted. JSON records and journal bytes were rewritten for publication. Original execution fingerprints retained inside the records describe the private execution. The public export supports file inspection. Recovery requires the private originals and their creating runtime.

## Files

- `record.json` contains the timeline, aliases, recovery history and public file digests.
- `board.jsonl` and `events.jsonl` contain the sanitized journal.
- `state.json` contains the sanitized final checkpoint.
- `result.md`, `proofs.json` and `script-check.json` retain the step outcomes and script evidence.
- `workflow.yaml` contains the executed workflow with sanitized paths.
- `artifacts.json` retains the declared output paths from the private manifest. Unrelated workspace filenames are omitted. Its original hashes describe the private bytes.

The earlier run recorded in `record.json` started both workers concurrently. Snapshot conflicts required resuming the guide after the code review. A manual reviewer-schema repair was also needed. The candidate patch is retained at `.titan-delivery/self-development.patch` relative to the repository root, with personal paths sanitized.

## Subsequent delivery

The delivered implementation passed 6,882 tests with zero failures, one skipped live gate and zero measured coverage gaps across 485 product sources. Installed-package acceptance also passed. Read the [delivery evidence](../../../openspec/changes/archive/2026-11-16-repair-harness-delivery/evidence.md#2026-11-15-self-development-delivery-and-readiness-audit) for the observed results and remaining production requirements.
