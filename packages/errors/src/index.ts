import { ErrorCode, ErrorName, ExitCode } from "@titan/constants";
export class TitanError extends Error {
  constructor(
    public code: string,
    message: string,
    public exitCode: number = ExitCode.Input,
    public paths: string[] = [],
  ) {
    super(message);
    this.name = ErrorName.Titan;
  }
}
export class OperationalError extends TitanError {
  constructor(
    code: string,
    message: string,
    public retryable = false,
    public retryAfterMs = 0,
  ) {
    super(code, message, ExitCode.Blocked);
    this.name = ErrorName.Operational;
  }
}

export class RunRuntimeError extends TitanError {
  constructor(
    public requiredRuntime: string,
    message: string,
    public requiredBuild?: string,
  ) {
    super(ErrorCode.UnsupportedRunRuntime, message);
  }
}
export class UsageLimitError extends OperationalError {
  constructor(
    message: string,
    public delayMs: number,
  ) {
    super(ErrorCode.UsageLimit, message);
  }
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
export function classifyError(error: unknown): OperationalError {
  if (error instanceof OperationalError) return error;
  const message = errorMessage(error);
  return new OperationalError(ErrorCode.ExecutionInterrupted, message);
}

export class SubmissionUncertainError extends TitanError {
  constructor(
    public client_id: string,
    public submission_id: string,
    public receipt_path: string,
    message: string,
  ) {
    super(ErrorCode.SubmissionUncertain, message, ExitCode.Transport);
  }
}

export class RunObservationError extends TitanError {
  constructor(
    public run_id: string,
    error: TitanError,
  ) {
    super(error.code, error.message, error.exitCode, error.paths);
    this.cause = error;
  }
}
