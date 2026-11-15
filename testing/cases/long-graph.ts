import { LongGraphMode } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const longGraphCases = {
  positive: [
    positive("forty mixed nodes deliver all joined files", [LongGraphMode.Complete, false], true),
    positive(
      "reversed presentation retains live parallel waves",
      [LongGraphMode.Complete, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "left refutation skips descendants and preserves its peer",
      [LongGraphMode.RefuteLeft, false],
      true,
    ),
    rejected(
      "right refutation in reversed graph preserves its peer",
      [LongGraphMode.RefuteRight, true],
      true,
    ),
  ],
};

export const graphBudgetCases = {
  positive: [
    positive("worker releases before the execution budget", [true, false], true),
    positive("checker releases before the execution budget", [false, false], true),
  ],
  negative: [
    rejected("expired budget cancels and drains a held worker", [true, true], true),
    rejected("expired budget cancels and drains a held checker", [false, true], true),
  ],
};
