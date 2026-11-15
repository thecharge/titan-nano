import { positive, rejected } from "@titan/test-factories";

export const improveLoopCases = {
  positive: [
    positive(
      "round 3 does not run after round 2 keeps nothing",
      [3, [4, 9], true],
      "2|2|plan.v2.yaml,plan.yaml|true|2|plan.v2.yaml,none",
    ),
    positive(
      "round 2 starts from the file kept in round 1 and saves the next version",
      [2, [4, 3], true],
      "2|2|plan.v2.yaml,plan.v3.yaml,plan.yaml|true|2|plan.v2.yaml,plan.v3.yaml",
    ),
  ],
  negative: [
    rejected(
      "a new file the schema refuses stops the loop before any run",
      [3, [], false],
      "1|0|plan.yaml|false|1|none",
    ),
    rejected(
      "a new run with more attempts keeps the old file and stops the loop",
      [3, [9], true],
      "1|1|plan.yaml|false|1|none",
    ),
  ],
};
