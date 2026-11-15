import { ErrorCode } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";
import { frozenConfigReport } from "../factories/frozen-config.ts";

const report = frozenConfigReport();
const other = frozenConfigReport(3);
const changedValue = { ...report, config: { ...report.config, value: other.config.value } };
const unexpectedValue = { ...report.config.value, secret: "unexpected" };
const unknownConfig = { ...report, config: { ...report.config, value: unexpectedValue } };
export const frozenConfigResponseCases = {
  positive: [
    positive("frozen settings preserve their sources and hash", [report], report),
    positive("another valid frozen parallel allowance is retained", [other], other),
  ],
  negative: [
    negative("another run cannot replace the selected run", [{ ...report, run_id: "foreign" }], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("changed value cannot retain the original hash", [changedValue], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("unknown report fields are refused", [{ ...report, secret: "unexpected" }], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("unknown configuration fields are refused", [unknownConfig], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("negative journal position is refused", [{ ...report, through: -1 }], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("unsupported version is refused", [{ ...report, schema_version: 2 }], {
      code: ErrorCode.InvalidResponse,
    }),
  ],
};
export const frozenConfigProcessCases = {
  positive: [
    positive(
      "passed run keeps frozen sources across config edits and restart",
      [false, true],
      true,
    ),
    positive(
      "blocked run keeps frozen sources across config edits and restart",
      [true, true],
      true,
    ),
  ],
  negative: [
    rejected("missing run cannot borrow a passed run configuration", [false, false], true),
    rejected("missing run cannot borrow a blocked run configuration", [true, false], true),
  ],
};

export const frozenConfigInspectionCases = {
  positive: [
    positive("exact CLI inspection includes requested sources", [true, true], true),
    positive("exact CLI inspection omits unrequested sources", [false, true], true),
  ],
  negative: [
    rejected("missing exact run cannot expose setting sources", [true, false], true),
    rejected("missing exact run cannot expose frozen values", [false, false], true),
  ],
};
