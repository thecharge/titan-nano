import { ErrorCode } from "@titan/constants";
import { negative, positive } from "@titan/test-factories";

export const claudeDenialCases = {
  positive: [
    positive("one denied request still completes", [1, false], "done"),
    positive("two denied requests still complete", [2, false], "done"),
  ],
  negative: [
    negative("an error result with a denial still fails", [1, true], {
      code: ErrorCode.ClaudeExecution,
    }),
    negative("an error result without a denial still fails", [0, true], {
      code: ErrorCode.ClaudeExecution,
    }),
  ],
};
