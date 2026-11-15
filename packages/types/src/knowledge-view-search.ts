import { KnowledgeLimit, KnowledgeState } from "@titan/constants";
import { z } from "zod";
import { KnowledgeSearchPageSchema, KnowledgeSearchResultSchema } from "./knowledge.ts";

export const KnowledgeViewSearchResultSchema = KnowledgeSearchResultSchema.extend({
  visibility: z.enum(KnowledgeState),
});
export type KnowledgeViewSearchResult = z.infer<typeof KnowledgeViewSearchResultSchema>;
export const KnowledgeViewSearchPageSchema = KnowledgeSearchPageSchema.extend({
  private_revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
  results: z.array(KnowledgeViewSearchResultSchema).max(KnowledgeLimit.MaximumPage),
});

export type KnowledgeViewSearchPage = z.infer<typeof KnowledgeViewSearchPageSchema>;
