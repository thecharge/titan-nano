import {
  AttemptVerdict,
  Backend,
  CliRuntime,
  DashboardBuild,
  DashboardPolicy,
  DashboardRoute,
  KnowledgeState,
  MeasureState,
  ProofAnswer,
  RunStatus,
} from "@titan/constants";
import { z } from "zod";
import type { ArtifactInspection, ArtifactPage, ArtifactQueryInput } from "./artifacts.ts";
import { type EventPage, RunEventViewSchema } from "./board.ts";
import { CapacitySnapshotSchema } from "./capacity.ts";
import {
  type RunListQueryInput,
  RunPageSchema,
  RunSummarySchema,
  SummaryStampSchema,
} from "./catalog.ts";
import type { RunConfiguration } from "./config.ts";
import {
  ScopedKnowledgeListResultSchema,
  ScopedKnowledgeListSchema,
  ScopedKnowledgeShowSchema,
  ScopedKnowledgeStatsSchema,
} from "./knowledge-scope.ts";

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const MeasureSchema = z
  .strictObject({
    state: z.enum(MeasureState),
    value: z.number().nonnegative().nullable(),
    missing: count,
    label: z.string().min(1),
  })
  .refine((measure) => (measure.state === MeasureState.NotReported) === (measure.value === null));
export type Measure = z.infer<typeof MeasureSchema>;

export const ProofCountsSchema = z.strictObject({
  proven: count,
  refuted: count,
  not_proven: count,
});
export type ProofCounts = z.infer<typeof ProofCountsSchema>;

export const RunNumbersSchema = z.strictObject({
  run_id: z.string().min(1),
  workflow_id: z.string().min(1),
  state: z.enum(RunStatus),
  started_at: z.number().nonnegative(),
  elapsed: z.number().nonnegative(),
  attempts: count,
  most_agents_at_once: count,
  input_tokens: MeasureSchema,
  output_tokens: MeasureSchema,
  cost_usd: MeasureSchema,
  survived: count,
  refuted: count,
  proofs: ProofCountsSchema,
});
export type RunNumbers = z.infer<typeof RunNumbersSchema>;
export const StoredRunNumbersSchema = SummaryStampSchema.extend({ numbers: z.string() });

export const DashboardWorkingSchema = z.strictObject({
  stage: z.string().nullable(),
  persona: z.string().nullable(),
});
export type DashboardWorking = z.infer<typeof DashboardWorkingSchema>;

export const DashboardRunEntrySchema = z.strictObject({
  summary: RunSummarySchema,
  stage: z.string().nullable(),
  persona: z.string().nullable(),
  numbers: RunNumbersSchema.nullable(),
});
export type DashboardRunEntry = z.infer<typeof DashboardRunEntrySchema>;
export const DashboardRunPaginationSchema = z.strictObject({
  schema_version: RunPageSchema.shape.schema_version,
  before: RunPageSchema.shape.before,
  next_before: RunPageSchema.shape.next_before,
  has_more: RunPageSchema.shape.has_more,
});
export type DashboardRunPagination = z.infer<typeof DashboardRunPaginationSchema>;
export const DashboardRunListSchema = z.strictObject({
  runs: z.array(DashboardRunEntrySchema),
  page: DashboardRunPaginationSchema.optional(),
  capacity: CapacitySnapshotSchema.optional(),
});
export type DashboardRunList = z.infer<typeof DashboardRunListSchema>;

export const DashboardAttemptSchema = z.strictObject({
  attempt: z.number().int().positive(),
  verdict: z.enum(AttemptVerdict),
  evidence: z.array(z.string()),
});
export const DashboardCheckSchema = z.strictObject({
  phase: z.string(),
  answer: z.string(),
});
export const DashboardPhaseRecoverySchema = z.strictObject({
  phase: z.string().min(1),
  executions: count,
  retries: count,
  next_retry: z.number().nonnegative().nullable(),
  capture_pending: z.boolean(),
  error: z.string().nullable(),
});
export const DashboardStepSchema = z.strictObject({
  id: z.string().min(1),
  persona: z.string().nullable(),
  state: z.string().min(1),
  attempts: z.array(DashboardAttemptSchema),
  checks: z.array(DashboardCheckSchema),
  needs: z.array(z.string().min(1)).optional(),
  recovery: z.array(DashboardPhaseRecoverySchema).optional(),
});
export type DashboardStep = z.infer<typeof DashboardStepSchema>;
export const DashboardRequestSchema = z.strictObject({
  request_id: z.string().min(1),
  kind: z.string().min(1),
  answer_command: z.string().min(1),
});
export const DashboardRunContextSchema = z.strictObject({
  backend: z.enum(Backend),
  runtime_version: z.string().nullable(),
  project: z.string().min(1),
  max_parallel: z.number().int().positive(),
  error: z.string().nullable(),
  artifacts: z.string().nullable(),
});
export type DashboardRunContext = z.infer<typeof DashboardRunContextSchema>;
export const DashboardRunSchema = z.strictObject({
  numbers: RunNumbersSchema,
  steps: z.array(DashboardStepSchema),
  board: z.array(RunEventViewSchema),
  requests: z.array(DashboardRequestSchema),
  answer_hint: z.string().min(1),
  context: DashboardRunContextSchema.optional(),
});
export type DashboardRun = z.infer<typeof DashboardRunSchema>;

