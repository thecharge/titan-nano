import { ErrorCode, RunStatus, ServerTornCheck } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const serverTornCases = {
  positive: [
    positive(
      "incomplete tail is discarded and the run replays",
      [ServerTornCheck.State],
      RunStatus.Passed,
    ),
    positive("discarding the tail restores the complete entries", [ServerTornCheck.Restored], true),
    positive("every complete entry is replayed", [ServerTornCheck.Replayed], true),
    positive(
      "half of a real line is discarded as a tail",
      [ServerTornCheck.Partial],
      "passed true",
    ),
  ],
  negative: [
    negative("invalid line before the tail stops recovery", [ServerTornCheck.Corrupt], {
      code: ErrorCode.CorruptBoard,
    }),
    negative("entries out of order stop recovery", [ServerTornCheck.Reordered], {
      code: ErrorCode.CorruptBoard,
    }),
    negative("empty board has no run to recover", [ServerTornCheck.Empty], {
      code: ErrorCode.RunNotFound,
    }),
    rejected(
      "failed recovery leaves the board unchanged",
      [ServerTornCheck.Unchanged],
      `${ErrorCode.CorruptBoard} true`,
    ),
  ],
};
