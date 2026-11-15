import { ErrorCode, RuntimeLimit, ServerQueueField, ServerResourceField } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const runQueueSettingCases = {
  positive: [
    positive(
      "resident runs retain their owner default",
      [ServerResourceField.ResidentRuns, {}],
      RuntimeLimit.ResidentRuns,
    ),
    positive(
      "one resident run is supported",
      [ServerResourceField.ResidentRuns, { max_resident_runs: 1 }],
      1,
    ),
    positive(
      "run operations have an owner default",
      [ServerQueueField.Runs, {}],
      RuntimeLimit.PendingOperations,
    ),
    positive(
      "submissions have an owner default",
      [ServerQueueField.Submissions, {}],
      RuntimeLimit.PendingOperations,
    ),
    positive(
      "one run operation is supported",
      [ServerQueueField.Runs, { max_pending_run_operations: 1 }],
      1,
    ),
    positive(
      "one submission is supported",
      [ServerQueueField.Submissions, { max_pending_submissions: 1 }],
      1,
    ),
  ],
  negative: [
    negative(
      "zero residency is refused",
      [ServerResourceField.ResidentRuns, { max_resident_runs: 0 }],
      { code: ErrorCode.InvalidConfig },
    ),
    negative(
      "excessive residency is refused",
      [ServerResourceField.ResidentRuns, { max_resident_runs: RuntimeLimit.ResidentRuns + 1 }],
      { code: ErrorCode.InvalidConfig },
    ),
    negative(
      "fractional residency is refused",
      [ServerResourceField.ResidentRuns, { max_resident_runs: 1.5 }],
      { code: ErrorCode.InvalidConfig },
    ),
    negative(
      "project cannot replace resident capacity",
      [ServerResourceField.ResidentRuns, { max_resident_runs: 1 }, false],
      { code: ErrorCode.OwnerSetting },
    ),
    negative(
      "zero run queue is refused",
      [ServerQueueField.Runs, { max_pending_run_operations: 0 }],
      { code: ErrorCode.InvalidConfig },
    ),
    negative(
      "excessive run queue is refused",
      [ServerQueueField.Runs, { max_pending_run_operations: RuntimeLimit.PendingOperations + 1 }],
      { code: ErrorCode.InvalidConfig },
    ),
    negative(
      "fractional submission queue is refused",
      [ServerQueueField.Submissions, { max_pending_submissions: 1.5 }],
      { code: ErrorCode.InvalidConfig },
    ),
    negative(
      "text submission queue is refused",
      [ServerQueueField.Submissions, { max_pending_submissions: "2" }],
      { code: ErrorCode.InvalidConfig },
    ),
    negative(
      "project cannot lower run queue",
      [ServerQueueField.Runs, { max_pending_run_operations: 1 }, false],
      { code: ErrorCode.OwnerSetting },
    ),
    negative(
      "project cannot raise submission queue",
      [
        ServerQueueField.Submissions,
        { max_pending_submissions: RuntimeLimit.PendingOperations },
        false,
      ],
      { code: ErrorCode.OwnerSetting },
    ),
  ],
};

export const runQueueCapacityCases = {
  positive: [
    positive("two run operation entries admit an independent opening", [2, false], true),
    positive("two run operation entries admit an independent answer", [2, true], true),
  ],
  negative: [
    rejected("one run operation refuses a peer opening then recovers", [1, false], true),
    rejected("one run operation refuses a peer answer then recovers", [1, true], true),
  ],
};

export const submissionQueueCapacityCases = {
  positive: [
    positive("two submission entries admit a peer during creation", [2, false], true),
    positive("reversed submission names retain independent admission", [2, true], true),
  ],
  negative: [
    rejected("one submission entry refuses a peer then admits retry", [1, false], true),
    rejected("reversed submission saturation retains retry identity", [1, true], true),
    rejected("minimum run and submission budgets admit creation and retry", [1, false, 1], true),
    rejected("reversed minimum budgets preserve submission identity", [1, true, 1], true),
  ],
};
