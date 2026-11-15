import { ErrorCode, StoreEviction } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const storeCases = {
  positive: [
    positive("bounded entries", [2, StoreEviction.Reject, [1, 2]], {
      keys: [1, 2],
      values: [1, 2],
      size: 2,
    }),
    positive(
      "least-recently-used entry is evicted",
      [2, StoreEviction.LeastRecentlyUsed, [1, 2, 3]],
      { keys: [2, 3], values: [2, 3], size: 2 },
    ),
    positive(
      "access retains the recently used entry",
      [2, StoreEviction.LeastRecentlyUsed, [1, 2, 3], 1],
      { keys: [1, 3], values: [1, 3], size: 2 },
    ),
  ],
  negative: [
    negative("invalid capacity", [0, StoreEviction.Reject, []], { name: "ZodError" }),
    negative("active values cannot be evicted silently", [1, StoreEviction.Reject, [1, 2]], {
      code: ErrorCode.Capacity,
    }),
  ],
};
export const queueCases = {
  positive: [
    positive("same key is serialized", [["a", "a"], 3, null], { values: [0, 1], peak: 1 }),
    positive("different keys overlap", [["a", "b"], 3, null], { values: [0, 1], peak: 2 }),
  ],
  negative: [
    rejected("failed work does not poison the next operation", [["a", "a"], 3, 0], {
      values: [ErrorCode.Arguments, 1],
      peak: 1,
    }),
    rejected("queue limit rejects excess pending work", [["a", "a"], 1, null], {
      values: [0, ErrorCode.Capacity],
      peak: 1,
    }),
  ],
};

export const expiryCases = {
  positive: [
    positive("entry remains before its deadline", [10, 9], { present: true, value: 10, size: 1 }),
    positive("no deadline retains the entry", [null, 1000], { present: true, value: 10, size: 1 }),
  ],
  negative: [
    rejected("entry expires exactly at its deadline", [10, 10], {
      present: false,
      value: undefined,
      size: 0,
    }),
    rejected("zero lifetime is immediately expired", [0, 0], {
      present: false,
      value: undefined,
      size: 0,
    }),
    negative("negative lifetime is rejected", [-1, 0], { name: "ZodError" }),
    negative(
      "infinite lifetime must use the explicit null setting",
      [Number.POSITIVE_INFINITY, 0],
      { name: "ZodError" },
    ),
  ],
};

export const updateCases = {
  positive: [
    positive("creates a missing entry", [undefined, 10], {
      result: 10,
      error: undefined,
      keys: [1],
      values: [10],
      size: 1,
    }),
    positive("replaces an existing entry", [10, 20], {
      result: 20,
      error: undefined,
      keys: [1],
      values: [20],
      size: 1,
    }),
  ],
  negative: [
    rejected("undefined removes an existing entry", [10, undefined], {
      result: undefined,
      error: undefined,
      keys: [],
      values: [],
      size: 0,
    }),
    rejected("undefined leaves a missing entry absent", [undefined, undefined], {
      result: undefined,
      error: undefined,
      keys: [],
      values: [],
      size: 0,
    }),
    rejected(
      "throwing updater preserves values and eviction order",
      [10, 30, ErrorCode.Arguments],
      { result: undefined, error: ErrorCode.Arguments, keys: [1, 2], values: [10, 20], size: 2 },
    ),
    rejected("capacity failure preserves existing values", [10, 30, ErrorCode.Capacity], {
      result: undefined,
      error: ErrorCode.Capacity,
      keys: [1, 2],
      values: [10, 20],
      size: 2,
    }),
  ],
};

export const entryCases = {
  positive: [
    positive("typed value without expiration", [{ value: 1, expiresAt: null }], {
      value: 1,
      expiresAt: null,
    }),
    positive("typed value with expiration", [{ value: 2, expiresAt: 100 }], {
      value: 2,
      expiresAt: 100,
    }),
  ],
  negative: [
    negative("incorrect value type", [{ value: "1", expiresAt: null }], { name: "ZodError" }),
    negative("incorrect deadline type", [{ value: 1, expiresAt: "100" }], { name: "ZodError" }),
  ],
};
