import { ConcurrentWorkflowFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const concurrentWorkflowIsolationCases = {
  positive: [
    positive(
      "one project retains two overlapping callers and boards",
      [ConcurrentWorkflowFixture.SharedProject],
      true,
    ),
    positive(
      "separate projects retain their independent goals and records",
      [ConcurrentWorkflowFixture.SeparateProjects],
      true,
    ),
  ],
  negative: [
    rejected(
      "targeted cancellation preserves the other active workflow",
      [ConcurrentWorkflowFixture.Cancel],
      true,
    ),
    rejected(
      "an operational stop preserves its peer and quality counters",
      [ConcurrentWorkflowFixture.OperationalStop],
      true,
    ),
  ],
};
