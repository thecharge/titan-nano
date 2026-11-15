import { KnowledgeAttemptFormat, KnowledgeState } from "@titan/constants";
import { z } from "zod";
import {
  KnowledgeDeleteSchema,
  KnowledgeEntrySchema,
  KnowledgeInputSchema,
  KnowledgeUpdateSchema,
} from "./knowledge.ts";

const privateRevision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable();
export const KnowledgeViewAddSchema = z.strictObject({
  private_revision: privateRevision,
  entry: KnowledgeInputSchema,
});
export const KnowledgeViewUpdateSchema = KnowledgeUpdateSchema.extend({
  private_revision: privateRevision,
});
export const KnowledgeViewDeleteSchema = KnowledgeDeleteSchema.extend({
  private_revision: privateRevision,
});
export const KnowledgeViewEntrySchema = z.strictObject({
  schema_version: z.literal(KnowledgeAttemptFormat.Version),
  private_revision: privateRevision,
  visibility: z.enum(KnowledgeState),
  entry: KnowledgeEntrySchema,
});
export type KnowledgeViewEntry = z.infer<typeof KnowledgeViewEntrySchema>;

export const KnowledgeViewDeletionSchema = z.strictObject({
  schema_version: z.literal(KnowledgeAttemptFormat.Version),
  private_revision: privateRevision,
  id: z.uuid(),
  deleted_version: KnowledgeEntrySchema.shape.version,
});

export type KnowledgeViewDeletion = z.infer<typeof KnowledgeViewDeletionSchema>;
