import { PersonaReferencePattern, PersonaRegister, UsageReport } from "@titan/constants";
import { z } from "zod";

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const UsageKnownSchema = z.strictObject({
  input_tokens: count,
  output_tokens: count,
  cost_usd: z.number().nonnegative(),
});
export type UsageKnown = z.infer<typeof UsageKnownSchema>;
export const RunUsageSchema = z
  .strictObject({
    schema_version: z.literal(UsageReport.Version),
    run_id: z.string().min(1),
    through: count,
    executions: count,
    reported_executions: count,
    unreported_executions: count,
    known: UsageKnownSchema,
    complete: z.strictObject({
      input_tokens: z.boolean(),
      output_tokens: z.boolean(),
      cost_usd: z.boolean(),
    }),
  })
  .refine(
    (report) => report.reported_executions + report.unreported_executions === report.executions,
  )
  .refine(
    (report) => !report.unreported_executions || !Object.values(report.complete).some(Boolean),
  )
  .refine(
    (report) =>
      report.reported_executions > 0 || Object.values(report.known).every((value) => value === 0),
  );
export type RunUsage = z.infer<typeof RunUsageSchema>;

export const PersonaRunUsageSchema = RunUsageSchema.safeExtend({
  asked: count.optional(),
});

export const PersonaUsageReportSchema = PersonaRunUsageSchema.safeExtend({
  persona: z.string().regex(PersonaReferencePattern),
});
export type PersonaUsageReport = z.infer<typeof PersonaUsageReportSchema>;

export const PersonaUsageSchema = z.strictObject({
  history_complete: z.boolean(),
  reports: z.array(PersonaRunUsageSchema).max(PersonaRegister.HistoryResults),
  executions: RunUsageSchema.shape.executions,
  reported_executions: RunUsageSchema.shape.reported_executions,
  unreported_executions: RunUsageSchema.shape.unreported_executions,
  known: RunUsageSchema.shape.known,
  complete: RunUsageSchema.shape.complete,
});
export type PersonaUsage = z.infer<typeof PersonaUsageSchema>;

export const UsagePhasePolicySchema = z.strictObject({
  cumulative: z.boolean(),
  persona: z.string().regex(PersonaReferencePattern).optional(),
});
export type UsagePhasePolicy = z.infer<typeof UsagePhasePolicySchema>;

const UsageCursorSchema = z.strictObject({
  attempt: count,
  generation: count,
  dispatches: count,
  executions: count,
  recorded: count,
  prefix_hash: z.string(),
  high_water: UsageKnownSchema,
});
export type UsageCursor = z.infer<typeof UsageCursorSchema>;
