import {
  Backend,
  backendIds,
  ConfigDefault,
  ConfigInspection,
  ConfigSource,
  DaemonStartup,
  IdentifierPattern,
  MessageId,
  ModelVersionPattern,
  RecoverySessionMode,
  RequestLimit,
  RuntimeLimit,
  type ServerQueueField,
  type ServerResourceField,
  WorkspaceModeSetting,
} from "@titan/constants";
import { ConfigMessage } from "@titan/messages";
import { z } from "zod";
import { AgentHostSettingsSchema } from "./agent-host-settings.ts";
import { FakeScriptSchema } from "./agents.ts";
import { ApprovalPolicySchema } from "./approval-policy.ts";
import { BackendLaunchesSchema } from "./backend-launch.ts";
import { KnowledgeSettingsSchema } from "./knowledge.ts";
import { LogSettingsSchema } from "./logging.ts";
import { NativeToolServerSettingsSchema } from "./native-tools.ts";
import { PolicyWeightsSchema } from "./policy.ts";
import { RequestLedgerOptionsSchema } from "./requests.ts";
import { ClientSettingsSchema } from "./submission-receipts.ts";
import { UpdateSettingsSchema } from "./updates.ts";
import { WorkspaceLimitsSchema } from "./workspace-limits.ts";

const count = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export {
  type WorkspaceLimits,
  type WorkspaceLimitsInput,
  WorkspaceLimitsSchema,
} from "./workspace-limits.ts";
export const LimitsSchema = WorkspaceLimitsSchema.extend({
  max_steps: count.default(ConfigDefault.MaxSteps),
  max_parallel: count.default(ConfigDefault.MaxParallel),
  max_group_depth: count.max(ConfigDefault.MaxGroupDepthLimit).default(ConfigDefault.MaxGroupDepth),
  max_minutes: z.number().positive().nullable().default(null),
});
export const RecoveryFields = z.strictObject({
  max_retries: z.number().int().nonnegative().default(ConfigDefault.MaxRetries),
  base_delay_s: z.number().positive().default(ConfigDefault.BaseDelaySeconds),
  max_delay_s: z.number().positive().default(ConfigDefault.MaxDelaySeconds),
  jitter_ratio: z.number().min(0).max(1).default(ConfigDefault.JitterRatio),
  session_mode: z.enum(RecoverySessionMode).default(RecoverySessionMode.NativeOnly),
});
export const RecoverySchema = RecoveryFields.refine(
  (v) => v.max_delay_s >= v.base_delay_s,
  ConfigMessage[MessageId.RecoveryDelayOrder],
);
export const DefaultsSchema = z.strictObject({
  backend: z.enum(backendIds).nullable().default(null),
  model: z
    .string()
    .min(1)
    .refine((name) => !ModelVersionPattern.test(name), ConfigMessage[MessageId.ModelVersion])
    .nullable()
    .default(null),
  max_attempts: count.default(ConfigDefault.MaxAttempts),
  claude_max_turns: count.default(ConfigDefault.ClaudeMaxTurns),
  candidates: count.max(ConfigDefault.MaxCandidates).default(ConfigDefault.Candidates),
});

export type Defaults = z.infer<typeof DefaultsSchema>;

export const WorkspaceSettingsSchema = z.strictObject({
  mode: z.enum(WorkspaceModeSetting).default(WorkspaceModeSetting.Live),
});
export type WorkspaceSettings = z.infer<typeof WorkspaceSettingsSchema>;

export { type AgentHostSettings, AgentHostSettingsSchema } from "./agent-host-settings.ts";
export {
  type BackendLaunch,
  BackendLaunchesSchema,
  BackendLaunchSchema,
  type ClaudeLaunch,
  ClaudeLaunchSchema,
} from "./backend-launch.ts";
export const AgentCapacitySchema = z.strictObject({
  max_active_agents: count.default(ConfigDefault.MaxActiveAgents),
  max_pending_agents: z
    .number()
    .int()
    .nonnegative()
    .max(ConfigDefault.MaxPendingAgentsLimit)
    .default(ConfigDefault.MaxPendingAgents),
});
export const BackendCapacitySchema = z.strictObject({
  [Backend.Codex]: count.nullable().optional(),
  [Backend.Claude]: count.nullable().optional(),
  [Backend.Fake]: count.nullable().optional(),
});
export type BackendCapacity = z.infer<typeof BackendCapacitySchema>;
export const BackendCapacitySettingsSchema = z.strictObject({
  backend_limits: BackendCapacitySchema.optional(),
});
export const RequestSettingsSchema = z.strictObject({
  max_per_run: count.max(RequestLimit.PerRun).default(RequestLimit.PerRun),
});
export const RequestQueueSettingsSchema = z.strictObject({
  max_pending_request_operations: RequestLedgerOptionsSchema.shape.max_pending_operations,
});
export const RunResidencySettingsSchema = z.strictObject({
  max_resident_runs: count.max(RuntimeLimit.ResidentRuns).default(RuntimeLimit.ResidentRuns),
});
export const EngineSettingsSchema = AgentCapacitySchema.extend({
  ...BackendCapacitySettingsSchema.shape,
  ...RequestQueueSettingsSchema.shape,
  ...RunResidencySettingsSchema.shape,
});
export type EngineSettingsInput = z.input<typeof EngineSettingsSchema>;

