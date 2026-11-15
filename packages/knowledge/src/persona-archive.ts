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
  PersonaRule,
  PersonaState,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import {
  KnowledgeSelectionSchema,
  type PersonaReadResult,
  type PersonaReadStorage,
  PersonaRecordSchema,
} from "@titan/types";
import { readKnowledgeBytes } from "./files.ts";
import { parseKnowledgeEntry } from "./format.ts";
import { personaEntryId } from "./persona-lifecycle.ts";

export async function readPersonaEntry(
  storage: PersonaReadStorage,
  id: string,
): Promise<PersonaReadResult> {
  try {
    return { ...(await storage.read(id)), archived: false };
  } catch (error) {
    if (!(error instanceof TitanError) || error.code !== ErrorCode.KnowledgeMissing) throw error;
    const archived = await storage.readArchived?.(id);
    if (archived) return { ...archived, archived: true };
    throw error;
  }
}

export async function archivedPersona(root: string, id: string) {
  KnowledgeSelectionSchema.parse({ id });
  let directory = root;
  let latest = 0;
  try {
    for (const part of [KnowledgeFile.History, KnowledgeKind.Persona, id]) {
      if (!(await lstat(directory)).isDirectory())
        throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
      directory = join(directory, part);
    }
    if (!(await lstat(directory)).isDirectory())
      throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
    let count = 0;
    for await (const file of await opendir(directory)) {
      if (++count > KnowledgeLimit.Entries)
        throw new TitanError(ErrorCode.Capacity, KnowledgeMessage.Capacity);
      const version = Number(file.name.slice(0, -KnowledgeFile.Yaml.length));
      if (
        !file.isFile() ||
        !Number.isSafeInteger(version) ||
        version < 1 ||
        file.name !== String(version) + KnowledgeFile.Yaml
      )
        throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
      latest = Math.max(latest, version);
    }
  } catch (error) {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing)
      return undefined;
    throw error;
  }
  if (!latest) throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
  const bytes = await readKnowledgeBytes(
    join(directory, String(latest) + KnowledgeFile.Yaml),
    KnowledgeLimit.EntryBytes,
  );
  assertNoSecrets(bytes);
  const entry = parseKnowledgeEntry(bytes, KnowledgeLimit.EntryBytes);
  const record = PersonaRecordSchema.parse(Bun.YAML.parse(entry.body));
  if (
    entry.id !== id ||
    entry.kind !== KnowledgeKind.Persona ||
    entry.version !== latest ||
    entry.title !== record.name + PersonaRule.VersionMark + record.version ||
    entry.id !== personaEntryId(entry.title) ||
    record.state !== PersonaState.Deleted
  )
    throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
  return { entry, bytes };
}
