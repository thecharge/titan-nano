import {
  ApprovalLevel,
  Backend,
  BoardDecision,
  BoardLimit,
  BoardPostKind,
  EventCursor,
  ExecutionDelivery,
  ExecutionPhase,
  IdentifierPattern,
  Packaging,
  RequestDecision,
  RequestLimit,
  RunFormat,
  RunResultFormat,
  RunStatus,
  RuntimeLimit,
  ServerLimit,
  StepStatus,
} from "@titan/constants";
import { z } from "zod";
import { FailureKindSchema, UsageSchema } from "./agents.ts";
import { ArtifactHashSchema } from "./artifacts.ts";
import { EffectiveConfigSchema } from "./config.ts";
import {
  FileExecutionClaimSchema,
  FileReadPathsSchema,
  FileWriteInputSchema,
  FileWritePathsSchema,
} from "./file-access.ts";
import { NativeFileObservationsSchema } from "./native-files.ts";
import { PersonaRunRecordSchema } from "./persona-lifecycle.ts";
import { ProofSummarySchema } from "./proof-report.ts";
import { PhaseRequestTurnSchema } from "./request-turns.ts";
import { RequestExecutionSchema } from "./requests.ts";
import { PlanSchema, WorkflowSourceSchema } from "./workflow.ts";
import { WorkspaceOmissionsSchema, WorkspaceSkillEntrySchema } from "./workspace.ts";

export const CallerSessionSchema = z.string().min(1).max(ServerLimit.IdentityCharacters);

export const RunRuntimeVersionSchema = z
  .string()
  .max(ServerLimit.IdentityCharacters)
  .regex(Packaging.PinnedVersionPattern);

export const RunOriginSchema = z.strictObject({
  client_id: z.string().min(1),
  submission_id: z.string().min(1),
  harness_session_id: CallerSessionSchema.optional(),
  runtime_version: RunRuntimeVersionSchema.optional(),
  runtime_build: ArtifactHashSchema.optional(),
  persona_references: PersonaRunRecordSchema.optional(),
});
export type RunOrigin = z.infer<typeof RunOriginSchema>;

export const RunValidationCacheSchema = z.strictObject({
  configuration: z.string().nullable(),
  plan: z.string().nullable(),
});
export type RunValidationCache = z.infer<typeof RunValidationCacheSchema>;

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const HelperTurnSchema = z.strictObject({
  request_id: z.string().regex(IdentifierPattern),
  origin: RequestExecutionSchema,
  harness_session_id: z.string().min(1),
  persona: z.string().min(1).max(RequestLimit.TextCharacters),
  question: z.string().min(1).max(RequestLimit.InputBytes),
  received: z.boolean(),
});
export const PhaseSchema = z
  .strictObject({
    helper: HelperTurnSchema.optional(),
    candidate_hash: ArtifactHashSchema.optional(),
    file_claim: FileExecutionClaimSchema.optional(),
    file_reads: NativeFileObservationsSchema.optional(),
    capture_pending: z.literal(true).optional(),
    delivery: z.enum(ExecutionDelivery).optional(),
    dispatches: count.optional(),
    request_turn: PhaseRequestTurnSchema.optional(),
    session_id: z.string().min(1).nullable(),
    execution_id: z.string().min(1).nullable(),
    executions: count,
    retries: count,
    next_retry: z.number().nonnegative().nullable(),
    completed: z.boolean(),
    answer: z.unknown(),
    usage: z.array(UsageSchema),
    error: z.string().nullable(),
  })
  .refine((phase) => phase.capture_pending === undefined || !phase.completed)
  .refine((phase) =>
    phase.delivery === undefined
      ? phase.dispatches === undefined
      : phase.dispatches !== undefined &&
        phase.execution_id !== null &&
        phase.executions > 0 &&
        phase.dispatches <= phase.executions &&
        phase.usage.length <= phase.dispatches &&
        (phase.delivery === ExecutionDelivery.Prepared
          ? phase.dispatches < phase.executions
          : phase.dispatches > 0),
  );
export type Phase = z.infer<typeof PhaseSchema>;
export const ReconciliationGenerationSchema = z
  .strictObject({
    input: z.string().min(1),
    input_hash: ArtifactHashSchema,
    phases: z.record(z.string(), PhaseSchema),
  })
  .refine((generation) => {
    const worker = generation.phases[ExecutionPhase.Worker];
    return Boolean(worker?.capture_pending || (worker?.completed && worker.candidate_hash));
  });
