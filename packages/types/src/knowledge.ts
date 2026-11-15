import {
  KnowledgeCommand,
  KnowledgeField,
  KnowledgeFormat,
  KnowledgeKind,
  KnowledgeLimit,
  KnowledgeMaintenanceReason,
  KnowledgeSearchMode,
  KnowledgeServerCommand,
  RuntimeLimit,
  TextSymbol,
} from "@titan/constants";
import { z } from "zod";
import { Sha256Schema } from "./hash.ts";
import { KnowledgeAttemptSettingsSchema } from "./knowledge-attempt-settings.ts";
import { PersonaHistorySchema } from "./persona-history.ts";

const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const KnowledgeSettingsSchema = z.strictObject({
  attempts: KnowledgeAttemptSettingsSchema.optional(),
  embedder: z.string().trim().min(1).max(KnowledgeLimit.TitleCharacters).optional(),
  max_entries: version.max(KnowledgeLimit.Entries).default(KnowledgeLimit.Entries),
  max_publication_entries: version.max(KnowledgeLimit.PublicationEntries).optional(),
  max_publication_bytes: version.max(KnowledgeLimit.PublicationBytes).optional(),
  max_publication_receipts: version.max(KnowledgeLimit.PublicationReceipts).optional(),
  max_entry_bytes: version.max(KnowledgeLimit.EntryBytes).default(KnowledgeLimit.EntryBytes),
  max_index_bytes: version.max(KnowledgeLimit.IndexBytes).default(KnowledgeLimit.IndexBytes),
  max_total_bytes: version.max(KnowledgeLimit.TotalBytes).default(KnowledgeLimit.TotalBytes),
  max_pending_operations: version
    .max(RuntimeLimit.PendingOperations)
    .default(RuntimeLimit.PendingOperations),
});
export type KnowledgeSettings = z.infer<typeof KnowledgeSettingsSchema>;
export type KnowledgeSettingsInput = z.input<typeof KnowledgeSettingsSchema>;

export const KnowledgeDraftSchema = z.strictObject({
  kind: z.enum(KnowledgeKind),
  title: z.string().trim().min(1).max(KnowledgeLimit.TitleCharacters),
  tags: z
    .array(z.string().trim().min(1).max(KnowledgeLimit.TagCharacters))
    .max(KnowledgeLimit.Tags)
    .default([]),
  body: z.string().max(KnowledgeLimit.EntryBytes),
});
export type KnowledgeDraft = z.infer<typeof KnowledgeDraftSchema>;
export const KnowledgeEntrySchema = KnowledgeDraftSchema.extend({
  id: z.uuid(),
  version,
});
export type KnowledgeEntry = z.infer<typeof KnowledgeEntrySchema>;
export const KnowledgeMetadataSchema = KnowledgeEntrySchema.omit({ body: true });
export type KnowledgeMetadata = z.infer<typeof KnowledgeMetadataSchema>;
export const KnowledgeImportSchema = KnowledgeDraftSchema.omit({ body: true }).extend({
  id: z.uuid().optional(),
  version: version.optional(),
});
export const KnowledgeInputSchema = KnowledgeImportSchema.extend({
  body: KnowledgeDraftSchema.shape.body,
});
export type KnowledgeInput = z.infer<typeof KnowledgeInputSchema>;
export const KnowledgeSelectionSchema = z.strictObject({ id: z.uuid() });
export const KnowledgeUpdateSchema = z.strictObject({
  id: z.uuid(),
  version,
  entry: KnowledgeDraftSchema,
});
export const KnowledgeDeleteSchema = KnowledgeSelectionSchema.extend({ version });
export const KnowledgeSearchSchema = z
  .strictObject({
    question: z.string().trim().max(KnowledgeLimit.SearchCharacters).default(TextSymbol.Empty),
    mode: z.enum(KnowledgeSearchMode).default(KnowledgeSearchMode.Both),
    kind: z.enum(KnowledgeKind).optional(),
    all: z.boolean().optional(),
    limit: version.max(KnowledgeLimit.MaximumPage).default(KnowledgeLimit.Page),
  })
  .refine((query) => query.question.length > 0 || query.kind !== undefined);
export type KnowledgeSearch = z.infer<typeof KnowledgeSearchSchema>;

