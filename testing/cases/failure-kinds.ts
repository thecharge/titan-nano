import { FailureKind, StepStatus } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const failureKindCountsCases = {
  positive: [
    positive(
      "two repetitions and one incomplete verification are counted",
      [
        [
          FailureKind.StepRepetition,
          FailureKind.StepRepetition,
          FailureKind.IncompleteVerification,
        ],
      ],
      `${FailureKind.StepRepetition}: 2,${FailureKind.IncompleteVerification}: 1`,
    ),
    positive("a single other kind is counted", [[FailureKind.Other]], `${FailureKind.Other}: 1`),
  ],
  negative: [
    rejected("refutations without a kind list nothing", [[null, null]], ""),
    rejected("one refutation without a kind lists nothing", [[null]], ""),
  ],
};

export const failureKindAnswerCases = {
  positive: [
    positive(
      "a known kind keeps the verdict and the next attempt runs",
      [FailureKind.DisobeyTask],
      `${StepStatus.Passed}|2|2`,
    ),
    positive(
      "the other kind keeps the verdict and the next attempt runs",
      [FailureKind.Other],
      `${StepStatus.Passed}|2|2`,
    ),
  ],
  negative: [
    rejected(
      "an unknown kind is asked again on the same attempt",
      ["bad-vibes"],
      `${StepStatus.Passed}|1|2`,
    ),
    rejected(
      "another unknown kind is asked again on the same attempt",
      ["other-vibes"],
      `${StepStatus.Passed}|1|2`,
    ),
  ],
};
