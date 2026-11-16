import { resolve } from "node:path";
import {
  AgentEventKind,
  AgentHost,
  Backend,
  ClaudeCreditCode,
  ClaudeEventKind,
  ClaudeGlobPattern,
  ClaudeRetryCause,
  ClaudeRetryLimit,
  FailureKind,
  FakeScriptField,
  FakeScriptLimit,
  FileAccessMode,
  IdentifierPattern,
  PathPart,
  PersonaReferencePattern,
  Verdict,
} from "@titan/constants";
import { FakeMessage, invocationId } from "@titan/messages";
import { z } from "zod";
import { FileExecutionClaimSchema, FileReadPathsSchema } from "./file-access.ts";
import { WorkspaceRelativePathSchema } from "./workspace.ts";

export const ObjectSchema = z.record(z.string(), z.unknown());
export type JsonSchema = z.infer<typeof ObjectSchema>;
export const JsonValueSchema = z.json();
export type JsonValue = z.infer<typeof JsonValueSchema>;
export const BackendIdSchema = z.enum(Backend);
export type BackendId = z.infer<typeof BackendIdSchema>;
export const UsageSchema = z.strictObject({
  input_tokens: z.number().int().nonnegative().nullable(),
  output_tokens: z.number().int().nonnegative().nullable(),
  cost_usd: z.number().nonnegative().nullable(),
});
export type Usage = z.infer<typeof UsageSchema>;
export const AgentEventSchema = z.strictObject({
  type: z.enum(AgentEventKind),
  session_id: z.string().nullable(),
  data: z.unknown(),
});
export type AgentEvent = z.infer<typeof AgentEventSchema>;
export const FakeInvocationSchema = z.object({
  persona_id: z.union([
    z.string().regex(IdentifierPattern),
    z.string().regex(PersonaReferencePattern),
  ]),
  attempt: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  execution: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});
export const FakePromptSchema = z.object({ task: z.string().min(1) });
export const FakeScriptEntrySchema = z.strictObject({
  persona: FakeInvocationSchema.shape.persona_id,
  task: FakePromptSchema.shape.task,
  attempt: FakeInvocationSchema.shape.attempt.default(FakeScriptLimit.FirstExecution),
  execution: FakeInvocationSchema.shape.execution.default(FakeScriptLimit.FirstExecution),
  answer: JsonValueSchema,
});
export const FakeScriptSchema = z
  .strictObject({
    version: z.literal(FakeScriptLimit.Version),
    answers: z.array(FakeScriptEntrySchema).max(FakeScriptLimit.Entries),
  })
  .refine(
    (script) => {
      const keys = script.answers.map((entry) =>
        JSON.stringify([entry.persona, entry.task, entry.attempt, entry.execution]),
      );
      return new Set(keys).size === keys.length;
    },
    { path: [FakeScriptField.Answers], message: FakeMessage.Duplicate },
  );
export type FakeScript = z.infer<typeof FakeScriptSchema>;

export const AgentFileScopeSchema = z.strictObject({
  mode: z.enum(FileAccessMode),
  claim: FileExecutionClaimSchema.optional(),
  paths: z
    .array(z.union([WorkspaceRelativePathSchema, z.literal(PathPart.Current)]))
    .min(1)
    .max(AgentHost.MaximumClaims),
  read_paths: FileReadPathsSchema.optional(),
  exclude_paths: FileReadPathsSchema.optional(),
});
export type AgentFileScope = z.infer<typeof AgentFileScopeSchema>;