export const KnowledgeChangeSchema = z
  .strictObject({
    before: KnowledgeEntrySchema.nullable(),
    before_text: z.string().max(KnowledgeLimit.EntryBytes).nullable(),
    after: KnowledgeEntrySchema.nullable(),
    archived: z.literal(true).optional(),
    restored: z.literal(true).optional(),
  })
  .refine((change) => {
    if (change.archived && (!change.before || !change.after)) return false;
    if (change.restored && (change.archived || !change.before || !change.after)) return false;
    if ((change.before === null) !== (change.before_text === null)) return false;
    if (!change.before) return change.after?.version === 1;
    if (!change.after) return true;
    if (
      change.restored &&
      (change.before.kind === KnowledgeKind.Persona ||
        change.before.title !== change.after.title ||
        change.before.body !== change.after.body ||
        JSON.stringify(change.before.tags) !== JSON.stringify(change.after.tags))
    )
      return false;
    return (
      change.after.id === change.before.id &&
      change.after.kind === change.before.kind &&
      change.after.version === change.before.version + 1
    );
  });
export type KnowledgeChange = z.infer<typeof KnowledgeChangeSchema>;

export const KnowledgeRowSchema = KnowledgeMetadataSchema.omit({ tags: true }).extend({
  tags: z.string(),
  path: z.string().min(1),
  summary: z.string().max(KnowledgeLimit.SummaryCharacters),
  bytes: z.number().int().positive().max(KnowledgeLimit.EntryBytes),
  hash: Sha256Schema,
});
export type KnowledgeRow = z.infer<typeof KnowledgeRowSchema>;
export const KnowledgeUsageSchema = z.strictObject({
  entries: z.number().int().nonnegative().max(KnowledgeLimit.Entries),
  bytes: z.number().int().nonnegative().max(KnowledgeLimit.TotalBytes),
});
export const KnowledgeMatchSchema = KnowledgeRowSchema.extend({
  matched: z.string().max(KnowledgeLimit.MatchedCharacters),
  rank: z.number().finite(),
});
export type KnowledgeMatch = z.infer<typeof KnowledgeMatchSchema>;
export const KnowledgeMatchesSchema = z.array(KnowledgeMatchSchema).max(KnowledgeLimit.MaximumPage);

