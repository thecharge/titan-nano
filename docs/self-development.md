# Inspect the Titan self-development run

The repository retains a [sanitized export of run 5306657b-61fe-4294-8c5a-9adfdc53caa6](examples/self-development/README.md). It includes the executed workflow, journal, state, reviewer outcomes and script results. Session identifiers are deterministic aliases, paths describe a generic workspace and usage totals are omitted. The public export is for file inspection. Recovery requires the private original records, full workspace snapshots and matching runtime.

Read the [delivery evidence](../openspec/changes/repair-harness-delivery/evidence.md#2026-11-15-self-development-delivery-and-readiness-audit) for the delivered implementation and observed verification.

## Inspect the published files

Run these commands from the repository root.

```sh
cat docs/examples/self-development/record.json
cat docs/examples/self-development/result.md
sed -n '1,80p' docs/examples/self-development/events.jsonl
```

The plan is `.titan-delivery/self-development-codex.yaml`. It starts two Codex tasks in parallel:

- `repair_bun_version` fixes the Bun prerequisite version check and adds regression cases. An independent reviewer looks for counterexamples and checks that the cases are registered.
- `write_inspection_guide` writes this guide. A different independent reviewer checks the commands against the CLI and looks for omissions or unsupported claims.

Both reviewers inspect the work without editing files and record their verdicts. Once both branches pass their reviews, `verify_delivered_files` runs type checking, documentation and link checks, a targeted Git diff check, and a check that the regression test file is nonempty. Its independent script checks that the guide and case support files are nonempty and runs `git diff --check` across the working tree.

Workers, reviewers, and scripts use the same live source tree. Worker edits reach the working tree as they happen. Declared file paths coordinate work. Titan keeps candidate snapshots as evidence of what workers delivered and reviewers inspected.

## Inspect a run you execute locally

Replace `RUN_ID` with your run identifier and set `TITAN_RUN_HOME` to the controller home used at submission.

```sh
TITAN=titan
TITAN_RUN_HOME=/path/to/controller-home
RUN_ID=RUN_ID

"$TITAN" status "$RUN_ID" --home "$TITAN_RUN_HOME"
"$TITAN" events "$RUN_ID" --home "$TITAN_RUN_HOME" --after 0 --limit 100
"$TITAN" artifacts "$RUN_ID" --home "$TITAN_RUN_HOME" --json
"$TITAN" usage "$RUN_ID" --home "$TITAN_RUN_HOME" --json
"$TITAN" requests --run-id "$RUN_ID" --home "$TITAN_RUN_HOME"
"$TITAN" dashboard --home "$TITAN_RUN_HOME"
```

Use status and events to follow the steps and reviewer verdicts. Continue paging through events by passing the last event cursor as `--after`. Usage reports include completeness flags for totals. Requests show whether a decision is waiting. For the dashboard, open the one-time link and select `RUN_ID` from the run list.

When verified artifacts are available, use the artifact report or the dashboard's **Verified artifacts** view to find the retained output for `verify_delivered_files`. Inspect the independent check under the step's evidence in the dashboard. A pending step is still awaiting a result. Report a run pass only after status confirms successful completion and the retained evidence shows the checks that ran.

## Review the live changes

Run these commands from the project directory. The first shows status for the declared files. The second shows tracked working-tree changes relative to `HEAD`, including staged changes.

```sh
git status --short -- apps/cli/src/prerequisites.ts \
  testing/cases/prerequisite-version.ts testing/factories/prerequisite-version.ts \
  testing/unit/prerequisite-version.test.ts docs/self-development.md
git diff HEAD -- apps/cli/src/prerequisites.ts \
  testing/cases/prerequisite-version.ts testing/factories/prerequisite-version.ts \
  testing/unit/prerequisite-version.test.ts docs/self-development.md
```

For a new file marked `??`, use `git diff --no-index -- /dev/null PATH`, replacing `PATH` with the file path. Exit status 1 means the two inputs differ. Compare the live diff with the retained evidence when attributing changes to this run, since the live tree can contain earlier or concurrent edits.
