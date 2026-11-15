import { ErrorCode, FileEncoding, KnowledgeFile, KnowledgeKind, Newline } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import { validateByteLimit } from "@titan/streams";
import {
  type KnowledgeEntry,
  KnowledgeEntrySchema,
  KnowledgeImportSchema,
  KnowledgeInputSchema,
} from "@titan/types";

function document(bytes: Uint8Array, maximum: number): unknown {
  validateByteLimit(maximum);
  if (bytes.byteLength > maximum)
    throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Invalid);
  const text = new TextDecoder(FileEncoding.Utf8, { fatal: true })
    .decode(bytes)
    .replace(KnowledgeFile.Newlines, Newline);
  if (!text.startsWith(KnowledgeFile.Header)) {
    const entry = KnowledgeInputSchema.parse(Bun.YAML.parse(text));
    if (entry.kind !== KnowledgeKind.Persona) throw new Error(KnowledgeMessage.Invalid);
    return entry;
  }
  const end = text.indexOf(KnowledgeFile.HeaderEnd, KnowledgeFile.Header.length);
  if (end < 0) throw new Error(KnowledgeMessage.Invalid);
  const header = KnowledgeImportSchema.parse(
    Bun.YAML.parse(text.slice(KnowledgeFile.Header.length, end)),
  );
  if (header.kind === KnowledgeKind.Persona) throw new Error(KnowledgeMessage.Invalid);
  return { ...header, body: text.slice(end + KnowledgeFile.HeaderEnd.length) };
}

export function parseKnowledgeFile(bytes: Uint8Array, maximum: number) {
  try {
    return KnowledgeInputSchema.parse(document(bytes, maximum));
  } catch {
    throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Invalid);
  }
}

export function parseKnowledgeEntry(bytes: Uint8Array, maximum: number): KnowledgeEntry {
  try {
    return KnowledgeEntrySchema.parse(document(bytes, maximum));
  } catch {
    throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
  }
}

export function knowledgeBytes(value: KnowledgeEntry, maximum: number): Buffer {
  validateByteLimit(maximum);
  const entry = KnowledgeEntrySchema.parse(value);
  const { body, ...header } = entry;
  const text =
    entry.kind === KnowledgeKind.Persona
      ? Bun.YAML.stringify(entry, null, 2)
      : KnowledgeFile.Header +
        Bun.YAML.stringify(header, null, 2).trimEnd() +
        KnowledgeFile.HeaderEnd +
        body;
  const bytes = Buffer.from(text);
  if (bytes.byteLength > maximum)
    throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Invalid);
  return bytes;
}