export const ProofEventDataSchema = z.object({
  answer: z.enum(ProofAnswer),
  step_id: z.string().min(1).optional(),
  phase: z.string().min(1).optional(),
});

export const DashboardKnowledgeQuerySchema = ScopedKnowledgeListSchema.pick({
  kind: true,
  scope: true,
  tag: true,
  state: true,
})
  .extend({
    run_id: z.string().min(1).max(256).optional(),
    id: z.uuid().optional(),
    before: z
      .string()
      .regex(CliRuntime.PositiveIntegerPattern)
      .transform(Number)
      .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER))
      .optional(),
  })
  .refine((query) => query.before === undefined || query.id !== undefined)
  .refine((query) => query.state !== KnowledgeState.Pending || query.id === undefined);
export type DashboardKnowledgeQuery = z.infer<typeof DashboardKnowledgeQuerySchema>;
export const DashboardKnowledgeSchema = z.strictObject({
  list: ScopedKnowledgeListResultSchema,
  stats: ScopedKnowledgeStatsSchema,
  entry: ScopedKnowledgeShowSchema.nullable(),
});
export type DashboardKnowledge = z.infer<typeof DashboardKnowledgeSchema>;
export type DashboardKnowledgeReader = (
  query: DashboardKnowledgeQuery,
) => Promise<DashboardKnowledge>;

export interface DashboardSource {
  configuration?(id: string): Promise<RunConfiguration>;
  artifacts?(id: string): Promise<ArtifactInspection>;
  artifact?(id: string, file: string, query: ArtifactQueryInput): Promise<ArtifactPage>;
  knowledge?: DashboardKnowledgeReader;
  list(query?: RunListQueryInput): Promise<DashboardRunList>;
  run(id: string): Promise<DashboardRun>;
  events(id: string, after: number): Promise<EventPage>;
}

export const DashboardAttemptRecordSchema = z.strictObject({
  attempt: z.number().int().positive(),
  verdict: z.enum(AttemptVerdict),
});
export type DashboardAttemptRecord = z.infer<typeof DashboardAttemptRecordSchema>;
export type DashboardLoad = (id: string) => Promise<void>;

export const DashboardAssetSchema = z.strictObject({
  body: z.union([z.string(), z.instanceof(Blob)]),
  type: z.string(),
});
export type DashboardAsset = z.infer<typeof DashboardAssetSchema>;

export const DashboardPackedAssetsSchema = z
  .array(
    z.strictObject({
      path: z
        .string()
        .refine((path) => path === DashboardRoute.Page || DashboardRoute.AssetPattern.test(path)),
      body: z.string(),
      type: z.enum([
        DashboardPolicy.Html,
        DashboardPolicy.Script,
        DashboardPolicy.Style,
        DashboardPolicy.Plain,
      ]),
    }),
  )
  .min(1)
  .max(DashboardBuild.MaximumAssets)
  .refine((assets) => new Set(assets.map((asset) => asset.path)).size === assets.length)
  .refine((assets) =>
    assets.some(
      (asset) => asset.path === DashboardRoute.Page && asset.type === DashboardPolicy.Html,
    ),
  );

export const DashboardCodeBodySchema = z.strictObject({
  code: z.string().min(1),
  url: z.string().min(1),
});
export type DashboardCodeBody = z.infer<typeof DashboardCodeBodySchema>;
export const DashboardLoginSchema = z.strictObject({ link: z.string().min(1) });
export type DashboardLogin = z.infer<typeof DashboardLoginSchema>;
export interface DashboardClient {
  login(): Promise<DashboardLogin>;
}
export const ServerAddressSchema = z.strictObject({ url: z.string().min(1) });
export type ServerAddress = z.infer<typeof ServerAddressSchema>;

export const DashboardCommandOutputSchema = z.looseObject({
  operation: z.string(),
  data: DashboardLoginSchema,
});