const response = z.strictObject({
  schema_version: z.literal(KnowledgeFormat.Version),
  revision: Sha256Schema,
});
export const KnowledgeEntryResultSchema = response.extend({ entry: KnowledgeEntrySchema });
export type KnowledgeEntryResult = z.infer<typeof KnowledgeEntryResultSchema>;
export const KnowledgeDeletionResultSchema = response.extend({
  id: z.uuid(),
  deleted_version: version,
});
export const KnowledgeReindexResultSchema = response.extend(KnowledgeUsageSchema.shape);
export type KnowledgeDeletionResult = z.infer<typeof KnowledgeDeletionResultSchema>;
export type KnowledgeReindexResult = z.infer<typeof KnowledgeReindexResultSchema>;
export const KnowledgeReindexSchema = z.strictObject({});
const count = z.number().int().nonnegative();
export const KnowledgeStampSchema = z.strictObject({
  id: z.uuid(),
  updated: z.iso.datetime(),
});
export type KnowledgeStamp = z.infer<typeof KnowledgeStampSchema>;
export const KnowledgeDatesSchema = z.strictObject({
  oldest: KnowledgeStampSchema.nullable().default(null),
  newest: KnowledgeStampSchema.nullable().default(null),
});
export type KnowledgeDates = z.infer<typeof KnowledgeDatesSchema>;
export const KnowledgeKindStatsSchema = KnowledgeDatesSchema.extend({
  kind: z.enum(KnowledgeKind),
  entries: count,
  bytes: count,
  never_read: count,
});
export type KnowledgeKindStats = z.infer<typeof KnowledgeKindStatsSchema>;
export const KnowledgeStatsSchema = response.extend({
  entries: count,
  bytes: count,
  never_read: count,
  oldest: KnowledgeStampSchema.nullable(),
  newest: KnowledgeStampSchema.nullable(),
  kinds: z.array(KnowledgeKindStatsSchema),
  meaning_ready: z.boolean(),
});
export type KnowledgeStats = z.infer<typeof KnowledgeStatsSchema>;
export const KnowledgeMaintenanceQuerySchema = z.strictObject({
  apply: z.boolean().default(false),
  before: z.iso.datetime().optional(),
});
export type KnowledgeMaintenanceQuery = z.infer<typeof KnowledgeMaintenanceQuerySchema>;
export const KnowledgePruneCandidateSchema = KnowledgeMetadataSchema.extend({
  reason: z.enum(KnowledgeMaintenanceReason),
  kept_id: z.uuid().nullable(),
  retained: z.boolean(),
});
export type KnowledgePruneCandidate = z.infer<typeof KnowledgePruneCandidateSchema>;
export const KnowledgeConsolidationSchema = z.strictObject({
  sources: z.array(KnowledgeMetadataSchema).min(2).max(KnowledgeLimit.Entries),
  entry: KnowledgeDraftSchema,
});
export type KnowledgeConsolidation = z.infer<typeof KnowledgeConsolidationSchema>;
export const KnowledgeMaintenanceResultSchema = z.strictObject({
  applied: z.boolean(),
  before: z.iso.datetime(),
  candidates: z.array(KnowledgePruneCandidateSchema).max(KnowledgeLimit.Entries),
  groups: z.array(KnowledgeConsolidationSchema).max(KnowledgeLimit.Entries),
  publications: z.array(z.uuid()).max(KnowledgeLimit.Entries),
});
export type KnowledgeMaintenanceResult = z.infer<typeof KnowledgeMaintenanceResultSchema>;
export const KnowledgeCallSchema = z.discriminatedUnion(KnowledgeField.Operation, [
  z.strictObject({ operation: z.literal(KnowledgeCommand.Add), input: KnowledgeInputSchema }),
  z.strictObject({ operation: z.literal(KnowledgeCommand.Get), input: KnowledgeSelectionSchema }),
  z.strictObject({ operation: z.literal(KnowledgeCommand.Update), input: KnowledgeUpdateSchema }),
  z.strictObject({ operation: z.literal(KnowledgeCommand.Delete), input: KnowledgeDeleteSchema }),
  z.strictObject({ operation: z.literal(KnowledgeCommand.Search), input: KnowledgeSearchSchema }),
  z.strictObject({ operation: z.literal(KnowledgeCommand.Reindex), input: KnowledgeReindexSchema }),
]);
export type KnowledgeCall = z.infer<typeof KnowledgeCallSchema>;
export const KnowledgeHistoryQuerySchema = KnowledgeSelectionSchema.extend({
  before: version.optional(),
  limit: version.max(KnowledgeLimit.MaximumPage).default(KnowledgeLimit.Page),
});
export const KnowledgeHistoryWindowSchema = KnowledgeHistoryQuerySchema.omit({ id: true });
export type KnowledgeHistoryWindow = z.input<typeof KnowledgeHistoryWindowSchema>;
export type KnowledgeHistoryQuery = z.infer<typeof KnowledgeHistoryQuerySchema>;
export type KnowledgeHistoryInput = z.input<typeof KnowledgeHistoryQuerySchema>;
export const KnowledgeHistoryPageSchema = response.extend({
  id: z.uuid(),
  kind: z.enum(KnowledgeKind),
  current_version: version,
  entries: z.array(KnowledgeEntrySchema).max(KnowledgeLimit.MaximumPage),
  next_before: version.nullable(),
});
export type KnowledgeHistoryPage = z.infer<typeof KnowledgeHistoryPageSchema>;
export const KnowledgeServerCallSchema = z.discriminatedUnion(KnowledgeField.Operation, [
  ...KnowledgeCallSchema.options,
  z.strictObject({
    operation: z.literal(KnowledgeCommand.Prune),
    input: KnowledgeMaintenanceQuerySchema,
  }),
  z.strictObject({
    operation: z.literal(KnowledgeCommand.Consolidate),
    input: KnowledgeMaintenanceQuerySchema,
  }),
  z.strictObject({
    operation: z.literal(KnowledgeCommand.Restore),
    input: KnowledgeSelectionSchema,
  }),
  z.strictObject({
    operation: z.literal(KnowledgeServerCommand.History),
    input: KnowledgeHistoryQuerySchema,
  }),
  z.strictObject({ operation: z.literal(KnowledgeCommand.Stats), input: KnowledgeReindexSchema }),
]);
export const KnowledgeSearchResultSchema = KnowledgeMetadataSchema.extend({
  path: z.string().min(1),
  matched: z.string().max(KnowledgeLimit.MatchedCharacters),
  score: z.number().min(0).max(1).nullable(),
  persona: PersonaHistorySchema.optional(),
});
export const KnowledgeSearchPageSchema = response.extend({
  query: KnowledgeSearchSchema,
  actual_mode: z.enum(KnowledgeSearchMode),
  warning: z.string().nullable(),
  truncated: z.boolean(),
  results: z.array(KnowledgeSearchResultSchema).max(KnowledgeLimit.MaximumPage),
});
export type KnowledgeSearchPage = z.infer<typeof KnowledgeSearchPageSchema>;

