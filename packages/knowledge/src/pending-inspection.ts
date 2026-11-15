import { lstat, opendir } from "node:fs/promises";
import { join } from "node:path";
import { assertNoSecrets } from "@titan/config";
import {
  ErrorCode,
  ErrorField,
  FileEncoding,
  FileErrorCode,
  KnowledgeAttemptFile,
  KnowledgeAttemptState,
  KnowledgeLimit,
  KnowledgePendingOperation,
  WorkspaceFile,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import { jsonByteLength } from "@titan/streams";
import {
  KnowledgeAttemptDocumentSchema,
  KnowledgeAttemptSettingsSchema,
  KnowledgeEntrySchema,
  type KnowledgePendingEntry,
  KnowledgePendingEntrySchema,
  type KnowledgePendingPage,
  type KnowledgeSettingsInput,
  type ScopedKnowledgeListInput,
  ScopedKnowledgeListSchema,
} from "@titan/types";
import { knowledgeAttemptPath, optionalKnowledgeBytes } from "./files.ts";
import { inspectKnowledge } from "./inspection.ts";

async function pendingDirectory(path: string): Promise<boolean> {
  try {
    if (!(await lstat(path)).isDirectory())
      throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Pending);
    return true;
  } catch (error) {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing)
      return false;
    throw error;
  }
}

export async function inspectPendingKnowledge(
  home: string,
  input: ScopedKnowledgeListInput = {},
  settings: KnowledgeSettingsInput = {},
): Promise<KnowledgePendingPage> {
  const query = ScopedKnowledgeListSchema.parse(input);
  const limits = KnowledgeAttemptSettingsSchema.parse(settings.attempts ?? {});
  const directory = join(home, KnowledgeAttemptFile.Directory);
  const entries: KnowledgePendingEntry[] = [];
  if (!(await pendingDirectory(directory))) return { entries, truncated: false };
  let sets = 0;
  let bytes = 2;
  for await (const file of await opendir(directory)) {
    if (++sets > limits.max_sets)
      throw new TitanError(ErrorCode.Capacity, KnowledgeMessage.Capacity);
    if (!file.isFile()) throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Pending);
    if (file.name.endsWith(WorkspaceFile.TemporarySuffix)) continue;
    if (!file.name.endsWith(KnowledgeAttemptFile.Extension))
      throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Pending);
    const path = join(directory, file.name);
    const content = await optionalKnowledgeBytes(path, limits.max_bytes);
    if (!content) continue;
    assertNoSecrets(content);
    const document = KnowledgeAttemptDocumentSchema.parse(
      JSON.parse(content.toString(FileEncoding.Utf8)),
    );
    if (
      knowledgeAttemptPath(directory, document.scope) !== path ||
      document.mutations.length > limits.max_entries
    )
      throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Pending);
    if (
      document.state !== KnowledgeAttemptState.Open &&
      document.state !== KnowledgeAttemptState.Prepared
    )
      continue;
    for (const mutation of document.mutations) {
      const entry = mutation.entry
        ? KnowledgeEntrySchema.parse({
            ...mutation.entry,
            id: mutation.id,
            version: (mutation.version ?? 0) + 1,
          })
        : (await (await inspectKnowledge(home, undefined, settings)).get(mutation.id)).entry;
      const operation = mutation.entry
        ? mutation.version === null
          ? KnowledgePendingOperation.Add
          : KnowledgePendingOperation.Update
        : KnowledgePendingOperation.Delete;
      if (
        (query.kind && entry.kind !== query.kind) ||
        (query.tag && !entry.tags.includes(query.tag))
      )
        continue;
      const { body: _body, ...metadata } = entry;
      const row = KnowledgePendingEntrySchema.parse({
        ...metadata,
        attempt: document.scope,
        operation,
      });
      bytes += jsonByteLength(row, KnowledgeLimit.PageBytes);
      if (entries.length === query.limit || bytes > KnowledgeLimit.PageBytes)
        return { entries, truncated: true };
      entries.push(row);
    }
  }
  return { entries, truncated: false };
}
