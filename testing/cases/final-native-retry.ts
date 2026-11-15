import { positive, rejected } from "@titan/test-factories";

export const finalAttemptRetryCases = {
  positive: [
    positive(
      "final worker rate limit recovers without another result attempt",
      [true, false],
      true,
    ),
    positive("final checker rate limit keeps its completed candidate", [false, false], true),
  ],
  negative: [
    rejected("final worker with no recovery allowance retains its retry date", [true, true], true),
    rejected(
      "final checker with no recovery allowance retains its retry date",
      [false, true],
      true,
    ),
  ],
};