export const KnowledgeMutationSchema = z
  .strictObject({
    id: z.uuid(),
    version: version.nullable(),
    entry: KnowledgeDraftSchema.nullable(),
  })
  .refine((mutation) => mutation.version !== null || mutation.entry !== null);
export type KnowledgeMutation = z.infer<typeof KnowledgeMutationSchema>;
const mutations = z
  .array(KnowledgeMutationSchema)
  .min(1)
  .max(KnowledgeLimit.PublicationEntries)
  .refine((entries) => new Set(entries.map((entry) => entry.id)).size === entries.length);
export const KnowledgeCommitSchema = z.strictObject({ publication_id: z.uuid(), mutations });
export type KnowledgeCommit = z.infer<typeof KnowledgeCommitSchema>;
export const KnowledgePublicationJournalSchema = z
  .strictObject({
    publication_id: z.uuid(),
    input_hash: Sha256Schema,
    changes: z.array(KnowledgeChangeSchema).min(1).max(KnowledgeLimit.PublicationEntries),
  })
  .refine(
    (journal) =>
      new Set(journal.changes.map((change) => change.before?.id ?? change.after?.id)).size ===
      journal.changes.length,
  );
export type KnowledgePublicationJournal = z.infer<typeof KnowledgePublicationJournalSchema>;
export const KnowledgeJournalSchema = z.union([
  KnowledgeChangeSchema,
  KnowledgePublicationJournalSchema,
]);
export type KnowledgeJournal = z.infer<typeof KnowledgeJournalSchema>;
export const KnowledgePublicationChangeSchema = z.strictObject({
  id: z.uuid(),
  version,
  deleted: z.boolean(),
});
export const KnowledgePublicationReceiptSchema = response.extend({
  publication_id: z.uuid(),
  input_hash: Sha256Schema,
  changes: z.array(KnowledgePublicationChangeSchema).min(1).max(KnowledgeLimit.PublicationEntries),
});
export type KnowledgePublicationReceipt = z.infer<typeof KnowledgePublicationReceiptSchema>;

export const KnowledgeReadResultSchema = z.strictObject({
  entry: KnowledgeEntrySchema,
  bytes: z.instanceof(Buffer).refine((bytes) => bytes.length <= KnowledgeLimit.EntryBytes),
});
export type KnowledgeReadResult = z.infer<typeof KnowledgeReadResultSchema>;

export const PersonaReadResultSchema = KnowledgeReadResultSchema.extend({ archived: z.boolean() });
export type PersonaReadResult = z.infer<typeof PersonaReadResultSchema>;
export const KnowledgePreparedPublicationSchema = z.strictObject({
  journal: KnowledgePublicationJournalSchema,
  bytes: z.instanceof(Buffer).refine((bytes) => bytes.length <= KnowledgeLimit.PublicationBytes),
});
export type KnowledgePreparedPublication = z.infer<typeof KnowledgePreparedPublicationSchema>;

export const KnowledgeInspectionSnapshotSchema = z.strictObject({
  rows: z.array(KnowledgeRowSchema).max(KnowledgeLimit.Entries),
  kinds: z.array(KnowledgeKindStatsSchema).max(Object.values(KnowledgeKind).length),
  embedder: z.string().optional(),
});
