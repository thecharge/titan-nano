import { ImproveLoopMessage } from "@titan/messages";
import { negative, positive } from "@titan/test-factories";

export const improveRuntimeCases = {
  positive: [
    positive(
      "the runtime entry point reads the earlier run and refuses when no rounds are set",
      [false, undefined, undefined],
      ImproveLoopMessage.RoundsMissing,
    ),
    positive(
      "a persona flag alone does not set rounds",
      [false, undefined, "improver"],
      ImproveLoopMessage.RoundsMissing,
    ),
  ],
  negative: [
    negative("a run folder that does not exist is refused", [true, 1, undefined], {}),
    negative(
      "the runtime fake backend has no script for the improver turn",
      [false, 1, "improver"],
      {},
    ),
  ],
};
