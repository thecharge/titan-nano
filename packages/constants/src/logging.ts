export enum LogLevel {
  Debug = "debug",
  Info = "info",
  Warn = "warn",
  Error = "error",
  Off = "off",
}
export enum LogEvent {
  ServerReady = "server_ready",
  ServerStopped = "server_stopped",
  RunSettled = "run_settled",
  RunFailed = "run_failed",
}
export enum LogSinkResult {
  Complete = "complete",
  Failed = "failed",
  TimedOut = "timed_out",
}
export const Logging = {
  Version: 1,
  Pending: 128,
  MaximumPending: 1024,
  RecordBytes: 4096,
  MinimumRecordBytes: 128,
  WriteMilliseconds: 1000,
  MaximumWriteMilliseconds: 5000,
  Queue: "diagnostics",
} as const;
export const LogLevelRank = {
  [LogLevel.Debug]: 0,
  [LogLevel.Info]: 1,
  [LogLevel.Warn]: 2,
  [LogLevel.Error]: 3,
  [LogLevel.Off]: 4,
} as const;

export const ActiveLogLevels = [
  LogLevel.Debug,
  LogLevel.Info,
  LogLevel.Warn,
  LogLevel.Error,
] as const;
