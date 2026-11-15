import { ErrorCode, LogEvent, LogLevel } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { LogErrorCodeSchema, type Logger } from "@titan/types";

export async function observeRun(
  work: Promise<void>,
  runId: string,
  logger: Logger,
): Promise<void> {
  try {
    await work;
    await logger.write({ level: LogLevel.Info, event: LogEvent.RunSettled, run_id: runId });
  } catch (error) {
    const code = LogErrorCodeSchema.safeParse(error instanceof TitanError ? error.code : undefined);
    await logger.write({
      level: LogLevel.Error,
      event: LogEvent.RunFailed,
      run_id: runId,
      code: code.success ? code.data : ErrorCode.ExecutionInterrupted,
    });
  }
}
