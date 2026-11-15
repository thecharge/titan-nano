import { AgentHost, AgentHostKind, Backend, PathPart } from "@titan/constants";
import { z } from "zod";
import { AgentAnswerSchema, AgentEventSchema, AgentSpecSchema } from "./agents.ts";
import { ClaudeLaunchSchema } from "./backend-launch.ts";
import { FileAccessScopeSchema, FileExecutionClaimSchema } from "./file-access.ts";
import { NativeToolBindingSchema } from "./native-tool-launch.ts";

export const HostFileClaimSchema = FileAccessScopeSchema.extend({
  run_id: z.string().min(1),
  execution_id: z.string().min(1),
  binding: FileExecutionClaimSchema.optional(),
  paths: z.array(z.string().startsWith(PathPart.Separator)).min(1).max(AgentHost.MaximumClaims),
  read_paths: z
    .array(z.string().startsWith(PathPart.Separator))
    .min(1)
    .max(AgentHost.MaximumClaims)
    .optional(),
});
export type HostFileClaim = z.infer<typeof HostFileClaimSchema>;
export const HostClaimRowSchema = z.strictObject({
  slot: z
    .number()
    .int()
    .nonnegative()
    .max(AgentHost.MaximumClaims - 1),
  record: z.string().min(1).max(AgentHost.MessageBytes),
});
export const HostClaimRowsSchema = z.array(HostClaimRowSchema).max(AgentHost.MaximumClaims);
export const HostLeaseErrorSchema = z.object({ code: z.literal(AgentHost.BusyCode) });

export const NativeBackendIdSchema = z.enum([Backend.Codex, Backend.Claude]);
export type NativeBackendId = z.infer<typeof NativeBackendIdSchema>;
const AgentHostStartSchema = z.strictObject({
  type: z.literal(AgentHostKind.Start),
  backend: NativeBackendIdSchema,
  launch: ClaudeLaunchSchema,
  spec: AgentSpecSchema,
  session_id: z.string().min(1).nullable(),
  prompt: z.string(),
  native_tools: NativeToolBindingSchema.optional(),
});
export const AgentHostInputSchema = z.discriminatedUnion(AgentHost.TypeField, [
  z.strictObject({ type: z.literal(AgentHostKind.Ack) }),
  AgentHostStartSchema,
]);
export type AgentHostInput = z.infer<typeof AgentHostInputSchema>;
export type AgentHostStart = z.infer<typeof AgentHostStartSchema>;
export const AgentHostOutputSchema = z.discriminatedUnion(AgentHost.TypeField, [
  z.strictObject({ type: z.literal(AgentHostKind.Ready) }),
  z.strictObject({ type: z.literal(AgentHostKind.NativeReady) }),
  z.strictObject({ type: z.literal(AgentHostKind.Event), event: AgentEventSchema }),
  z.strictObject({ type: z.literal(AgentHostKind.Answer), answer: AgentAnswerSchema }),
  z.strictObject({
    type: z.literal(AgentHostKind.Error),
    code: z.string().max(AgentHost.ErrorCodeCharacters),
    message: z.string().max(AgentHost.ErrorMessageCharacters),
    retryable: z.boolean(),
    retry_after_ms: z.number().nonnegative(),
  }),
]);
export type AgentHostOutput = z.infer<typeof AgentHostOutputSchema>;
