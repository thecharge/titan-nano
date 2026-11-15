# Titan effectiveness comparison protocol

Status: proposed protocol, not an executed benchmark. This document defines the comparison required by design decision 36 and task 25.15. No outcome or effectiveness claim follows from it.

## Decision and scope

Measure whether Titan produces more correct results, or equivalent correctness with lower elapsed time or paid cost, on bounded tasks. Compare three arms:

| Arm            | Behavior                                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Single agent   | One agent session with the supplied goal, tools and full allowance.                                                          |
| Fixed Titan    | A reviewed workflow with fixed roles, checks and widths. No learned choices or improvement rounds.                           |
| Adaptive Titan | The same starting workflow with the policy and optional improvement enabled. All overhead counts against the same allowance. |

Use the same pinned backend, model, tool versions and supplied source files in all arms. A mixed-backend comparison is a separate protocol version. Run order must be shuffled and recorded. No arm may see another arm's outputs or the independent check answers.

## Task set

Create immutable fixture bundles for these tasks before the protocol is frozen. These are synthetic cases. They make no claims about real prices, scientific measurements or businesses.

| Task                          | Supplied input                                             | Independent correctness gate                                                                    |
| ----------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Code: empty input             | A small repository with a failing empty-list case          | Hidden boundary tests and existing tests pass.                                                  |
| Code: date boundary           | A repository whose UTC and local-date behavior differ      | Fixed timezone and date fixtures pass.                                                          |
| Code: parser                  | A parser with escaped delimiters and Unicode cases         | Hidden valid and invalid input cases pass.                                                      |
| Science: confounding          | A table whose subgroup and aggregate rates differ          | Answer distinguishes association from the unsupported causal claim and gives the checked rates. |
| Science: uncertainty          | A noisy measurement table and a proposed exact claim       | Answer reports the defined uncertainty calculation and refuses the unsupported exact claim.     |
| Science: inconsistent sources | Two supplied reports with incompatible units               | Answer identifies the unit conflict and does not combine incomparable values.                   |
| Business: capacity            | A synthetic demand and capacity table                      | Proposed plan meets all supplied constraints; arithmetic matches the independent calculator.    |
| Business: cost                | A cost table including fixed and marginal charges          | Calculated totals and selected feasible plan match the supplied objective.                      |
| Business: missing data        | A plan request with one missing decision-critical quantity | Answer asks for that quantity or gives explicitly conditional alternatives.                     |
| Everyday: move                | Synthetic listings, fees and a fixed budget                | Plan includes all mandatory fees and meets the budget or reports infeasibility.                 |
| Everyday: schedule            | Appointments with overlapping intervals and travel times   | Schedule violates no interval, dependency or travel constraint.                                 |
| Everyday: conflicting request | A request with incompatible mandatory conditions           | Answer identifies the conflict and does not claim a feasible solution.                          |

Each bundle must hold its goal, visible inputs, permitted tools, output schema and file hashes. Its independent rubric and hidden checks must be prepared by a reviewer outside the evaluated workflow. Check tasks must not call uncontrolled external sources.

## Trials and allowances

Start with 5 independent trials per task and arm. The 12 tasks, 5 repeats and the allowances below are design guesses, not a power calculation. This is an exploratory comparison. It cannot establish general superiority across domains.

Each trial gets a proposed ceiling of 15 minutes, 60000 model tokens and 8 started sessions. These ceilings are guesses to validate in a separate feasibility pilot before freezing this protocol. The single-agent arm still uses one session. Both Titan arms count planning, workers, reviewers and improvement sessions within their ceiling. Paid calls also require the person's separate authorization and a recorded monetary ceiling before execution.

A feasibility pilot must use disjoint tasks. Do not use scored tasks to tune budgets or policies. Record the pilot and any protocol revision before examining scored outcomes. A scored timeout, malformed answer or exceeded allowance is a failure, not a silently discarded trial.

Each trial starts in a fresh project copy and `TITAN_HOME`. For the initial cold-start comparison, reset policies and knowledge between trials. A later warm-start study must define its training tasks and evaluation separation in a new version. Never train on the hidden checks.

## Measurements and gates

Record correctness for each independent check, overall task pass, elapsed wall time, human or main-agent waiting time, active execution time, tokens and cost. Include planning and improvement overhead. Save errors, cancellations and unknown remote states. Missing usage remains missing; partial cost must not be treated as total cost.

Compare paired task trials. Publish raw trial records, per-task results and the full distribution, including failures. Report uncertainty for pass rates and paired time and cost differences. State the interval method before freezing; use a paired bootstrap with 10000 resamples and a 95 percent interval as the initial proposal. These analysis settings are choices awaiting statistical review, not measured guarantees.

Promotion requires all of the following:

- Every safety and permission gate passes. A higher reward cannot override a failed gate.
- The adaptive arm passes every mandatory correctness check that the fixed arm passes on the paired trial. Report comparisons with the single-agent arm separately.
- Any claimed time or cost benefit has an interval excluding no improvement on the predeclared measure. Cost claims require complete cost data.
- The report includes planning and improvement overhead and names the supported task and backend scope.

An inconclusive result keeps learning experimental. A negative result is published as negative evidence. Increasing sample size or changing the rubric after looking at results requires a new protocol version and fresh evaluation data.

## Freeze and execution record

Task 25.15 remains open until the fixture bundles, hidden checks, final allowances, interval method and version hashes exist and have independent review. Freeze those hashes and the protocol in a tracked record before any scored run. Task 25.16 remains open until authorized runs and their report exist.

For each trial, record protocol version, task hash, arm, seed, run order, pinned versions, approvals, allowances, raw result path, check outcomes and complete or missing usage. This protocol does not authorize paid calls, publishing or external messages.
