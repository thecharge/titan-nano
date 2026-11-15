import { RunAction } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const claudeBackoffBranchCases = {
  positive: [
    positive(
      "Codex branch survives daemon death during Claude worker backoff",
      [true, RunAction.Resume],
      true,
    ),
    positive(
      "Codex branch survives daemon death during Claude checker backoff",
      [false, RunAction.Resume],
      true,
    ),
  ],
  negative: [
    rejected(
      "cancelled Claude worker cannot release a mixed native join",
      [true, RunAction.Cancel],
      true,
    ),
    rejected(
      "cancelled Claude checker cannot release a mixed native join",
      [false, RunAction.Cancel],
      true,
    ),
  ],
};
