import { ErrorCode, LogEvent, LogLevel } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

const written = {
  accepted: true,
  written: 1,
  filtered: 0,
  rejected: 0,
  failed: 0,
  disabled: false,
};
const filtered = {
  accepted: true,
  written: 0,
  filtered: 1,
  rejected: 0,
  failed: 0,
  disabled: false,
};
const refused = {
  accepted: false,
  written: 0,
  filtered: 0,
  rejected: 1,
  failed: 0,
  disabled: false,
};
const failed = {
  accepted: false,
  written: 0,
  filtered: 0,
  rejected: 1,
  failed: 1,
  disabled: true,
};
const warning = { level: LogLevel.Warn, event: LogEvent.RunSettled, run_id: "run-one" };
export const loggerRecordCases = {
  positive: [
    positive("default stderr sink writes a warning buffer", [{}, warning, {}, true], written),
    positive(
      "default stderr sink writes an error buffer",
      [{}, { ...warning, level: LogLevel.Error }, {}, true],
      written,
    ),
    positive("warn record retains bounded run identity", [{}, warning], written),
    positive(
      "error record retains only declared failure code",
      [
        {},
        { level: LogLevel.Error, event: LogEvent.RunFailed, code: ErrorCode.ExecutionInterrupted },
      ],
      written,
    ),
    positive(
      "info is filtered by the default threshold",
      [{}, { ...warning, level: LogLevel.Info }],
      filtered,
    ),
    positive(
      "off filters a valid error record",
      [{ level: LogLevel.Off }, { ...warning, level: LogLevel.Error }],
      filtered,
    ),
  ],
  negative: [
    rejected(
      "arbitrary exception text is refused",
      [{}, { ...warning, error: "private error text" }],
      refused,
    ),
    rejected("unknown event names are refused", [{}, { ...warning, event: "unknown" }], refused),
    rejected(
      "known secret identity is refused before writing",
      [{}, { ...warning, run_id: "private-value" }, { TITAN_TEST_API_KEY: "private-value" }],
      refused,
    ),
    rejected(
      "record byte allowance is enforced",
      [
        { max_record_bytes: 128 },
        { ...warning, node_id: "n".repeat(128), execution_id: "e".repeat(128) },
      ],
      refused,
    ),
    negative("zero pending allowance is invalid", [{ max_pending: 0 }, warning], {
      name: "ZodError",
    }),
    negative(
      "pending allowance cannot exceed its safety ceiling",
      [{ max_pending: 1025 }, warning],
      { name: "ZodError" },
    ),
    negative("unknown logging settings are refused", [{ content: true }, warning], {
      name: "ZodError",
    }),
    negative("write deadline cannot exceed its ceiling", [{ write_timeout_ms: 5001 }, warning], {
      name: "ZodError",
    }),
  ],
};
export const loggerSinkCases = {
  positive: [
    positive("complete asynchronous write succeeds", ["complete"], written),
    positive("two complete asynchronous writes remain enabled", ["repeat"], {
      ...written,
      written: 2,
    }),
  ],
  negative: [
    rejected("partial write cannot count as written", ["partial"], failed),
    rejected("sink exception cannot escape the logger", ["reject"], failed),
    rejected("deadline disables further sink operations", ["timeout"], {
      ...failed,
      rejected: 1,
      disabled: true,
    }),
  ],
};
export const loggerQueueCases = {
  positive: [
    positive("one-record queue accepts after release", [1, false], true),
    positive("two-record queue preserves order and reopens", [2, false], true),
  ],
  negative: [
    rejected("one-record queue refuses an overlapping write", [1, true], false),
    rejected("two-record queue refuses a third pending write", [2, true], false),
  ],
};

export const loggerHostileCases = {
  positive: [
    positive("plain trusted record is accepted", ["plain"], true),
    positive("transparent proxy retains record validation", ["transparent"], true),
  ],
  negative: [
    rejected("throwing property accessor cannot escape logging", ["getter"], false),
    rejected("throwing key inventory cannot escape logging", ["keys"], false),
  ],
};

export const loggerFramingCases = {
  positive: [
    positive("two warning records retain separate JSON lines", [warning, "none"], true),
    positive(
      "two error records retain separate JSON lines",
      [{ ...warning, level: LogLevel.Error }, "none"],
      true,
    ),
  ],
  negative: [
    rejected("partial write remains the final incomplete record", [warning, "partial"], true),
    rejected(
      "exception after a prefix cannot corrupt a later record",
      [{ ...warning, level: LogLevel.Error }, "throw"],
      true,
    ),
  ],
};
