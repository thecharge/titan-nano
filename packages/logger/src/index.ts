import { assertNoSecrets } from "@titan/config";
import { Logging, LogLevelRank, LogSinkResult, Newline } from "@titan/constants";
import { KeyedQueue } from "@titan/store";
import {
  type LogGuard,
  type Logger,
  type LogInput,
  LogInputSchema,
  LogRecordSchema,
  type LogSettings,
  LogSettingsSchema,
  type LogSink,
  type LogStatistics,
} from "@titan/types";

export async function createLogger(
  input: unknown = {},
  sink: LogSink = diagnosticSink,
  guard?: LogGuard,
): Promise<Logger> {
  const settings = LogSettingsSchema.parse(input);
  const queue = new KeyedQueue(settings.max_pending);
  const statistics: LogStatistics = {
    written: 0,
    filtered: 0,
    rejected: 0,
    failed: 0,
    disabled: false,
  };
  return {
    async write(input) {
      try {
        const parsed = LogInputSchema.safeParse(input);
        if (!parsed.success) {
          statistics.rejected = Math.min(Number.MAX_SAFE_INTEGER, statistics.rejected + 1);
          return false;
        }
        if (LogLevelRank[parsed.data.level] < LogLevelRank[settings.level]) {
          statistics.filtered = Math.min(Number.MAX_SAFE_INTEGER, statistics.filtered + 1);
          return true;
        }
        return await queue.use(Logging.Queue, () =>
          emitDiagnostic(parsed.data, settings, sink, guard, statistics),
        );
      } catch {
        statistics.rejected = Math.min(Number.MAX_SAFE_INTEGER, statistics.rejected + 1);
        return false;
      }
    },
    async statistics() {
      return { ...statistics };
    },
  };
}

async function emitDiagnostic(
  input: LogInput,
  settings: LogSettings,
  sink: LogSink,
  guard: LogGuard | undefined,
  statistics: LogStatistics,
): Promise<boolean> {
  if (statistics.disabled) {
    statistics.rejected = Math.min(Number.MAX_SAFE_INTEGER, statistics.rejected + 1);
    return false;
  }
  const record = LogRecordSchema.parse({
    ...input,
    schema_version: Logging.Version,
    time: Date.now(),
    pid: process.pid,
  });
  const bytes = Buffer.from(JSON.stringify(record) + Newline);
  if (bytes.length > settings.max_record_bytes) {
    statistics.rejected = Math.min(Number.MAX_SAFE_INTEGER, statistics.rejected + 1);
    return false;
  }
  assertNoSecrets(bytes);
  guard?.(bytes);
  const result = await writeDiagnostic(bytes, sink, settings.write_timeout_ms);
  if (result !== LogSinkResult.Complete) {
    statistics.failed = Math.min(Number.MAX_SAFE_INTEGER, statistics.failed + 1);
    statistics.disabled = true;
    return false;
  }
  statistics.written = Math.min(Number.MAX_SAFE_INTEGER, statistics.written + 1);
  return true;
}

async function diagnosticSink(bytes: Buffer): Promise<number> {
  return Bun.write(Bun.stderr, bytes);
}

async function writeDiagnostic(
  bytes: Buffer,
  sink: LogSink,
  milliseconds: number,
): Promise<LogSinkResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<LogSinkResult>((resolve) => {
    timer = setTimeout(() => resolve(LogSinkResult.TimedOut), milliseconds);
  });
  try {
    return await Promise.race([
      sink(bytes).then((written) =>
        written === bytes.length ? LogSinkResult.Complete : LogSinkResult.Failed,
      ),
      expired,
    ]);
  } catch {
    return LogSinkResult.Failed;
  } finally {
    clearTimeout(timer);
  }
}
