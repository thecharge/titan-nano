import { lstat, opendir } from "node:fs/promises";
import { join } from "node:path";
import { assertNoSecrets } from "@titan/config";
import {
  ErrorCode,
  ErrorField,
  FileErrorCode,
  KnowledgeFile,
  KnowledgeKind,
  KnowledgeLimit,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import { type KnowledgeReadResult, KnowledgeSelectionSchema } from "@titan/types";
import { knowledgeExtension, readKnowledgeBytes } from "./files.ts";
import { parseKnowledgeEntry } from "./format.ts";

async function latestVersion(root: string, kind: KnowledgeKind, id: string): Promise<number> {
  let path = root;
  try {
    for (const part of [KnowledgeFile.History, kind, id]) {
      if (!(await lstat(path)).isDirectory())
        throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
      path = join(path, part);
    }
    if (!(await lstat(path)).isDirectory())
      throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
    let latest = 0;
    let count = 0;
    for await (const file of await opendir(path)) {
      if (++count > KnowledgeLimit.Entries)
        throw new TitanError(ErrorCode.Capacity, KnowledgeMessage.Capacity);
      const version = Number(file.name.slice(0, -knowledgeExtension(kind).length));
      if (
        !file.isFile() ||
        !Number.isSafeInteger(version) ||
        version < 1 ||
        file.name !== String(version) + knowledgeExtension(kind)
      )
        throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
      latest = Math.max(latest, version);
    }
    if (!latest) throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
    return latest;
  } catch (error) {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing)
      return 0;
    throw error;
  }
}

export async function archivedKnowledge(
  root: string,
  id: string,
  maximum: number,
): Promise<KnowledgeReadResult | undefined> {
  KnowledgeSelectionSchema.parse({ id });
  let found: KnowledgeReadResult | undefined;
  for (const kind of Object.values(KnowledgeKind)) {
    const version = await latestVersion(root, kind, id);
    if (!version) continue;
    const bytes = await readKnowledgeBytes(
      join(root, KnowledgeFile.History, kind, id, String(version) + knowledgeExtension(kind)),
      maximum,
    );
    assertNoSecrets(bytes);
    const entry = parseKnowledgeEntry(bytes, maximum);
    if (found || entry.id !== id || entry.kind !== kind || entry.version !== version)
      throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
    found = { entry, bytes };
  }
  return found;
}
