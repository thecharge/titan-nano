import { ErrorCode, RequestLimit } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const requestBudgetLayerCases = {
  positive: [
    positive(
      "selected file lowers request allowance",
      [{ requests: { max_per_run: 12 } }, { requests: { max_per_run: 8 } }, undefined, [], true],
      8,
    ),
    positive(
      "selected file keeps inherited request allowance",
      [{ requests: { max_per_run: 12 } }, { requests: { max_per_run: 12 } }, undefined, [], true],
      12,
    ),
    positive("default request allowance is explicit", [], RequestLimit.PerRun),
    positive("owner lowers request allowance", [{ requests: { max_per_run: 12 } }], 12),
    positive(
      "project lowers inherited request allowance",
      [{ requests: { max_per_run: 12 } }, { requests: { max_per_run: 8 } }],
      8,
    ),
    positive(
      "workflow lowers project request allowance",
      [
        { requests: { max_per_run: 12 } },
        { requests: { max_per_run: 8 } },
        { requests: { max_per_run: 4 } },
      ],
      4,
    ),
    positive(
      "CLI lowers workflow request allowance",
      [
        { requests: { max_per_run: 12 } },
        { requests: { max_per_run: 8 } },
        { requests: { max_per_run: 4 } },
        ["requests.max_per_run=2"],
      ],
      2,
    ),
  ],
  negative: [
    negative(
      "selected file cannot raise owner request allowance",
      [{ requests: { max_per_run: 2 } }, { requests: { max_per_run: 3 } }, undefined, [], true],
      { code: ErrorCode.InvalidConfig },
    ),
    negative(
      "selected file cannot admit zero request allowance",
      [{}, { requests: { max_per_run: 0 } }, undefined, [], true],
      { code: ErrorCode.InvalidConfig },
    ),
    negative("zero owner request allowance is refused", [{ requests: { max_per_run: 0 } }], {
      code: ErrorCode.InvalidConfig,
    }),
    negative(
      "owner cannot exceed fixed request ceiling",
      [{ requests: { max_per_run: RequestLimit.PerRun + 1 } }],
      { code: ErrorCode.InvalidConfig },
    ),
    negative("fractional request allowance is refused", [{ requests: { max_per_run: 1.5 } }], {
      code: ErrorCode.InvalidConfig,
    }),
    negative("text request allowance is refused", [{ requests: { max_per_run: "2" } }], {
      code: ErrorCode.InvalidConfig,
    }),
    negative(
      "project cannot raise owner request allowance",
      [{ requests: { max_per_run: 2 } }, { requests: { max_per_run: 3 } }],
      { code: ErrorCode.InvalidConfig },
    ),
    negative(
      "workflow cannot raise project request allowance",
      [{}, { requests: { max_per_run: 2 } }, { requests: { max_per_run: 3 } }],
      { code: ErrorCode.InvalidConfig },
    ),
    negative(
      "CLI cannot raise workflow request allowance",
      [{}, {}, { requests: { max_per_run: 2 } }, ["requests.max_per_run=3"]],
      { code: ErrorCode.InvalidConfig },
    ),
    negative("unknown request setting is refused", [{ requests: { unknown: 2 } }], {
      code: ErrorCode.InvalidConfig,
    }),
    negative(
      "CLI cannot exceed fixed request ceiling",
      [{}, {}, {}, [`requests.max_per_run=${RequestLimit.PerRun + 1}`]],
      { code: ErrorCode.Arguments },
    ),
  ],
};
export const requestBudgetCases = {
  positive: [
    positive("one request and its answer fit frozen capacity", [1, false], true),
    positive("two requests and an answer survive reload", [2, true], true),
    positive("legacy journal preserves hash and default capacity", [1, true, false, true], true),
    positive("legacy in-memory run preserves original shape", [2, false, false, true], true),
  ],
  negative: [
    rejected("answered requests still occupy capacity", [1, false, true], true),
    rejected("reload cannot raise frozen request capacity", [2, true, true], true),
  ],
};
