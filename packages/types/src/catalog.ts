import { isAbsolute, resolve } from "node:path";
import { EventCursor, KnownHome, RunStatus, ServerLimit, ServerState } from "@titan/constants";
import { z } from "zod";
import { CallerSessionSchema } from "./board.ts";
import { StoredRunSchema } from "./transport.ts";

export const StoredCatalogSchema = StoredRunSchema.extend({
  sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  client_id: z.string().min(1).max(ServerLimit.IdentityCharacters),
});
export type StoredCatalog = z.infer<typeof StoredCatalogSchema>;
export const SummaryStampSchema = z.strictObject({
  size: z.number().int().nonnegative(),
  stamp: z.number().nonnegative(),
});
export type SummaryStamp = z.infer<typeof SummaryStampSchema>;
export const SummaryRowSchema = SummaryStampSchema.extend({ summary: z.string() });
export const RunSummarySchema = z.strictObject({
  run_id: z.string().min(1).max(ServerLimit.IdentityCharacters),
  client_id: z.string().min(1).max(ServerLimit.IdentityCharacters),
  harness_session_id: CallerSessionSchema.optional(),
  workflow_id: z.string().min(1).max(ServerLimit.SummaryCharacters).optional(),
  state: z.union([z.enum(RunStatus), z.enum(ServerState)]),
  stage: z.string().nullable().optional(),
  persona: z.string().nullable().optional(),
  project: z.string().max(ServerLimit.SummaryCharacters).nullable(),
  error: z.string().max(ServerLimit.SummaryCharacters).optional(),
});
export type RunSummary = z.infer<typeof RunSummarySchema>;
export const RunListQuerySchema = z.strictObject({
  before: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).default(Number.MAX_SAFE_INTEGER),
  limit: z
    .number()
    .int()
    .positive()
    .max(ServerLimit.RunPageMaximum)
    .default(ServerLimit.RunPageSize),
  client_id: z.string().min(1).max(ServerLimit.IdentityCharacters).optional(),
  harness_session_id: CallerSessionSchema.optional(),
  state: z.enum(RunStatus).optional(),
  project_path: z
    .string()
    .min(1)
    .max(ServerLimit.SummaryCharacters)
    .refine((path) => isAbsolute(path) && resolve(path) === path)
    .optional(),
});
export type RunListQuery = z.infer<typeof RunListQuerySchema>;
export type RunListQueryInput = z.input<typeof RunListQuerySchema>;
export const RunListSearchSchema = z
  .strictObject({
    before: z.string().regex(EventCursor.IntegerPattern).transform(Number).optional(),
    limit: z.string().regex(EventCursor.IntegerPattern).transform(Number).optional(),
    client_id: z.string().optional(),
    harness_session_id: z.string().optional(),
    project_path: z.string().optional(),
    state: z.string().optional(),
  })
  .pipe(RunListQuerySchema);
export const RunPageSchema = z
  .strictObject({
    schema_version: z.union([
      z.literal(ServerLimit.RunPageVersion),
      z.literal(ServerLimit.FilteredRunPageVersion),
    ]),
    runs: z.array(RunSummarySchema).max(ServerLimit.RunPageMaximum),
    before: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    next_before: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    has_more: z.boolean(),
  })
  .refine(
    (page) =>
      (page.next_before < page.before &&
        (page.runs.length > 0 || page.schema_version === ServerLimit.FilteredRunPageVersion)) ||
      (page.runs.length === 0 && !page.has_more && page.next_before === page.before),
  )
  .refine((page) => new Set(page.runs.map((run) => run.run_id)).size === page.runs.length);
export type RunPage = z.infer<typeof RunPageSchema>;

export const KnownHomeResultSchema = z.union([
  z.strictObject({ home: z.string(), page: RunPageSchema }),
  z.strictObject({ home: z.string().nullable(), error: z.string() }),
]);
export type KnownHomeResult = z.infer<typeof KnownHomeResultSchema>;

export const KnownHomePathSchema = z
  .string()
  .max(ServerLimit.SummaryCharacters)
  .refine(
    (path) => !path.includes(KnownHome.NullByte) && isAbsolute(path) && resolve(path) === path,
  );
