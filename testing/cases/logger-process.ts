import { LogEvent, LogLevel } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const warning = { level: LogLevel.Warn, event: LogEvent.RunSettled, run_id: "run-one" };
export const loggerProcessCases = {
  positive: [
    positive("warning reaches stderr while stdout keeps one result", [warning], {
      accepted: true,
      records: 1,
      rejected: 0,
    }),
    positive(
      "enabled debug record preserves protocol stdout",
      [{ ...warning, level: LogLevel.Debug }, { level: LogLevel.Debug }],
      { accepted: true, records: 1, rejected: 0 },
    ),
  ],
  negative: [
    rejected(
      "OS filesystem sink failure preserves stdout and failure count",
      [warning, {}, "", true],
      {
        accepted: false,
        records: 0,
        rejected: 0,
      },
    ),
    rejected(
      "arbitrary payload never reaches either diagnostic line",
      [{ ...warning, text: "private content" }],
      { accepted: false, records: 0, rejected: 1 },
    ),
    rejected(
      "invalid record level cannot corrupt stdout framing",
      [{ ...warning, level: "fatal" }],
      { accepted: false, records: 0, rejected: 1 },
    ),
    rejected(
      "real configured secret guard refuses an identity",
      [{ ...warning, run_id: "private-value" }, {}, "private-value"],
      { accepted: false, records: 0, rejected: 1 },
    ),
  ],
};
