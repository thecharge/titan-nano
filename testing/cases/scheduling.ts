import { TestSchedule } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const schedulingProbeCases = {
  positive: [
    positive("isolated cases overlap within the runner cap", [TestSchedule.Concurrent, false], {
      code: 0,
      peak: 8,
      active: 0,
      completed: 12,
    }),
    positive("ordinary cases retain serial execution", [TestSchedule.Sequential, false], {
      code: 0,
      peak: 1,
      active: 0,
      completed: 12,
    }),
  ],
  negative: [
    rejected(
      "isolated failure drains all cases and fails the runner",
      [TestSchedule.Concurrent, true],
      { code: 1, peak: 8, active: 0, completed: 12 },
    ),
    rejected("serial failure cannot become a passing run", [TestSchedule.Sequential, true], {
      code: 1,
      peak: 1,
      active: 0,
      completed: 12,
    }),
  ],
};
