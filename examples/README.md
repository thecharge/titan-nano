# Checked workflow examples

These examples cover code changes, a science claim, a business plan and an everyday problem. Every worker has an independent reviewer. The business plan has sequential work, two parallel branches and a final dependent step. Its parallel workers write separate files.

| Workflow              | Intended deliverable                                     | Offline answers                     |
| --------------------- | -------------------------------------------------------- | ----------------------------------- |
| code-fix.yaml         | A focused candidate patch, regression test and REVIEW.md | tests/code-fix.answers.yaml         |
| science-claim.yaml    | CLAIM.md with assumptions and a probability derivation   | tests/science-claim.answers.yaml    |
| business-plan.yaml    | Assumptions, demand test, budget and PLAN.md             | tests/business-plan.answers.yaml    |
| everyday-problem.yaml | MOVE.md with a schedule and transport fallback           | tests/everyday-problem.answers.yaml |

The scripted answer documents exercise orchestration, independent verdicts and durable run records. The offline SDK contract suite verifies file writes and native session recovery. Answers are matched by persona, task, logical attempt and physical execution. Missing answers block the run without a quality refutation.

Validate the complete set with `titan check examples/*.yaml`. The shell expands the paths. Human output prints one ok per file. Batch JSON includes schema_version, ok and ordered workflows with each path, revision, nodes and resolved configuration. A single-file JSON check retains its existing shape. The batch accepts at most 256 paths and its JSON output is bounded to 1 MiB. An invalid file identifies its path and stops the batch with exit 2. JSON failure emits one error object. Checks create no server or run.

Each run connects to its home's authenticated background daemon and starts one when needed. From a project containing these examples and their tests directory, run a command.

```sh
titan run examples/code-fix.yaml --harness fake --fake-script tests/code-fix.answers.yaml
titan run examples/science-claim.yaml --harness fake --fake-script tests/science-claim.answers.yaml
titan run examples/business-plan.yaml --harness fake --fake-script tests/business-plan.answers.yaml
titan run examples/everyday-problem.yaml --harness fake --fake-script tests/everyday-problem.answers.yaml
```

Each command watches by default and prints its result.md path after passing. Inspect workflow.yaml, events.jsonl, board.jsonl and the per-step attempt folders beside that result. Repeated submissions receive distinct run ids with the same workflow identity and scripted results. The package includes both examples and answer documents.

For configured local Codex or Claude Code, select `--harness codex` or `--harness claude` and supply the intended project folder. The [project guide](../README.md) leads to installation, owner configuration, tool permissions, isolated candidate files and artifact review.

## Offline restart with Codex and Claude

Run the installed-package check from the source checkout:

```sh
bun run check:package
```

The check needs the local Podman test image. It installs the archive in a temporary folder and runs without network access. The two pinned SDK libraries launch local stand-ins for their vendor commands. The check supplies their paths and uses a fresh Titan home.

The check uses the [installed recovery workflow](installed-recovery.yaml) in an isolated project. It validates and dry-runs the workflow before submitting it. It adds a meeting point so both parallel workers can confirm they are running together. It stops the daemon during a scripted Claude rate limit, then starts a new daemon and resumes the same run. A second run swaps the backends and interrupts the Codex response. Look for `sdk_mixed_restart_cases` in the output.

For a run you manage, keep its run ID and home. Start the same installed Titan release after the daemon stops. Use the ID and home in these commands:

```sh
titan status RUN_ID --compact --home HOME
titan events RUN_ID --home HOME
titan resume RUN_ID --watch --home HOME
titan artifacts list RUN_ID --home HOME --json
titan artifacts show RUN_ID ARTIFACT_ID --home HOME --json
titan artifacts export RUN_ID ARTIFACT_ID --output /absolute/new-review-directory --home HOME --json
```

Choose the file ID from the list. The export writes a copy and its manifest to a new folder. Inspect the copy before applying it. Apply only files and destination paths the person has authorized. If a destination already exists, review the diff and confirm that replacing it is within that permission. The probe copies one file into its temporary project and checks that a second copy refuses to overwrite it.

For the example's `finish.txt`, replace the paths below with the reviewed export and the approved project. Run this only for a new destination file. It fails if the file already exists.

```sh
bun -e 'import { readFile, writeFile } from "node:fs/promises"; await writeFile(process.argv[2], await readFile(process.argv[1]), { flag: "wx" })' /absolute/new-review-directory/files/finish.txt /absolute/approved-project/finish.txt
```
