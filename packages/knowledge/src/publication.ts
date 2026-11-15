import { dirname, join } from "node:path";
import { assertNoSecrets } from "@titan/config";
import {
  ErrorCode,
  FileEncoding,
  KnowledgeField,
  KnowledgeFile,
  KnowledgeKind,
  KnowledgeLimit,
  KnowledgePublicationStage,
  PersonaState,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import { atomicWrite, jsonBytes } from "@titan/streams";
import {
  type KnowledgeChange,
  KnowledgeChangeSchema,
  type KnowledgeJournal,
  KnowledgeJournalSchema,
  type KnowledgeSettings,
  type KnowledgeStageObserver,
  PersonaRecordSchema,
} from "@titan/types";
import { archivedKnowledge } from "./archived.ts";
import { validatePublication } from "./commit-format.ts";
import {
  knowledgeDirectory,
  knowledgeExtension,
  knowledgePath,
  optionalKnowledgeBytes,
  removeKnowledgeFile,
} from "./files.ts";
import { knowledgeBytes, parseKnowledgeEntry } from "./format.ts";
import { archivedPersona } from "./persona-archive.ts";

export async function readKnowledgeChange(root: string, settings: KnowledgeSettings) {
  const bytes = await optionalKnowledgeBytes(
    join(root, KnowledgeFile.Journal),
    Math.max(KnowledgeLimit.JournalBytes, KnowledgeLimit.PublicationBytes),
  );
  if (bytes === null) return null;
  try {
    const change = KnowledgeJournalSchema.parse(JSON.parse(bytes.toString(FileEncoding.Utf8)));
    await validateJournal(change, settings);
    return change;
  } catch {
    throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
  }
}

async function validateJournal(
  journal: KnowledgeJournal,
  settings: KnowledgeSettings,
): Promise<void> {
  if (KnowledgeField.Publication in journal) {
    for (const entry of journal.changes) validateBefore(entry, settings);
    await validatePublication(journal);
  } else validateBefore(journal, settings);
}

function validateBefore(change: KnowledgeChange, settings: KnowledgeSettings): void {
  if (!change.before || change.before_text === null) return;
  const before = parseKnowledgeEntry(Buffer.from(change.before_text), settings.max_entry_bytes);
  if (JSON.stringify(before) !== JSON.stringify(change.before))
    throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
}

export async function recordKnowledgeChange(root: string, change: KnowledgeChange): Promise<void> {
  const bytes = await jsonBytes(KnowledgeChangeSchema.parse(change), KnowledgeLimit.JournalBytes);
  assertNoSecrets(bytes);
  await atomicWrite(join(root, KnowledgeFile.Journal), bytes);
}

async function preserveHistory(root: string, change: KnowledgeChange): Promise<void> {
  if (!change.before || change.before_text === null) return;
  const directory = join(root, KnowledgeFile.History, change.before.kind, change.before.id);
  await knowledgeDirectory(join(root, KnowledgeFile.History));
  await knowledgeDirectory(join(root, KnowledgeFile.History, change.before.kind));
  await knowledgeDirectory(directory);
  const path = join(
    directory,
    String(change.before.version) + knowledgeExtension(change.before.kind),
  );
  const old = await optionalKnowledgeBytes(path, KnowledgeLimit.EntryBytes);
  const bytes = Buffer.from(change.before_text);
  if (old && !old.equals(bytes))
    throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
  if (old === null) await atomicWrite(path, bytes);
}

export async function verifyCurrent(
  root: string,
  change: KnowledgeChange,
  settings: KnowledgeSettings,
): Promise<void> {
  if (change.restored) {
    const before = change.before;
    if (!before || !change.after || change.before_text === null)
      throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
    const previous = await archivedKnowledge(root, before.id, settings.max_entry_bytes);
    if (!previous?.bytes.equals(Buffer.from(change.before_text)))
      throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
    const current = await optionalKnowledgeBytes(
      knowledgePath(root, before.kind, before.id),
      settings.max_entry_bytes,
    );
    if (current && !current.equals(knowledgeBytes(change.after, settings.max_entry_bytes)))
      throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
    return;
  }
  if (change.archived) {
    const before = change.before;
    const after = change.after;
    if (
      !before ||
      !after ||
      change.before_text === null ||
      before.kind !== KnowledgeKind.Persona ||
      PersonaRecordSchema.parse(Bun.YAML.parse(before.body)).state !== PersonaState.Deleted ||
      PersonaRecordSchema.parse(Bun.YAML.parse(after.body)).state !== PersonaState.Deleted
    )
      throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
    const current = await archivedPersona(root, before.id);
    if (
      await optionalKnowledgeBytes(
        knowledgePath(root, before.kind, before.id),
        settings.max_entry_bytes,
      )
    )
      throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
    if (
      current &&
      (current.bytes.equals(Buffer.from(change.before_text)) ||
        current.bytes.equals(knowledgeBytes(after, settings.max_entry_bytes)))
    )
      return;
    throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
  }
  const entry = change.after ?? change.before;
  if (!entry) throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
  const current = await optionalKnowledgeBytes(
    knowledgePath(root, entry.kind, entry.id),
    settings.max_entry_bytes,
  );
  const previous = change.before_text === null ? null : Buffer.from(change.before_text);
  const next = change.after ? knowledgeBytes(change.after, settings.max_entry_bytes) : null;
  if (current === null && (previous === null || next === null)) return;
  if (current && ((previous && current.equals(previous)) || (next && current.equals(next)))) return;
  throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
}

export async function publishKnowledgeFiles(
  root: string,
  change: KnowledgeChange,
  settings: KnowledgeSettings,
  observe?: KnowledgeStageObserver,
): Promise<Buffer | null> {
  validateBefore(change, settings);
  await verifyCurrent(root, change, settings);
  await preserveHistory(root, change);
  await observe?.(KnowledgePublicationStage.History);
  const entry = change.after ?? change.before;
  if (!entry) throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
  const path = change.archived
    ? join(
        root,
        KnowledgeFile.History,
        entry.kind,
        entry.id,
        String(entry.version) + knowledgeExtension(entry.kind),
      )
    : knowledgePath(root, entry.kind, entry.id);
  const bytes = change.after ? knowledgeBytes(change.after, settings.max_entry_bytes) : null;
  if (bytes) await atomicWrite(path, bytes);
  else await removeKnowledgeFile(path, dirname(path));
  await observe?.(KnowledgePublicationStage.File);
  return bytes;
}
