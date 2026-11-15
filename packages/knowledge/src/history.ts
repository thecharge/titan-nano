import { lstat } from "node:fs/promises";
import { join } from "node:path";
import { assertNoSecrets } from "@titan/config";
import { ErrorCode, KnowledgeFile, KnowledgeLimit } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import { jsonByteLength } from "@titan/streams";
import type { KnowledgeEntry, KnowledgeHistoryQuery, KnowledgeSettings } from "@titan/types";
import { knowledgeExtension, readKnowledgeBytes } from "./files.ts";
import { parseKnowledgeEntry } from "./format.ts";

async function retainedHistory(
  root: string,
  current: KnowledgeEntry,
  settings: KnowledgeSettings,
  query: KnowledgeHistoryQuery,
) {
  const before = query.before ?? current.version;
  if (before > current.version)
    throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Invalid);
  const entries: KnowledgeEntry[] = [];
  let remaining = before - 1;
  let bytes = 2;
  if (remaining > 0) {
    let directory = root;
    if (!(await lstat(directory)).isDirectory())
      throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
    for (const part of [KnowledgeFile.History, current.kind, current.id]) {
      directory = join(directory, part);
      if (!(await lstat(directory)).isDirectory())
        throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
    }
  }
  while (remaining > 0 && entries.length < query.limit) {
    const path = join(
      root,
      KnowledgeFile.History,
      current.kind,
      current.id,
      String(remaining) + knowledgeExtension(current.kind),
    );
    const content = await readKnowledgeBytes(path, settings.max_entry_bytes);
    assertNoSecrets(content);
    const entry = parseKnowledgeEntry(content, settings.max_entry_bytes);
    if (entry.id !== current.id || entry.kind !== current.kind || entry.version !== remaining)
      throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
    const size = jsonByteLength(entry, KnowledgeLimit.HistoryBytes) + (entries.length ? 1 : 0);
    if (bytes + size > KnowledgeLimit.HistoryBytes) break;
    bytes += size;
    entries.push(entry);
    remaining--;
  }
  return { entries, next_before: remaining > 0 ? remaining + 1 : null };
}

export async function knowledgeHistory(
  root: string,
  current: KnowledgeEntry,
  settings: KnowledgeSettings,
  query: KnowledgeHistoryQuery,
) {
  try {
    return await retainedHistory(root, current, settings, query);
  } catch (error) {
    if (error instanceof TitanError) throw error;
    throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
  }
}
