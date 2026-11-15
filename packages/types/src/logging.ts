import {
  ActiveLogLevels,
  ErrorCode,
  IdentifierPattern,
  LogEvent,
  Logging,
  LogLevel,
} from "@titan/constants";
import { z } from "zod";

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const identity = z.string().regex(IdentifierPattern);
export const LogSettingsSchema = z.strictObject({
  level: z.enum(LogLevel).default(LogLevel.Warn),
  max_pending: count.min(1).max(Logging.MaximumPending).default(Logging.Pending),
  max_record_bytes: count
    .min(Logging.MinimumRecordBytes)
    .max(Logging.RecordBytes)
    .default(Logging.RecordBytes),
  write_timeout_ms: count
    .min(1)
    .max(Logging.MaximumWriteMilliseconds)
    .default(Logging.WriteMilliseconds),
});
export type LogSettings = z.infer<typeof LogSettingsSchema>;
export const LogErrorCodeSchema = z.enum(ErrorCode);
export const LogInputSchema = z.strictObject({
  level: z.enum(ActiveLogLevels),
  event: z.enum(LogEvent),
  run_id: identity.optional(),
  node_id: identity.optional(),
  phase: identity.optional(),
  execution_id: identity.optional(),
  code: LogErrorCodeSchema.optional(),
});
export type LogInput = z.infer<typeof LogInputSchema>;
export const LogRecordSchema = LogInputSchema.extend({
  schema_version: z.literal(Logging.Version),
  time: count,
  pid: count.min(1),
});
export type LogRecord = z.infer<typeof LogRecordSchema>;
export const LogStatisticsSchema = z.strictObject({
  written: count,
  filtered: count,
  rejected: count,
  failed: count,
  disabled: z.boolean(),
});
export type LogStatistics = z.infer<typeof LogStatisticsSchema>;
export type LogSink = (bytes: Buffer) => Promise<number>;
export type LogGuard = (bytes: Uint8Array) => void;
export interface Logger {
  write(input: LogInput): Promise<boolean>;
  statistics(): Promise<LogStatistics>;
}
