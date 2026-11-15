import { ErrorCode } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const failed = { code: ErrorCode.CorruptBoard, count: 0, descriptors: 0 };
export const journalBoundCases = {
  positive: [
    positive("complete record may reach the byte ceiling", [false, true], {
      code: null,
      count: 1,
      descriptors: 0,
    }),
    positive("incomplete tail may reach the byte ceiling", [false, false], {
      code: null,
      count: 0,
      descriptors: 0,
    }),
  ],
  negative: [
    rejected("complete record cannot exceed the byte ceiling", [true, true], failed),
    rejected("incomplete tail cannot exceed the byte ceiling", [true, false], failed),
  ],
};
