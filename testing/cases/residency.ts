import { positive, rejected } from "@titan/test-factories";

export const residentOwnerCases = {
  positive: [
    positive("two residents admit a peer while the first worker is held", [2, false], true),
    positive("reversed caller names retain overlapping resident runs", [2, true], true),
  ],
  negative: [
    rejected("one resident refuses a peer without executing it", [1, false], true),
    rejected("reversed saturated residents recover the recorded peer explicitly", [1, true], true),
  ],
};
