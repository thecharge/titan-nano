import { ConfigDefault, NativeToolRole, NativeToolTransport, RuntimeLimit } from "@titan/constants";
import { z } from "zod";
import { KnowledgeAttemptScopeSchema } from "./knowledge-attempt-scope.ts";
import { PersonaSchema } from "./persona.ts";

export const NativeToolScopeSchema = KnowledgeAttemptScopeSchema.extend({
  execution_id: z.uuid(),
  role: z.enum(NativeToolRole),
});
export type NativeToolScope = z.infer<typeof NativeToolScopeSchema>;

export const NativeImproverBindingSchema = z.strictObject({
  scope: NativeToolScopeSchema,
  name: z.string().min(1),
  persona: PersonaSchema,
});
export type NativeImproverBinding = z.infer<typeof NativeImproverBindingSchema>;

export const NativeToolSettingsSchema = z.strictObject({
  max_bindings: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  max_pending_operations: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});
export type NativeToolSettings = z.infer<typeof NativeToolSettingsSchema>;

export const NativeToolServerSettingsSchema = NativeToolSettingsSchema.extend({
  transport: z.enum(NativeToolTransport).default(ConfigDefault.NativeTransport),
  max_bindings: NativeToolSettingsSchema.shape.max_bindings
    .max(ConfigDefault.MaxNativeBindingsLimit)
    .default(ConfigDefault.MaxNativeBindings),
  max_pending_operations: NativeToolSettingsSchema.shape.max_pending_operations
    .max(RuntimeLimit.PendingOperations)
    .default(RuntimeLimit.PendingOperations),
  timeout_ms: z
    .number()
    .int()
    .positive()
    .max(ConfigDefault.HostStartupLimit)
    .default(ConfigDefault.HostStartupMilliseconds),
});
export type NativeToolServerSettings = z.infer<typeof NativeToolServerSettingsSchema>;