export type ReconciliationGeneration = z.infer<typeof ReconciliationGenerationSchema>;
export const NodeStateSchema = z.strictObject({
  reconciliations: z
    .array(ReconciliationGenerationSchema)
    .min(1)
    .max(RuntimeLimit.PendingOperations)
    .optional(),
  read_paths: FileReadPathsSchema.optional(),
  write_paths: FileWritePathsSchema.optional(),
  write_inputs: z.array(FileWriteInputSchema).min(1).max(RuntimeLimit.PendingOperations).optional(),
  state: z.enum(StepStatus),
  attempt: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  refutations: count,
  phases: z.record(z.string(), PhaseSchema),
  evidence: z.array(z.string()),
  failures: z.array(FailureKindSchema).optional(),
  input: z.string().nullable(),
  work: z.string().nullable(),
  snapshot: z.string().nullable(),
  changes: z.record(z.string(), z.string().nullable()),
  output: z.unknown(),
});
export type NodeState = z.infer<typeof NodeStateSchema>;
export const StepRestartSchema = z.strictObject({
  step_id: z.string().min(1),
  attempt: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  checkpoint: z.string().nullable(),
  segment: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});
export type StepRestart = z.infer<typeof StepRestartSchema>;
export const RunFormatProbeSchema = z.object({
  state: z.object({ schema_version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }),
});

export const RunSchemaVersionSchema = z.union([
  z.literal(RunFormat.Legacy),
  z.literal(RunFormat.ExecutionRequests),
  z.literal(RunFormat.RequestTurns),
  z.literal(RunFormat.CallerSessions),
  z.literal(RunFormat.PinnedRuntime),
  z.literal(RunFormat.CaptureReceipts),
  z.literal(RunFormat.FileObservations),
  z.literal(RunFormat.ReadClaims),
  z.literal(RunFormat.Reconciliation),
  z.literal(RunFormat.WriteClaims),
  z.literal(RunFormat.PersonaBindings),
  z.literal(RunFormat.HelperTurns),
  z.literal(RunFormat.PersonaAnswers),
  z.literal(RunFormat.ScriptProofs),
  z.literal(RunFormat.ProofReports),
  z.literal(RunFormat.GoalProofs),
  z.literal(RunFormat.ProofCaptures),
  z.literal(RunFormat.PinnedBuild),
  z.literal(RunFormat.ScriptCandidates),
]);
export type RunSchemaVersion = z.infer<typeof RunSchemaVersionSchema>;

export const GoalStateSchema = NodeStateSchema.extend({ result_hash: ArtifactHashSchema }).refine(
  (goal) =>
    Object.values(goal.phases).every(
      (phase) => phase.executions === 0 && phase.usage.length === 0 && phase.helper === undefined,
    ),
);
export type GoalState = z.infer<typeof GoalStateSchema>;

export const RunSchema = z
  .strictObject({
    schema_version: RunSchemaVersionSchema,
    proofs: ProofSummarySchema.optional(),
    goal: GoalStateSchema.optional(),
    run_id: z.string().regex(IdentifierPattern),
    workflow_id: z.string().min(1),
    workflow_revision: z.string().min(1),
    persona_references: PersonaRunRecordSchema.optional(),
    submission_id: z.string().min(1),
    client_id: z.string().min(1),
    harness_session_id: CallerSessionSchema.optional(),
    runtime_version: RunRuntimeVersionSchema.optional(),
    runtime_build: ArtifactHashSchema.optional(),
    request_hash: z.string().min(1),
    project: z.string().min(1),
    runtime_paths: WorkspaceOmissionsSchema.optional(),
    omit_generated_workspace: z.literal(true).optional(),
    workspace_skills: z
      .strictObject({
        index: z.array(WorkspaceSkillEntrySchema),
        files: z.array(
          z.strictObject({
            name: z.string().min(1),
            path: z.string().min(1),
            content: z.string(),
            hash: ArtifactHashSchema,
          }),
        ),
      })
      .optional(),
    root: z.string().min(1),
    version: count,
    created_at: z.number().nonnegative(),
    state: z.enum(RunStatus),
    error: z.string().nullable(),
    pending_journal: z
      .strictObject({
        state: z.enum([
          RunStatus.Passed,
          RunStatus.Failed,
          RunStatus.Cancelled,
          RunStatus.TimedOut,
          RunStatus.Blocked,
        ]),
        error: z.string().nullable(),
      })
      .optional(),
    config: EffectiveConfigSchema,
    plan: PlanSchema,
    source_plan: PlanSchema.optional(),
    picks: z.record(z.string(), z.string().min(1)).optional(),
    backend: z.enum(Backend),
    switched_backend: z.enum(Backend).optional(),
    nodes: z.record(z.string(), NodeStateSchema),
    base: z.string().min(1),
    base_hash: z.string().min(1),
    artifacts: z.string().nullable(),
  })
  .refine(
    (run) =>
      run.schema_version >= RunFormat.CaptureReceipts ||
      run.schema_version === RunFormat.PinnedRuntime ||
      (run.schema_version === RunFormat.CallerSessions) === (run.harness_session_id !== undefined),
  )
  .refine(
    (run) =>
      run.schema_version >= RunFormat.CaptureReceipts ||
      (run.schema_version === RunFormat.PinnedRuntime) === (run.runtime_version !== undefined),
  )
  .refine(
    (run) =>
      (run.schema_version >= RunFormat.ScriptCandidates ||
        run.schema_version >= RunFormat.PinnedBuild === (run.runtime_build !== undefined)) &&
      (run.runtime_build === undefined || run.runtime_version !== undefined),
  );
