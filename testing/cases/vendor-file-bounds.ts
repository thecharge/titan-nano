import { ErrorCode } from "@titan/constants";
import { negative, positive } from "@titan/test-factories";

const passed = { completed: true, calls: 1, stopped: true };
export const vendorFileBoundCases = {
  positive: [
    positive("new session record reaches the exact byte ceiling", [false, false], passed),
    positive("resumed session record reaches the exact byte ceiling", [false, true], passed),
  ],
  negative: [
    negative("new session record cannot exceed the byte ceiling", [true, false], {
      code: ErrorCode.StreamLimit,
    }),
    negative("resumed session record cannot exceed the byte ceiling", [true, true], {
      code: ErrorCode.StreamLimit,
    }),
  ],
};
