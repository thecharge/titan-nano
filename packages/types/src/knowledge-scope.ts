import {
  KnowledgeKind,
  KnowledgeLimit,
  KnowledgePendingOperation,
  KnowledgeRelation,
  KnowledgeScope,
  KnowledgeState,
} from "@titan/constants";
import { z } from "zod";
import {
  KnowledgeEntryResultSchema,
  KnowledgeHistoryPageSchema,
  KnowledgeHistoryWindowSchema,
  KnowledgeMaintenanceResultSchema,
  KnowledgeMetadataSchema,
  KnowledgeSearchPageSchema,
  KnowledgeSearchResultSchema,
  KnowledgeStatsSchema,
} from "./knowledge.ts";
import { KnowledgeAttemptScopeSchema } from "./knowledge-attempt-scope.ts";

export const KnowledgeScopeSchema = z.enum(KnowledgeScope);

export const ScopedKnowledgeHistoryWindowSchema = KnowledgeHistoryWindowSchema.extend({
  scope: KnowledgeScopeSchema.optional(),
});

export const ScopedKnowledgeEntryResultSchema = KnowledgeEntryResultSchema.extend({
  scope: KnowledgeScopeSchema,
});
export type ScopedKnowledgeEntryResult = z.infer<typeof ScopedKnowledgeEntryResultSchema>;
export const ScopedKnowledgeMaintenanceResultSchema = KnowledgeMaintenanceResultSchema.extend({
  scope: KnowledgeScopeSchema,
});

export const ScopedKnowledgeSearchResultSchema = KnowledgeSearchResultSchema.extend({
  scope: KnowledgeScopeSchema,
});
export const ScopedKnowledgeSearchPageSchema = KnowledgeSearchPageSchema.omit({
  results: true,
}).extend({
  results: z.array(ScopedKnowledgeSearchResultSchema).max(KnowledgeLimit.MaximumPage),
});
export type ScopedKnowledgeSearchPage = z.infer<typeof ScopedKnowledgeSearchPageSchema>;

export const ScopedKnowledgeListSchema = z.strictObject({
  kind: z.enum(KnowledgeKind).optional(),
  scope: KnowledgeScopeSchema.optional(),
  tag: z.string().trim().min(1).max(KnowledgeLimit.TagCharacters).optional(),
  state: z.enum(KnowledgeState).optional(),
  limit: z.number().int().positive().max(KnowledgeLimit.MaximumPage).default(KnowledgeLimit.Page),
});
export type ScopedKnowledgeListInput = z.input<typeof ScopedKnowledgeListSchema>;

export const ScopedKnowledgeListEntrySchema = KnowledgeMetadataSchema.extend({
  scope: KnowledgeScopeSchema,
  state: z.enum(KnowledgeState),
  attempt: KnowledgeAttemptScopeSchema.optional(),
  operation: z.enum(KnowledgePendingOperation).optional(),
});
export type ScopedKnowledgeListEntry = z.infer<typeof ScopedKnowledgeListEntrySchema>;
export const ScopedKnowledgeListResultSchema = z.strictObject({
  entries: z.array(ScopedKnowledgeListEntrySchema),
  truncated: z.boolean(),
});
export type ScopedKnowledgeListResult = z.infer<typeof ScopedKnowledgeListResultSchema>;

export const ScopedKnowledgeStatsSchema = z.strictObject({
  scopes: z.array(KnowledgeStatsSchema.extend({ scope: KnowledgeScopeSchema })),
  meaning_ready: z.boolean(),
});
export type ScopedKnowledgeStats = z.infer<typeof ScopedKnowledgeStatsSchema>;

export const KnowledgeLinkSchema = z.strictObject({
  id: z.uuid(),
  kind: z.enum(KnowledgeKind),
  title: z.string(),
  scope: KnowledgeScopeSchema,
  relation: z.enum(KnowledgeRelation),
});
export type KnowledgeLink = z.infer<typeof KnowledgeLinkSchema>;
export const ScopedKnowledgeShowSchema = ScopedKnowledgeEntryResultSchema.extend({
  history: z.strictObject({
    version: z.number().int().positive(),
    earlier_versions: z.number().int().nonnegative(),
    promoted_from: KnowledgeScopeSchema.nullable(),
    page: KnowledgeHistoryPageSchema,
  }),
  links: z.array(KnowledgeLinkSchema),
});
export type ScopedKnowledgeShow = z.infer<typeof ScopedKnowledgeShowSchema>;

export const KnowledgePendingEntrySchema = KnowledgeMetadataSchema.extend({
  attempt: KnowledgeAttemptScopeSchema,
  operation: z.enum(KnowledgePendingOperation),
});
export type KnowledgePendingEntry = z.infer<typeof KnowledgePendingEntrySchema>;
export const KnowledgePendingPageSchema = z.strictObject({
  entries: z.array(KnowledgePendingEntrySchema).max(KnowledgeLimit.MaximumPage),
  truncated: z.boolean(),
});
export type KnowledgePendingPage = z.infer<typeof KnowledgePendingPageSchema>;
export type KnowledgePendingReader = (
  scope: KnowledgeScope,
  query: ScopedKnowledgeListInput,
) => Promise<KnowledgePendingPage>;
