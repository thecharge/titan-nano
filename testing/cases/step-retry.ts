import { StepStatus } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const survivesOnSecondAttemptCases = {
  positive: [
    positive(
      "second task carries the evidence and the step passes",
      ["fails for an empty list", 3],
      `${StepStatus.Passed}|2|true`,
    ),
    positive(
      "a different piece of evidence is carried the same way",
      ["off by one at the end", 2],
      `${StepStatus.Passed}|2|true`,
    ),
  ],
  negative: [
    rejected(
      "one permitted attempt fails with no second task",
      ["fails for an empty list", 1],
      `${StepStatus.Failed}|1|false`,
    ),
    rejected(
      "one permitted attempt fails whatever the evidence",
      ["off by one at the end", 1],
      `${StepStatus.Failed}|1|false`,
    ),
  ],
};

export const neverSurvivesCases = {
  positive: [
    positive(
      "three refuted attempts fail the step with the third evidence",
      [3, 3],
      `${StepStatus.Failed}|3|true`,
    ),
    positive(
      "two refuted attempts fail a step limited to two",
      [2, 2],
      `${StepStatus.Failed}|2|true`,
    ),
  ],
  negative: [
    rejected(
      "a survivor on the third attempt passes with no third evidence",
      [3, 2],
      `${StepStatus.Passed}|3|false`,
    ),
    rejected(
      "a survivor on the second attempt passes with no second evidence",
      [2, 1],
      `${StepStatus.Passed}|2|false`,
    ),
  ],
};
