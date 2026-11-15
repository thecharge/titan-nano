import { createHash } from "node:crypto";
import { join } from "node:path";
import { assertNoSecrets } from "@titan/config";
import {
  ErrorCode,
  FileEncoding,
  HashAlgorithm,
  KnowledgeFile,
  KnowledgeLimit,
  KnowledgeMeta,
  KnowledgePattern,
  KnowledgeSql,
  KnowledgeState,
  KnowledgeText,
  Newline,
  TextSymbol,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage, knowledgeIndexRow } from "@titan/messages";
import { atomicWriteStream } from "@titan/streams";
import {
  type KnowledgeChange,
  KnowledgeKindStatsSchema,
  KnowledgeMatchesSchema,
  type KnowledgeRow,
  KnowledgeRowSchema,
  type KnowledgeSearch,
  type KnowledgeSettings,
  KnowledgeUsageSchema,
} from "@titan/types";
import { insertKnowledgeRow, knowledgeRecord, knowledgeWords } from "./catalog-rows.ts";
import { knowledgeFiles, knowledgePath, readKnowledgeBytes } from "./files.ts";
import { knowledgeBytes, parseKnowledgeEntry } from "./format.ts";

function cell(value: string): string {
  return value
    .replace(KnowledgePattern.Whitespace, TextSymbol.Space)
    .replace(KnowledgePattern.Markdown, KnowledgeText.MarkdownEscape);
}

function indexRow(row: KnowledgeRow): Buffer {
  const fields = [
    row.id,
    row.kind,
    row.title,
    row.tags,
    String(row.version),
    KnowledgeState.Final,
    row.summary,
  ];
  return Buffer.from(knowledgeIndexRow(fields.map(cell), row.path));
}

function admitRow(value: unknown, count: number, after: string, maximum: number): KnowledgeRow {
  const row = KnowledgeRowSchema.parse(value);
  if (count > maximum || row.id <= after)
    throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
  return row;
}

export class KnowledgeCatalog {
  private indexBytes = 0;
  constructor(
    private database: Bun.SQL,
    private root: string,
    private settings: KnowledgeSettings,
  ) {}

  async initialize(): Promise<void> {
    for (const query of KnowledgeSql.Initialize) await this.database.unsafe(query);
  }

  async embedderName(): Promise<string | undefined> {
    const rows = await this.database.unsafe(KnowledgeSql.MetaGet, [KnowledgeMeta.Embedder]);
    return rows[0]?.value;
  }

  async recordEmbedder(name: string): Promise<void> {
    await this.database.unsafe(KnowledgeSql.MetaSet, [KnowledgeMeta.Embedder, name]);
  }

  async adoptEmbedder(name: string): Promise<void> {
    if ((await this.embedderName()) === undefined) await this.recordEmbedder(name);
  }

  async embedderChanged(name: string): Promise<boolean> {
    const recorded = await this.embedderName();
    return recorded !== undefined && recorded !== name;
  }

  async usage() {
    return KnowledgeUsageSchema.parse((await this.database.unsafe(KnowledgeSql.Usage))[0]);
  }

  async markRead(ids: readonly string[]): Promise<void> {
    const now = Date.now();
    for (const id of ids) await this.database.unsafe(KnowledgeSql.MarkRead, [id, now]);
  }

  async neverRead(id: string): Promise<boolean> {
    return (await this.database.unsafe(KnowledgeSql.ReadCount, [id])).length === 0;
  }

  async kinds() {
    return KnowledgeKindStatsSchema.array().parse(await this.database.unsafe(KnowledgeSql.Kinds));
  }

  async get(id: string) {
    return KnowledgeRowSchema.optional().parse(
      (await this.database.unsafe(KnowledgeSql.Get, [id]))[0],
    );
  }

  async *rows() {
    let after: string = TextSymbol.Empty;
    let count = 0;
    while (true) {
      const rows = await this.database.unsafe(KnowledgeSql.Page, [
        after,
        KnowledgeLimit.MaximumPage,
      ]);
      if (!rows.length) return;
      for (const value of rows) {
        const row = admitRow(value, ++count, after, this.settings.max_entries);
        after = row.id;
        yield row;
      }
    }
  }

