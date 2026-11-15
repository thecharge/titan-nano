import { IoLimit } from "./io.ts";

export const CommandCaptureLimit = {
  Arguments: 256,
  ArgumentCharacters: 4096,
  TotalCharacters: 32768,
  Bytes: IoLimit.DataBytes,
  DefaultMilliseconds: 10000,
  MaximumMilliseconds: 3600000,
  ArgumentPattern: /^[^\0]*$/,
} as const;

export enum CommandCaptureFixture {
  Complete = "complete",
  Nonzero = "nonzero",
  EmptyArgument = "empty_argument",
  Signal = "signal",
  Cancel = "cancel",
  PreCancelled = "pre_cancelled",
  Timeout = "timeout",
  StdoutOverflow = "stdout_overflow",
  StderrOverflow = "stderr_overflow",
  Descendant = "descendant",
  Hold = "hold",
  EmptyCommand = "empty_command",
  ZeroByte = "zero_byte",
  ExcessArguments = "excess_arguments",
  InvalidOptions = "invalid_options",
  GroupStopFailure = "group_stop_failure",
  ChildStopFailure = "child_stop_failure",
}

export const CommandCaptureTest = {
  Bytes: 1024,
  DeadlineMilliseconds: 500,
  HeldMilliseconds: 10000,
  ExitCode: 7,
  StdoutByte: 197,
  StderrByte: 131,
} as const;
