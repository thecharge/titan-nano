import { ErrorCode } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const boundedWorkCases = {
  positive: [
    positive("serial limit preserves order", [1, 3], { values: [0, 1, 2], peak: 1 }),
    positive("parallel limit is enforced", [2, 5], { values: [0, 1, 2, 3, 4], peak: 2 }),
    positive("empty input starts no work", [2, 0], { values: [], peak: 0 }),
  ],
  negative: [
    negative("zero limit", [0, 3], { code: ErrorCode.Capacity }),
    negative("fractional limit", [1.5, 3], { code: ErrorCode.Capacity }),
  ],
};
export const stoppedWorkCases = {
  positive: [
    positive("serial failure stops queue", [1, "stopped"], { error: "stopped", started: [0] }),
    positive("parallel failure drains started work only", [2, "stopped"], {
      error: "stopped",
      started: [0, 1],
    }),
  ],
  negative: [
    rejected("undefined rejection still stops queue", [1, undefined], {
      error: undefined,
      started: [0],
    }),
    rejected("null rejection still stops queue", [1, null], { error: null, started: [0] }),
  ],
};

const oneRejected = [
  { status: "rejected", reason: 0 },
  ...[1, 2, 3].map((value) => ({ status: "fulfilled", value })),
];
const twoRejected = [
  { status: "rejected", reason: 0 },
  { status: "rejected", reason: 1 },
  ...[2, 3].map((value) => ({ status: "fulfilled", value })),
];
export const settledWorkCases = {
  positive: [
    positive("serial settlement preserves ordering", [1, 0], {
      results: [0, 1, 2, 3].map((value) => ({ status: "fulfilled", value })),
      peak: 1,
    }),
    positive("capped settlement overlaps two tasks", [2, 0], {
      results: [0, 1, 2, 3].map((value) => ({ status: "fulfilled", value })),
      peak: 2,
    }),
  ],
  negative: [
    rejected("rejection does not discard pending tasks", [1, 1], {
      results: oneRejected,
      peak: 1,
    }),
    rejected("multiple rejected tasks retain ordered outcomes", [2, 2], {
      results: twoRejected,
      peak: 2,
    }),
  ],
};

const firstReason = { result: { status: "rejected", reason: "first" }, started: [0, 1] };
const zeroReason = { result: { status: "rejected", reason: 0 }, started: [0, 1] };
const undefinedReason = { result: { status: "rejected", reason: undefined }, started: [0, 1] };
const nullReason = { result: { status: "rejected", reason: null }, started: [0, 1] };
export const competingFailureCases = {
  positive: [
    positive("later rejection cannot replace the first reason", ["first", "later"], firstReason),
    positive("zero remains the first reason after draining peers", [0, 1], zeroReason),
  ],
  negative: [
    rejected(
      "undefined cannot be replaced by a later rejection",
      [undefined, "later"],
      undefinedReason,
    ),
    rejected("null cannot be replaced by a later rejection", [null, "later"], nullReason),
  ],
};
