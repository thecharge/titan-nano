import { RunAction } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const claudeBackoffCases = {
  positive: [
    positive(
      "Claude worker backoff survives SIGKILL without spending a retry",
      [true, RunAction.Resume],
      true,
    ),
    positive(
      "Claude checker backoff survives SIGKILL without spending a retry",
      [false, RunAction.Resume],
      true,
    ),
    positive("Claude worker backoff pauses through the daemon", [true, RunAction.Pause], true),
    positive("Claude checker backoff pauses through the daemon", [false, RunAction.Pause], true),
  ],
  negative: [
    rejected(
      "cancelled Claude worker cannot start a scheduled retry",
      [true, RunAction.Cancel],
      true,
    ),
    rejected(
      "cancelled Claude checker cannot start a scheduled retry",
      [false, RunAction.Cancel],
      true,
    ),
  ],
};
