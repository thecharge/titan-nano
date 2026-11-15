import {
  ApprovalLevel,
  IdentifierPattern,
  RequestDecision,
  RequestExecutionPattern,
  RequestFormat,
  RequestKind,
  RequestLimit,
  RequestProjection,
  RequestVersion,
} from "@titan/constants";
import { z } from "zod";
import { ApprovalPolicySchema } from "./approval-policy.ts";
import { PersonaSchema } from "./persona.ts";

const identity = z.string().regex(IdentifierPattern);
const text = z.string().min(1).max(RequestLimit.TextCharacters);
const time = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const OperationScopeSchema = z.strictObject({
  operation: text,
  resource: text,
  content_hashes: z
    .record(identity, z.string().regex(RequestLimit.HashPattern))
    .refine((entries) => Object.keys(entries).length <= RequestLimit.ScopeEntries),
  arguments: z.array(text).max(RequestLimit.ScopeEntries),
  environment_names: z.array(identity).max(RequestLimit.ScopeEntries),
});
export type OperationScope = z.infer<typeof OperationScopeSchema>;
export const RequestExecutionSchema = z.strictObject({
  step_id: identity,
  attempt: time.positive(),
  phase: z.string().max(RequestLimit.TextCharacters).regex(RequestExecutionPattern),
  execution_id: identity,
});
export const RequestOriginSchema = z.strictObject({
  client_id: identity,
  harness_session_id: identity.nullable(),
  execution: RequestExecutionSchema.optional(),
});
export const RequestActorSchema = z.strictObject({
  client_id: identity,
  authority: z.enum(ApprovalLevel),
});
export type RequestActor = z.infer<typeof RequestActorSchema>;
export const RequestEscalationAuditSchema = z
  .strictObject({
    reason: text,
    actor: RequestActorSchema,
    escalated_at: time,
  })
  .refine((audit) => audit.actor.authority !== ApprovalLevel.Auto);
export const RequestPersonaSchema = z.strictObject({
  name: identity,
  definition: PersonaSchema,
});
export type RequestPersona = z.infer<typeof RequestPersonaSchema>;
export const RequestAnswerSchema = z.strictObject({
  decision: z.enum(RequestDecision),
  reason: text,
  actor: RequestActorSchema,
  decided_at: time,
  persona: RequestPersonaSchema.optional(),
});
export const OperationRequestInputSchema = z.strictObject({
  request_id: identity,
  kind: z.enum(RequestKind),
  scope: OperationScopeSchema,
  origin: RequestOriginSchema,
  expires_at: time,
});
export type OperationRequestInput = z.infer<typeof OperationRequestInputSchema>;
export const OperationRequestSchema = OperationRequestInputSchema.extend({
  schema_version: z.union([
    z.literal(RequestFormat.Legacy),
    z.literal(RequestFormat.Execution),
    z.literal(RequestFormat.Persona),
  ]),
  run_id: identity,
  version: z.union([
    z.literal(RequestVersion.Open),
    z.literal(RequestVersion.Answered),
    z.literal(RequestVersion.EscalatedAnswered),
  ]),
  escalation: RequestEscalationAuditSchema.optional(),
  level: z.enum(ApprovalLevel),
  created_at: time,
  answer: RequestAnswerSchema.nullable(),
})
  .refine(
    (request) =>
      request.schema_version ===
      (request.answer?.persona
        ? RequestFormat.Persona
        : request.origin.execution
          ? RequestFormat.Execution
          : RequestFormat.Legacy),
  )
  .refine(
    (request) =>
      request.answer?.persona === undefined ||
      (request.answer.decision === RequestDecision.Approve &&
        [RequestKind.NewPersona, RequestKind.ImprovePersona, RequestKind.MergePersonas].includes(
          request.kind,
        )),
  )
  .refine((request) => request.expires_at > request.created_at)
  .refine(
    (request) =>
      request.version ===
      (request.escalation === undefined
        ? request.answer === null
          ? RequestVersion.Open
          : RequestVersion.Answered
        : request.answer === null
          ? RequestVersion.Escalated
          : RequestVersion.EscalatedAnswered),
  )
  .refine(
    (request) =>
      request.escalation === undefined ||
      (request.level === ApprovalLevel.Human &&
        request.escalation.escalated_at >= request.created_at &&
        request.escalation.escalated_at < request.expires_at),
  );
export type OperationRequest = z.infer<typeof OperationRequestSchema>;
export const RequestAnswerInputSchema = z.strictObject({
  run_id: identity,
  request_id: identity,
  version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  decision: z.enum(RequestDecision),
  reason: text,
  persona: RequestPersonaSchema.optional(),
});
export type RequestAnswerInput = z.infer<typeof RequestAnswerInputSchema>;
export const RequestEscalationInputSchema = RequestAnswerInputSchema.omit({
  decision: true,
  persona: true,
});
export type RequestEscalationInput = z.infer<typeof RequestEscalationInputSchema>;
export const RequestLedgerOptionsSchema = z.strictObject({
  max_requests: z.number().int().positive().max(RequestLimit.PerRun).default(RequestLimit.PerRun),
  max_pending_operations: z
    .number()
    .int()
    .positive()
    .max(RequestLimit.PendingOperations)
    .default(RequestLimit.PendingOperations),
});
export type RequestLedgerOptionsInput = z.input<typeof RequestLedgerOptionsSchema>;

export const RequestProjectionSchema = z
  .strictObject({
    schema_version: z.literal(RequestProjection.Version),
    run_id: identity,
    through: time,
    requests: z
      .array(OperationRequestSchema)
      .max(RequestLimit.PerRun)
      .refine(
        (requests) =>
          requests.every((request) => request.answer === null) &&
          new Set(requests.map((request) => request.request_id)).size === requests.length,
      ),
  })
  .refine((projection) =>
    projection.requests.every((request) => request.run_id === projection.run_id),
  );
export type RequestProjectionDocument = z.infer<typeof RequestProjectionSchema>;

export const RequestInventorySchema = z.strictObject({
  run_id: identity,
  config_hash: z.string().min(1),
  max_requests: z.number().int().positive().max(RequestLimit.PerRun),
  approvals: ApprovalPolicySchema,
  requests: z.array(OperationRequestSchema).max(RequestLimit.PerRun),
});
export type RequestInventory = z.infer<typeof RequestInventorySchema>;