export const AgentSpecSchema = z
  .strictObject({
    persona_id: FakeInvocationSchema.shape.persona_id.optional(),
    attempt: FakeInvocationSchema.shape.attempt.optional(),
    execution: FakeInvocationSchema.shape.execution.optional(),
    run_id: z.string().min(1),
    invocation_id: z.string().min(1),
    execution_id: z.string().min(1),
    cwd: z.string().min(1),
    file_scope: AgentFileScopeSchema.optional(),
    role: z.string(),
    model: z.string().nullable(),
    tools: z.array(z.string()),
    output_schema: ObjectSchema.nullable(),
    writable: z.boolean(),
    max_turns: z.number().int().positive(),
  })
  .refine((spec) => {
    const scope = spec.file_scope;
    const claim = scope?.claim;
    return (
      !claim ||
      (spec.run_id === claim.run_id &&
        spec.execution_id === claim.execution_id &&
        spec.attempt === claim.attempt &&
        spec.invocation_id === invocationId(claim.step_id, claim.attempt, claim.phase) &&
        resolve(spec.cwd) === claim.project &&
        scope.mode === claim.mode &&
        JSON.stringify(scope.paths.map((path) => resolve(spec.cwd, path))) ===
          JSON.stringify(claim.paths) &&
        JSON.stringify(scope.read_paths?.map((path) => resolve(spec.cwd, path))) ===
          JSON.stringify(claim.read_paths))
    );
  });
export type AgentSpec = z.infer<typeof AgentSpecSchema>;
export const AgentAnswerSchema = z.strictObject({
  text: z.string(),
  json: z.unknown(),
  session_id: z.string().min(1),
  usage: UsageSchema,
});
export type AgentAnswer = z.infer<typeof AgentAnswerSchema>;
export const BackendCapabilitiesSchema = z.strictObject({
  resume: z.boolean(),
  builtinTools: z.boolean(),
  structuredOutput: z.boolean(),
});
export type BackendCapabilities = z.infer<typeof BackendCapabilitiesSchema>;

export const ClaudeUsageSchema = z.object({
  modelUsage: z.record(
    z.string(),
    z.object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
    }),
  ),
  total_cost_usd: z.number().nonnegative(),
});

export const FailureKindSchema = z.enum(FailureKind);
export const FalsifierAnswerSchema = z
  .strictObject({
    verdict: z.enum(Verdict),
    evidence: z.string(),
    failure: FailureKindSchema.optional(),
  })
  .refine((answer) => answer.verdict !== Verdict.Refuted || Boolean(answer.evidence.trim()));
export type FalsifierAnswer = z.infer<typeof FalsifierAnswerSchema>;
export const FalsifyResultSchema = z.strictObject({
  evidence: z.array(z.string()),
  failures: z.array(FailureKindSchema),
});
export type FalsifyResult = z.infer<typeof FalsifyResultSchema>;

export const ClaudeGlobPatternSchema = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !value.startsWith(PathPart.Separator) &&
      !ClaudeGlobPattern.Unsafe.test(value) &&
      value.split(PathPart.Separator).every((part) => ClaudeGlobPattern.Component.test(part)),
  );
export const ClaudeGlobInputSchema = z.object({ pattern: ClaudeGlobPatternSchema });
export const ClaudeBashInputSchema = z.object({ command: z.string().min(1) });
export const ClaudeGrepInputSchema = z.object({
  pattern: z.string(),
  glob: ClaudeGlobPatternSchema.optional(),
});

export const ClaudeRetrySchema = z.object({
  error: z.string().min(1).max(ClaudeRetryLimit.CauseCharacters),
  error_status: z
    .number()
    .int()
    .min(ClaudeRetryLimit.MinimumStatus)
    .max(ClaudeRetryLimit.MaximumStatus)
    .nullable(),
  retry_delay_ms: z.number().int().nonnegative().max(ClaudeRetryLimit.DelayMilliseconds),
});

export const ClaudeCreditFailureSchema = z.object({
  type: z.literal(ClaudeEventKind.Assistant),
  error: z.enum([ClaudeRetryCause.BillingError, ClaudeRetryCause.RateLimit]),
  errorCode: z.literal(ClaudeCreditCode.Required),
  parent_tool_use_id: z.null(),
});
