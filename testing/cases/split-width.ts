import { RunStatus } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const splitWidthCases = {
  positive: [
    positive(
      "six parts with width 2 run six workers, two at a time",
      [6, 2, 4],
      `6 2 ${RunStatus.Passed}`,
    ),
    positive(
      "three parts with width 3 run three workers together",
      [3, 3, 4],
      `3 3 ${RunStatus.Passed}`,
    ),
  ],
  negative: [
    rejected(
      "a width above max_parallel never lifts the parallel limit",
      [6, 5, 2],
      `6 2 ${RunStatus.Passed}`,
    ),
    rejected("an empty part list runs no worker", [0, 2, 4], `0 0 ${RunStatus.Passed}`),
    rejected("a missing width falls back to max_parallel", [6, 0, 3], `6 3 ${RunStatus.Passed}`),
    rejected(
      "a part source that is not a list blocks the run",
      [-1, 2, 4],
      `0 0 ${RunStatus.Blocked}`,
    ),
  ],
};
