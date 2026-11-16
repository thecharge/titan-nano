import {
  IdentifierPattern,
  KnowledgeLimit,
  KnowledgeTool,
  NativeTool,
  NativeToolAudit,
  NativeToolOutcome,
} from "@titan/constants";
import { z } from "zod";
import {
  NativeFileListingSchema,
  NativeFileObservationSchema,
  NativeReadObservationSchema,
} from "./native-files.ts";
import { NativeToolScopeSchema } from "./native-tools.ts";

export const NativeToolNameSchema = z.enum([
  NativeTool.Ready,
  NativeTool.ReadFile,
  NativeTool.WriteFile,
  NativeTool.ListFiles,
  NativeToolAudit.Unknown,
  ...Object.values(KnowledgeTool),
]);
export type NativeToolName = z.infer<typeof NativeToolNameSchema>;
export const NativeToolAuditSchema = z.strictObject({
  tool: NativeToolNameSchema,
  outcome: z.enum(NativeToolOutcome),
  entry_ids: z.array(z.uuid()).max(KnowledgeLimit.MaximumPage),
  observation: NativeReadObservationSchema.optional(),
});
export type NativeToolAuditRecord = z.infer<typeof NativeToolAuditSchema>;
export const NativeToolBoardSchema = NativeToolAuditSchema.extend({
  ...NativeToolScopeSchema.shape,
  from: z.string().regex(IdentifierPattern),
  kind: z.literal(NativeToolAudit.Kind),
})
  .refine((record) => record.outcome !== NativeToolOutcome.Refused || record.entry_ids.length === 0)
  .refine((record) =>
    (record.tool === NativeTool.ReadFile ||
      record.tool === NativeTool.WriteFile ||
      record.tool === NativeTool.ListFiles) &&
    record.outcome === NativeToolOutcome.Returned
      ? record.entry_ids.length === 0 &&
        (record.tool !== NativeTool.ListFiles
          ? NativeFileObservationSchema.safeParse(record.observation).success
          : NativeFileListingSchema.safeParse(record.observation).success)
      : record.observation === undefined,
  );
export const NativeToolCallEnvelopeSchema = z.object({
  method: z.literal(NativeToolAudit.Method),
  params: z.object({ name: z.unknown().optional() }).optional(),
});
const nativeReply = z.object({
  isError: z.boolean().optional(),
  content: z.array(z.object({ type: z.string(), text: z.string() })),
});
export const NativeToolReplyEnvelopeSchema = z.object({ result: nativeReply });
