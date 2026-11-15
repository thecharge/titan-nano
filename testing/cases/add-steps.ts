import { positive, rejected } from "@titan/test-factories";

export const addStepsCases = {
  positive: [
    positive(
      "three checked steps from a surviving result are added",
      [3, true, true],
      "4|s1,s1,s1|0|0",
    ),
    positive("one checked step from a surviving result is added", [1, true, true], "2|s1|0|0"),
  ],
  negative: [
    rejected("steps without a falsifier are refused and none added", [2, false, true], "1||1|0"),
    rejected("steps from a refuted result are dropped and none added", [3, true, false], "1||0|1"),
  ],
};
