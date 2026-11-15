import { KnowledgeLimit, LocalEmbedder } from "@titan/constants";
import { z } from "zod";

export const KnowledgeVectorSchema = z
  .array(z.number().finite())
  .min(1)
  .max(LocalEmbedder.Dimension)
  .refine((vector) => vector.some((value) => value !== 0));

export const KnowledgeVectorHitSchema = z.strictObject({
  id: z.uuid(),
  score: z.number().min(0).max(1),
});
export type KnowledgeVectorHit = z.infer<typeof KnowledgeVectorHitSchema>;
export const KnowledgeVectorHitsSchema = z
  .array(KnowledgeVectorHitSchema)
  .max(KnowledgeLimit.MaximumPage + 1);
export const KnowledgeVectorRowsSchema = z.array(
  z.strictObject({ id: z.uuid(), distance: z.number().finite() }),
);
export const KnowledgeVectorScoresSchema = z.map(z.uuid(), z.number().min(0).max(1));
export type KnowledgeVectorScores = z.infer<typeof KnowledgeVectorScoresSchema>;

export const TransformersExtractorOptionsSchema = z.strictObject({
  pooling: z.string(),
  normalize: z.boolean(),
});
export type TransformersExtractorOptions = z.infer<typeof TransformersExtractorOptionsSchema>;
export const TransformersExtractorResultSchema = z.object({
  data: z.custom<ArrayLike<number>>(),
});
export type TransformersExtractorResult = z.infer<typeof TransformersExtractorResultSchema>;
