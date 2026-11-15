import {
  ErrorCode,
  JsonToken,
  KnowledgeLimit,
  KnowledgePattern,
  KnowledgeSql,
  PathPart,
  TextSymbol,
} from "@titan/constants";
import { hash } from "@titan/core";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import { type KnowledgeEntry, type KnowledgeRow, KnowledgeRowSchema } from "@titan/types";
import { knowledgeExtension } from "./files.ts";
import { hiddenPersona } from "./persona-lifecycle.ts";

export function knowledgeWords(question: string): string {
  const terms = question.match(KnowledgePattern.Words) ?? [];
  if (!terms.length || terms.length > KnowledgeLimit.SearchTerms)
    throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Search);
  return terms.map((term) => JsonToken.Quote + term + JsonToken.Quote).join(TextSymbol.Space);
}

export function knowledgeRecord(entry: KnowledgeEntry, bytes: Buffer): KnowledgeRow {
  const path = [entry.kind, entry.id + knowledgeExtension(entry.kind)].join(PathPart.Separator);
  const summary = entry.body
    .replace(KnowledgePattern.Whitespace, TextSymbol.Space)
    .slice(0, KnowledgeLimit.SummaryCharacters);
  return KnowledgeRowSchema.parse({
    id: entry.id,
    kind: entry.kind,
    title: entry.title,
    tags: JSON.stringify(entry.tags),
    version: entry.version,
    path,
    summary,
    bytes: bytes.length,
    hash: hash(bytes),
  });
}

export async function insertKnowledgeRow(database: Bun.SQL, entry: KnowledgeEntry, bytes: Buffer) {
  const row = knowledgeRecord(entry, bytes);
  await database.unsafe(KnowledgeSql.Insert, [
    row.id,
    row.kind,
    row.title,
    row.tags,
    row.version,
    row.path,
    row.summary,
    row.bytes,
    row.hash,
  ]);
  await database.unsafe(KnowledgeSql.InsertSearch, [entry.id, entry.title, entry.body]);
  if (hiddenPersona(entry)) await database.unsafe(KnowledgeSql.InsertHidden, [entry.id]);
}
