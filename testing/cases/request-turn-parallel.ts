import { positive, rejected } from "@titan/test-factories";

export const requestTurnParallelCases = {
  positive: [
    positive(
      "parallel Codex and Claude workers continue independently across restart",
      [false, false],
      true,
    ),
    positive(
      "parallel Codex and Claude checkers continue independently in reverse order",
      [true, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "unanswered parallel workers cannot spend executions or release their join",
      [false, true],
      true,
    ),
    rejected(
      "unanswered parallel checkers cannot spend executions or release their join",
      [true, true],
      true,
    ),
  ],
};
