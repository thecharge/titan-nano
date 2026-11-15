import { positive, rejected } from "@titan/test-factories";

export const adapterSpecSnapshotCases = {
  positive: [
    positive("a fresh session uses the admitted specification", [false, false], true),
    positive("a resumed session uses the admitted specification", [false, true], true),
  ],
  negative: [
    rejected("caller mutation cannot change a fresh session", [true, false], true),
    rejected("caller mutation cannot change a resumed session", [true, true], true),
  ],
};