  async project(): Promise<string> {
    const digest = createHash(HashAlgorithm.Sha256);
    let bytes = 0;
    async function* output(rows: AsyncIterable<KnowledgeRow>) {
      const header = Buffer.from(KnowledgeMessage.Index);
      bytes += header.length;
      yield header;
      for await (const row of rows) {
        digest.update(row.id + TextSymbol.Colon + row.hash + Newline);
        const line = indexRow(row);
        bytes += line.length;
        yield line;
      }
    }
    await atomicWriteStream(
      join(this.root, KnowledgeFile.Index),
      output(this.rows()),
      this.settings.max_index_bytes,
    );
    this.indexBytes = bytes;
    return digest.digest(FileEncoding.Hex);
  }

  async admit(change: KnowledgeChange): Promise<void> {
    await this.admitMany([change]);
  }

  async admitMany(changes: KnowledgeChange[]): Promise<void> {
    const usage = await this.usage();
    let entries = usage.entries;
    let total = usage.bytes;
    let index = this.indexBytes;
    for (const change of changes) {
      const previous = change.before ? await this.get(change.before.id) : undefined;
      if (change.before && !previous && !change.restored)
        throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
      const next = change.after
        ? knowledgeRecord(change.after, knowledgeBytes(change.after, this.settings.max_entry_bytes))
        : undefined;
      entries += Number(Boolean(next)) - Number(Boolean(previous));
      total += (next?.bytes ?? 0) - (previous?.bytes ?? 0);
      index += (next ? indexRow(next).length : 0) - (previous ? indexRow(previous).length : 0);
    }
    if (
      entries > this.settings.max_entries ||
      total > this.settings.max_total_bytes ||
      index > this.settings.max_index_bytes
    )
      throw new TitanError(ErrorCode.Capacity, KnowledgeMessage.Capacity);
  }

  async rebuild(): Promise<void> {
    await this.database.begin(async (transaction) => {
      await transaction.unsafe(KnowledgeSql.Clear);
      await transaction.unsafe(KnowledgeSql.ClearSearch);
      await transaction.unsafe(KnowledgeSql.ClearHidden);
      await this.loadFiles(transaction);
    });
  }

  private async loadFiles(database: Bun.SQL): Promise<void> {
    let count = 0;
    let total = 0;
    for await (const path of knowledgeFiles(this.root, this.settings.max_entries)) {
      const bytes = await readKnowledgeBytes(path, this.settings.max_entry_bytes);
      assertNoSecrets(bytes);
      const entry = parseKnowledgeEntry(bytes, this.settings.max_entry_bytes);
      total += bytes.length;
      if (++count > this.settings.max_entries || total > this.settings.max_total_bytes)
        throw new TitanError(ErrorCode.Capacity, KnowledgeMessage.Capacity);
      if (knowledgePath(this.root, entry.kind, entry.id) !== path)
        throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
      await insertKnowledgeRow(database, entry, bytes);
    }
  }

  async replace(change: KnowledgeChange): Promise<void> {
    await this.replaceMany([change]);
  }

  async replaceMany(changes: KnowledgeChange[]): Promise<void> {
    await this.database.begin(async (transaction) => {
      for (const change of changes) await this.replaceOne(transaction, change);
    });
  }

  private async replaceOne(transaction: Bun.SQL, change: KnowledgeChange): Promise<void> {
    if (change.before) {
      await transaction.unsafe(KnowledgeSql.Delete, [change.before.id]);
      await transaction.unsafe(KnowledgeSql.DeleteSearch, [change.before.id]);
      await transaction.unsafe(KnowledgeSql.DeleteHidden, [change.before.id]);
    }
    if (change.after)
      await insertKnowledgeRow(
        transaction,
        change.after,
        knowledgeBytes(change.after, this.settings.max_entry_bytes),
      );
  }

  async search(query: KnowledgeSearch, excluded: readonly string[] = []) {
    if (!query.question)
      return KnowledgeMatchesSchema.parse(
        await this.database.unsafe(KnowledgeSql.Kind, [
          query.kind,
          JSON.stringify(excluded),
          Number(query.all === true),
          query.limit,
        ]),
      );
    const rows = await this.database.unsafe(KnowledgeSql.Search, [
      KnowledgeLimit.MatchedCharacters,
      knowledgeWords(query.question),
      query.kind ?? null,
      query.kind ?? null,
      JSON.stringify(excluded),
      Number(query.all === true),
      query.limit,
    ]);
    return KnowledgeMatchesSchema.parse(rows);
  }

  async hidden(id: string): Promise<boolean> {
    return (await this.database.unsafe(KnowledgeSql.Hidden, [id])).length > 0;
  }
}
