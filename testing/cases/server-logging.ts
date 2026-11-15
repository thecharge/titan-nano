import { ErrorCode, LogEvent, LogLevel } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";
export const backgroundLogCases = {
  positive: [
    positive("one settlement retains its run identity", ["single"], {
      events: [LogEvent.RunSettled],
      codes: [null],
    }),
    positive("parallel settlements retain both run identities", ["parallel"], {
      events: [LogEvent.RunSettled, LogEvent.RunSettled],
      codes: [null, null],
    }),
  ],
  negative: [
    rejected("typed failure logs its code without exception text", ["typed"], {
      events: [LogEvent.RunFailed],
      codes: [ErrorCode.Capacity],
    }),
    rejected("unlisted typed error cannot escape the diagnostic schema", ["unlisted-code"], {
      events: [LogEvent.RunFailed],
      codes: [ErrorCode.ExecutionInterrupted],
    }),
    rejected("unknown failure logs a safe operational code", ["unknown"], {
      events: [LogEvent.RunFailed],
      codes: [ErrorCode.ExecutionInterrupted],
    }),
  ],
};
export const serverDiagnosticsCases = {
  positive: [
    positive("enabled lifecycle records include settled run and shutdown", [true], {
      ready: true,
      written: 2,
      filtered: 0,
      rejected: 0,
      failed: 0,
      disabled: false,
    }),
    positive("default threshold filters ordinary lifecycle records", [false], {
      ready: true,
      written: 0,
      filtered: 2,
      rejected: 0,
      failed: 0,
      disabled: false,
    }),
  ],
  negative: [
    rejected("sink failure cannot change a passed run", [true, true], {
      ready: true,
      written: 0,
      filtered: 0,
      rejected: 1,
      failed: 1,
      disabled: true,
    }),
    rejected("filtered diagnostics never call a failing sink", [false, true], {
      ready: true,
      written: 0,
      filtered: 2,
      rejected: 0,
      failed: 0,
      disabled: false,
    }),
  ],
};
export const loggerConfigurationCases = {
  positive: [
    positive("home owner selects diagnostic settings", ["owner"], LogLevel.Info),
    positive("legacy settings keep their absent logging field", ["legacy"], null),
  ],
  negative: [
    negative("project cannot change owner diagnostic settings", ["project"], {
      code: ErrorCode.OwnerSetting,
    }),
    negative("workflow cannot change owner diagnostic settings", ["workflow"], {
      code: ErrorCode.OwnerSetting,
    }),
    negative("CLI overrides cannot change owner diagnostic settings", ["cli"], {
      code: ErrorCode.OwnerSetting,
    }),
  ],
};
