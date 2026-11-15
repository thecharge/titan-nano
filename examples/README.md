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
