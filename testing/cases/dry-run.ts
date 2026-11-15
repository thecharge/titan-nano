import { ErrorCode } from "@titan/constants";
import { negative, positive } from "@titan/test-factories";

export const dryRunCases = {
  positive: [
    positive(
      "two candidates, three attempts, two falsifiers and a judge give nineteen agents",
      [2, 3, 2, true, 1, 50],
      "static plan: at most 19 agents|agents can add up to 49 more steps",
    ),
    positive(
      "one candidate without judge counts the worker and one falsifier per attempt",
      [1, 2, 1, false, 2, 10],
      "static plan: at most 8 agents|agents can add up to 8 more steps",
    ),
  ],
  negative: [
    negative(
      "plan above max_steps is refused before any count is printed",
      [1, 1, 1, false, 2, 1],
      {
        code: ErrorCode.StepLimit,
      },
    ),
    negative("zero candidates are refused by the workflow check", [0, 1, 1, false, 1, 50], {
      code: ErrorCode.InvalidWorkflow,
    }),
  ],
};
