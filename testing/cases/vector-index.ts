import { VectorIndexSetup as Setup } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const stored = { opened: true, wrote: true, count: 1, top: true, score: 1 };
const removed = { ...stored, count: 0, top: false, score: null };
const oversize = { ...removed, wrote: false };
const garbage = { ...oversize, opened: false };

export const vectorIndexCases = {
  positive: [
    positive("a stored vector is its own nearest hit", [Setup.Stored], stored),
    positive("a removed vector is no longer a hit", [Setup.Removed], removed),
  ],
  negative: [
    rejected("a vector longer than the table is refused", [Setup.Oversize], oversize),
    rejected("a file that is not a database does not open", [Setup.Garbage], garbage),
  ],
};