export const RunQueueSettingsSchema = z.strictObject({
  max_pending_run_operations: count
    .max(RuntimeLimit.PendingOperations)
    .default(RuntimeLimit.PendingOperations),
  max_pending_submissions: count
    .max(RuntimeLimit.PendingOperations)
    .default(RuntimeLimit.PendingOperations),
});
const ServerSettingsSchema = z.strictObject({
  startup_timeout_ms: count.max(DaemonStartup.TimeoutMilliseconds).optional(),
  agent_host: AgentHostSettingsSchema.extend({
    worker_threads: AgentHostSettingsSchema.shape.worker_threads.removeDefault().optional(),
  }).prefault({}),
  logging: LogSettingsSchema.optional(),
  knowledge: KnowledgeSettingsSchema.optional(),
  native_tools: NativeToolServerSettingsSchema.extend({
    transport: NativeToolServerSettingsSchema.shape.transport.removeDefault().optional(),
  }).prefault({}),
  ...AgentCapacitySchema.shape,
  ...BackendCapacitySettingsSchema.shape,
  max_pending_request_operations: RequestQueueSettingsSchema.shape.max_pending_request_operations
    .removeDefault()
    .optional(),
  max_pending_run_operations: RunQueueSettingsSchema.shape.max_pending_run_operations
    .removeDefault()
    .optional(),
  max_pending_submissions: RunQueueSettingsSchema.shape.max_pending_submissions
    .removeDefault()
    .optional(),
  max_resident_runs: RunResidencySettingsSchema.shape.max_resident_runs.removeDefault().optional(),
  backends: BackendLaunchesSchema.prefault({}),
});
export const WorkflowBackendsSchema = z.strictObject({
  [Backend.Fake]: z.strictObject({ script: FakeScriptSchema }).optional(),
});
export const ConfigSchema = z.strictObject({
  schema_version: z.literal(ConfigDefault.SchemaVersion).default(ConfigDefault.SchemaVersion),
  defaults: DefaultsSchema.prefault({}),
  limits: LimitsSchema.prefault({}),
  recovery: RecoverySchema.prefault({}),
  approvals: ApprovalPolicySchema.optional(),
  policy: PolicyWeightsSchema.optional(),
  requests: RequestSettingsSchema.optional(),
  workspace: WorkspaceSettingsSchema.optional(),
  backends: WorkflowBackendsSchema.optional(),
  server: ServerSettingsSchema.prefault({}),
  client: ClientSettingsSchema.optional(),
  update: UpdateSettingsSchema.optional(),
});
export type Config = z.infer<typeof ConfigSchema>;
export const ConfigSourcesSchema = z.record(z.string(), z.array(z.string()));
export type ConfigSources = z.infer<typeof ConfigSourcesSchema>;
export const EffectiveConfigSchema = z.strictObject({
  value: ConfigSchema,
  hash: z.string().min(1),
  sources: ConfigSourcesSchema,
});
export type EffectiveConfig = z.infer<typeof EffectiveConfigSchema>;
export const ConfigResolutionSchema = z.strictObject({
  home: z.string().min(1),
  project: z.string().min(1),
  configFile: z.string().optional(),
  workflow: z.unknown().optional(),
  overrides: z.unknown().optional(),
});
export type ConfigResolution = z.infer<typeof ConfigResolutionSchema>;
export const ConfigLayerSchema = z.strictObject({
  source: z.enum(ConfigSource),
  path: z.string().optional(),
  value: z.unknown(),
  limited: z.boolean(),
});
export type ConfigLayer = z.infer<typeof ConfigLayerSchema>;
export function overrideSchema<T extends Record<string, z.ZodType>>(
  schema: z.ZodObject<T>,
): z.ZodObject<{ [K in keyof T]: z.ZodOptional<T[K]> }> {
  const fields: Record<string, z.ZodType> = {};
  for (const [key, value] of Object.entries(schema.shape)) {
    fields[key] = z.optional(value instanceof z.ZodDefault ? value.removeDefault() : value);
  }
  return z.strictObject(fields) as z.ZodObject<{ [K in keyof T]: z.ZodOptional<T[K]> }>;
}

export const RunSettingOverridesSchema = z.strictObject({
  defaults: overrideSchema(DefaultsSchema).optional(),
  limits: overrideSchema(LimitsSchema).optional(),
  recovery: overrideSchema(RecoveryFields).optional(),
  approvals: overrideSchema(ApprovalPolicySchema).optional(),
  requests: overrideSchema(RequestSettingsSchema).optional(),
  workspace: overrideSchema(WorkspaceSettingsSchema).optional(),
  backends: WorkflowBackendsSchema.optional(),
});

export type OwnerBudgetField = ServerQueueField | ServerResourceField;

export const RunConfigurationSchema = z.strictObject({
  schema_version: z.literal(ConfigInspection.Version),
  run_id: z.string().regex(IdentifierPattern),
  workflow_id: z.string().min(1),
  workflow_revision: z.string().regex(RequestLimit.HashPattern),
  through: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  config: EffectiveConfigSchema.extend({ hash: z.string().regex(RequestLimit.HashPattern) }),
});
export type RunConfiguration = z.infer<typeof RunConfigurationSchema>;
