import { positive, rejected } from "@titan/test-factories";

export const workerStepListCases = {
  positive: [
    positive(
      "agent for fix sees cause passed, fix running and review pending",
      [["cause", "fix", "review"], 1],
      "true false",
    ),
    positive(
      "agent for the second of two steps sees the first passed and itself running",
      [["lint", "build"], 1],
      "true false",
    ),
  ],
  negative: [
    rejected(
      "falsifier of the first step holds none of the later step ids",
      [["cause", "fix", "review"], 0],
      "true false",
    ),
    rejected(
      "falsifier of the last step holds none of the earlier step ids",
      [["cause", "fix", "review"], 2],
      "true false",
    ),
  ],
};
