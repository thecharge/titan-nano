import { ErrorCode } from "@titan/constants";
import { negative, positive } from "@titan/test-factories";

export const frozenNativeBudgetCases = {
  positive: [
    positive("legacy host configuration retains its frozen shape and hash", [true, false], true),
    positive("current host configuration retains its selected worker pool", [false, false], true),
  ],
  negative: [
    negative("legacy host edit without a new hash is refused", [true, true], {
      code: ErrorCode.CorruptBoard,
    }),
    negative("current host edit without a new hash is refused", [false, true], {
      code: ErrorCode.CorruptBoard,
    }),
  ],
};
