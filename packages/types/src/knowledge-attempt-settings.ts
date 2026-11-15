import { KnowledgeAttemptLimit, KnowledgeLimit } from "@titan/constants";
import { z } from "zod";

const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const KnowledgeAttemptSettingsSchema = z.strictObject({
  max_sets: version.max(KnowledgeAttemptLimit.Sets).default(KnowledgeAttemptLimit.Sets),
  max_entries: version
    .max(KnowledgeLimit.PublicationEntries)
    .default(KnowledgeLimit.PublicationEntries),
  max_bytes: version.max(KnowledgeLimit.PublicationBytes).default(KnowledgeLimit.PublicationBytes),
});
export type KnowledgeAttemptSettings = z.infer<typeof KnowledgeAttemptSettingsSchema>;
export type KnowledgeAttemptSettingsInput = z.input<typeof KnowledgeAttemptSettingsSchema>;
