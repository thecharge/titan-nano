import { expect } from "bun:test";
import { negative, positive, rejected } from "@titan/test-factories";

export const fadedTrailsCases = {
  positive: [
    positive("a trail of 10 fades to 9.8 when another choice ends the run", [{ "1": 10, "8": 3 }], {
      "1": 9.8,
      "8": 2.94,
    }),
    positive("a trail at 0 stays at 0", [{ "2": 0 }], { "2": 0 }),
  ],
  negative: [
    rejected("a trail of 100 does not keep its pull", [{ "1": 100 }], { "1": 98 }),
    rejected("a set without choices stays empty", [{}], {}),
    negative("a negative count is refused", [{ "4": -1 }], { issues: expect.any(Array) }),
    negative("a count that is not a number is refused", [{ "4": "x" }], {
      issues: expect.any(Array),
    }),
  ],
};
