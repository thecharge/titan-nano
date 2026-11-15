import { KnowledgeAttemptFormat, KnowledgeAttemptState, KnowledgeLimit } from "@titan/constants";
import { z } from "zod";
import { KnowledgeMutationSchema, KnowledgePublicationReceiptSchema } from "./knowledge.ts";
import { KnowledgeAttemptScopeSchema } from "./knowledge-attempt-scope.ts";

const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export {
  type KnowledgeAttemptScope,
  KnowledgeAttemptScopeSchema,
} from "./knowledge-attempt-scope.ts";

const mutations = z
  .array(KnowledgeMutationSchema)
  .max(KnowledgeLimit.PublicationEntries)
  .refine((entries) => new Set(entries.map((entry) => entry.id)).size === entries.length);
export const KnowledgeAttemptDocumentSchema = z
  .strictObject({
    schema_version: z.literal(KnowledgeAttemptFormat.Version),
    scope: KnowledgeAttemptScopeSchema,
    publication_id: z.uuid(),
    revision: version,
    state: z.enum(KnowledgeAttemptState),
    mutations,
    receipt: KnowledgePublicationReceiptSchema.nullable(),
  })
  .refine(
    (value) =>
      value.receipt === null ||
      (value.state === KnowledgeAttemptState.Published &&
        value.receipt.publication_id === value.publication_id),
  )
  .refine(
    (value) => value.state !== KnowledgeAttemptState.Discarded || value.mutations.length === 0,
  )
  .refine(
    (value) =>
      value.state !== KnowledgeAttemptState.Published ||
      (value.mutations.length === 0) === (value.receipt === null),
  );
export type KnowledgeAttemptDocument = z.infer<typeof KnowledgeAttemptDocumentSchema>;
export const KnowledgeAttemptStageSchema = z.strictObject({
  revision: version.nullable(),
  mutations,
});
export type KnowledgeAttemptStage = z.infer<typeof KnowledgeAttemptStageSchema>;
