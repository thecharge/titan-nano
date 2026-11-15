import { positive, rejected } from "@titan/test-factories";

export const ciTestFailureCases = {
  positive: [
    positive(
      "a passing worker test keeps the gate successful",
      [false, "worker delivery fixture"],
      0,
    ),
    positive(
      "a passing checker test keeps the gate successful",
      [false, "checker evidence fixture"],
      0,
    ),
  ],
  negative: [
    rejected(
      "a failing worker test fails the gate and retains its name",
      [true, "worker delivery failure"],
      1,
    ),
    rejected(
      "a failing checker test fails the gate and retains its name",
      [true, "checker evidence failure"],
      1,
    ),
  ],
};