export type Run = z.infer<typeof RunSchema>;

export const FailedRunResultSchema = z.strictObject({
  schema_version: z.union([
    z.literal(RunResultFormat.FailureVersion),
    z.literal(RunResultFormat.ProofVersion),
  ]),
  run_id: RunSchema.shape.run_id,
  workflow_id: RunSchema.shape.workflow_id,
  workflow_revision: RunSchema.shape.workflow_revision,
  name: z.string(),
  goal: z.string(),
  state: z.literal(RunStatus.Failed),
  steps: z.record(
    z.string(),
    NodeStateSchema.pick({
      state: true,
      attempt: true,
      refutations: true,
      evidence: true,
    }),
  ),
});
export const RunResultSchema = FailedRunResultSchema.extend({
  state: z.enum([RunStatus.Passed, RunStatus.Failed]),
  outputs: z.record(z.string(), z.unknown()).optional(),
}).refine((result) => (result.state === RunStatus.Passed) === (result.outputs !== undefined));

export const RunEventSchema = z.strictObject({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  time: z.number().nonnegative(),
  type: z.string().min(1),
  data: z.unknown(),
  state: RunSchema,
});
export type RunEvent = z.infer<typeof RunEventSchema>;
export const BoardPostSchema = z.strictObject({
  from: z.string().min(1),
  to: z.string().min(1),
  kind: z.string().min(1),
  text: z.string(),
});
export type BoardPost = z.infer<typeof BoardPostSchema>;
export const BoardStepAddedSchema = z.strictObject({
  kind: z.literal(BoardPostKind.StepAdded),
  step_id: z.string().min(1),
  added_by: z.string().min(1),
});
export type BoardStepAdded = z.infer<typeof BoardStepAddedSchema>;
export const BoardPersonaPickedSchema = z.strictObject({
  kind: z.literal(BoardPostKind.PersonaPicked),
  step_id: z.string().min(1),
  persona: z.string().min(1),
  rule: z.string().min(1),
  seed: z.number().int().nonnegative().optional(),
  eligible: z.array(z.string().min(1)).optional(),
});
export type BoardPersonaPicked = z.infer<typeof BoardPersonaPickedSchema>;
export const BoardDecisionSchema = z.strictObject({
  kind: z.literal(BoardDecision.Kind),
  request_id: z.string().min(1),
  level: z.enum(ApprovalLevel),
  by: z.string().min(1),
  answer: z.enum(RequestDecision),
  reason: z.string().min(1),
  rule: z.string().min(1).optional(),
});
export type BoardDecisionLine = z.infer<typeof BoardDecisionSchema>;
export const BoardLineSchema = z.strictObject({ text: z.string(), end: count });
export type BoardLine = z.infer<typeof BoardLineSchema>;
export const RunEventViewSchema = RunEventSchema.omit({ state: true });
export type RunEventView = z.infer<typeof RunEventViewSchema>;
export const EventQuerySchema = z.strictObject({
  after: count.default(0),
  limit: z
    .number()
    .int()
    .positive()
    .max(BoardLimit.EventPageSize)
    .default(BoardLimit.EventPageSize),
});
export type EventQueryInput = z.input<typeof EventQuerySchema>;
export const EventSearchSchema = z
  .strictObject({
    after: z.string().regex(EventCursor.IntegerPattern).transform(Number).optional(),
    limit: z.string().regex(EventCursor.IntegerPattern).transform(Number).optional(),
  })
  .pipe(EventQuerySchema);
export const EventPageSchema = z
  .strictObject({
    schema_version: z.literal(BoardLimit.EventPageVersion),
    run_id: z.string().regex(IdentifierPattern),
    after: count,
    events: z.array(RunEventViewSchema).max(BoardLimit.EventPageSize),
    next_cursor: count,
    has_more: z.boolean(),
  })
  .refine((page) => page.events.every((event, index) => event.id === page.after + index + 1))
  .refine((page) => page.next_cursor === (page.events.at(-1)?.id ?? page.after))
  .refine((page) => !page.has_more || page.events.length > 0)
  .refine((page) => Buffer.byteLength(JSON.stringify(page)) <= BoardLimit.EventPageBytes);
export type EventPage = z.infer<typeof EventPageSchema>;

export const RunCreationSchema = z.strictObject({
  project: z.string(),
  plan: PlanSchema,
  resolved_plan: PlanSchema.optional(),
  persona_references: PersonaRunRecordSchema.optional(),
  config: EffectiveConfigSchema,
  backend: z.enum(Backend),
  client_id: z.string(),
  submission_id: z.string(),
  harness_session_id: CallerSessionSchema.optional(),
  workflow_path: z.string().optional(),
  workflow_source: WorkflowSourceSchema.optional(),
  run_id: z.string().optional(),
});
export type RunCreation = z.infer<typeof RunCreationSchema>;
