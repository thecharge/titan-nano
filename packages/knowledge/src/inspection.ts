import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { assertNoSecrets } from "@titan/config";
import {
  ErrorCode,
  FileEncoding,
  HashAlgorithm,
  KnowledgeFile,
  KnowledgeFormat,
  KnowledgeKind,
  KnowledgeLimit,
  KnowledgeMeta,
  KnowledgeSearchMode,
  KnowledgeSql,
  NativeToolRole,
  Newline,
  PersonaReferencePattern,
  PersonaRegister,
  TextSymbol,
  Verdict,
} from "@titan/constants";
import { hash } from "@titan/core";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage, personaNotInRegister } from "@titan/messages";
import { jsonByteLength } from "@titan/streams";
import {
  type Embedder,
  type KnowledgeClient,
  KnowledgeEntryResultSchema,
  KnowledgeHistoryPageSchema,
  KnowledgeHistoryQuerySchema,
  KnowledgeInspectionSnapshotSchema,
  type KnowledgeRow,
  KnowledgeRowSchema,
  KnowledgeSearchSchema,
  KnowledgeSelectionSchema,
  type KnowledgeSettings,
  type KnowledgeSettingsInput,
  KnowledgeSettingsSchema,
  KnowledgeStatsSchema,
  PersonaInspectionQuerySchema,
  PersonaInspectionSchema,
  type PersonaRecord,
} from "@titan/types";
import { knowledgeDates } from "./dates.ts";
import { assertKnowledgeFile, knowledgePath, readKnowledgeBytes } from "./files.ts";
import { parseKnowledgeEntry } from "./format.ts";
import { knowledgeHistory } from "./history.ts";
import {
  emptyPersonaUsage,
  hiddenPersona,
  personaEntryId,
  personaReference,
} from "./persona-lifecycle.ts";
import { personaRecord, splitReference } from "./persona-register.ts";
import { searchResults } from "./search.ts";

async function snapshot(home: string, settings: KnowledgeSettings) {
  const path = join(home, KnowledgeFile.Database);
  if (!(await assertKnowledgeFile(path)))
    return KnowledgeInspectionSnapshotSchema.parse({ rows: [], kinds: [] });
  const database = new Database(path, { readonly: true, strict: true });
  try {
    database.exec(KnowledgeSql.InspectionBegin);
    const rows: KnowledgeRow[] = [];
    let after: string = TextSymbol.Empty;
    let bytes = 0;
    while (true) {
      const page = database.query(KnowledgeSql.Page).all(after, KnowledgeLimit.MaximumPage);
      if (!page.length) break;
      for (const value of page) {
        const row = KnowledgeRowSchema.parse(value);
        bytes += jsonByteLength(row, settings.max_index_bytes);
        if (
          rows.length >= settings.max_entries ||
          row.id <= after ||
          bytes > settings.max_index_bytes
        )
          throw new TitanError(ErrorCode.Capacity, KnowledgeMessage.Capacity);
        assertNoSecrets(Buffer.from(JSON.stringify(row)));
        rows.push(row);
        after = row.id;
      }
    }
    const recorded = database.query(KnowledgeSql.MetaGet).get(KnowledgeMeta.Embedder);
    return KnowledgeInspectionSnapshotSchema.parse({
      rows,
      kinds: database.query(KnowledgeSql.Kinds).all(),
      embedder: Reflect.get(Object(recorded), KnowledgeMeta.Value),
    });
  } finally {
    database.close();
  }
}

async function refuseWrite(): Promise<never> {
  throw new TitanError(ErrorCode.PermissionDenied, KnowledgeMessage.InspectionReadOnly);
}

async function readInspectedEntry(root: string, row: KnowledgeRow, settings: KnowledgeSettings) {
  const bytes = await readKnowledgeBytes(
    knowledgePath(root, row.kind, row.id),
    settings.max_entry_bytes,
  );
  assertNoSecrets(bytes);
  const entry = parseKnowledgeEntry(bytes, settings.max_entry_bytes);
  if (
    entry.id !== row.id ||
    entry.kind !== row.kind ||
    entry.version !== row.version ||
    hash(bytes) !== row.hash
  )
    throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
  return entry;
}

export async function inspectPersona(home: string, input: unknown) {
  const query = PersonaInspectionQuerySchema.safeParse(input);
  if (!query.success) throw new TitanError(ErrorCode.Arguments, KnowledgeMessage.PersonaInspection);
  const { selector, before, limit } = query.data;
  if (
    !PersonaReferencePattern.test(selector) &&
    !PersonaReferencePattern.test(personaReference(selector, PersonaRegister.FirstVersion))
  )
    throw new TitanError(ErrorCode.UnknownPersona, personaNotInRegister(selector));
  const settings = KnowledgeSettingsSchema.parse({});
  const data = await snapshot(home, settings);
  const exact = PersonaReferencePattern.test(selector);
  const rows = data.rows.filter(
    (row) =>
      row.kind === KnowledgeKind.Persona &&
      PersonaReferencePattern.test(row.title) &&
      row.id === personaEntryId(row.title) &&
      (exact ? row.title === selector : splitReference(row.title).name === selector) &&
      (before === undefined || splitReference(row.title).version < before),
  );
  rows.sort(
    (left, right) => splitReference(right.title).version - splitReference(left.title).version,
  );
  if (!rows.length && before === undefined)
    throw new TitanError(ErrorCode.UnknownPersona, personaNotInRegister(selector));
  const versions: PersonaRecord[] = [];
  const name = exact ? splitReference(selector).name : selector;
  let bytes = jsonByteLength(
    { name, versions: [], has_more: true, next_version: Number.MAX_SAFE_INTEGER },
    KnowledgeLimit.HistoryBytes,
  );
  for (const row of rows.slice(0, limit)) {
    const entry = await readInspectedEntry(join(home, KnowledgeFile.Directory), row, settings);
    const { name, version } = splitReference(row.title);
    const record = personaRecord(entry, name, version);
    const workers = record.history?.filter((result) => result.role === NativeToolRole.Worker) ?? [];
    const survived =
      record.survived ?? workers.filter((result) => result.verdict === Verdict.Survived).length;
    const refuted =
      record.refuted ?? workers.filter((result) => result.verdict === Verdict.Refuted).length;
    const measured = {
      ...record,
      survived,
      refuted,
      uses: record.uses ?? survived + refuted + (record.history?.length ?? 0) - workers.length,
      usage: record.usage ?? emptyPersonaUsage(false),
    };
    bytes += jsonByteLength(measured, KnowledgeLimit.HistoryBytes) + 1;
    if (bytes > KnowledgeLimit.HistoryBytes) break;
    versions.push(measured);
  }
  const has_more = rows.length > versions.length;
  return PersonaInspectionSchema.parse({
    name,
    versions,
    has_more,
    next_version: has_more ? versions.at(-1)?.version : null,
  });
}

export async function inspectKnowledge(
  home: string,
  embedder?: Embedder,
  input: KnowledgeSettingsInput = {},
): Promise<KnowledgeClient> {
  const settings = KnowledgeSettingsSchema.parse(input);
  const data = await snapshot(home, settings);
  const digest = createHash(HashAlgorithm.Sha256);
  for (const row of data.rows) digest.update(row.id + TextSymbol.Colon + row.hash + Newline);
  const revision = digest.digest(FileEncoding.Hex);
  const root = join(home, KnowledgeFile.Directory);
  const client: KnowledgeClient = {
    add: refuseWrite,
    update: refuseWrite,
    delete: refuseWrite,
    reindex: refuseWrite,
    maintenance: refuseWrite,
    restore: refuseWrite,
    async get(id) {
      KnowledgeSelectionSchema.parse({ id });
      const row = data.rows.find((entry) => entry.id === id);
      if (!row) throw new TitanError(ErrorCode.KnowledgeMissing, KnowledgeMessage.Missing);
      const entry = await readInspectedEntry(root, row, settings);
      return KnowledgeEntryResultSchema.parse({
        schema_version: KnowledgeFormat.Version,
        revision,
        entry,
      });
    },
    async history(input) {
      const query = KnowledgeHistoryQuerySchema.parse(input);
      const current = (await this.get(query.id)).entry;
      return KnowledgeHistoryPageSchema.parse({
        schema_version: KnowledgeFormat.Version,
        revision,
        id: current.id,
        kind: current.kind,
        current_version: current.version,
        ...(await knowledgeHistory(root, current, settings, query)),
      });
    },
    async search(input) {
      const query = KnowledgeSearchSchema.parse(input);
      if (query.question || query.mode !== KnowledgeSearchMode.Words)
        throw new TitanError(ErrorCode.PermissionDenied, KnowledgeMessage.InspectionReadOnly);
      const selected: KnowledgeRow[] = [];
      for (const row of data.rows) {
        if (row.kind !== query.kind) continue;
        if (
          !query.all &&
          row.kind === KnowledgeKind.Persona &&
          hiddenPersona((await this.get(row.id)).entry)
        )
          continue;
        selected.push(row);
      }
      const result = searchResults(
        root,
        selected.slice(0, query.limit).map((row) => ({ ...row, matched: row.summary, rank: 0 })),
      );
      return {
        schema_version: KnowledgeFormat.Version,
        revision,
        query,
        actual_mode: KnowledgeSearchMode.Words,
        warning: null,
        ...result,
        truncated: result.truncated || selected.length > query.limit,
      };
    },
    async stats() {
      const dates = await knowledgeDates(root, data.rows, data.kinds);
      const ready =
        embedder !== undefined &&
        ((await embedder.ready?.()) ?? true) &&
        (data.embedder === undefined || data.embedder === embedder.name);
      return KnowledgeStatsSchema.parse({
        schema_version: KnowledgeFormat.Version,
        revision,
        entries: data.rows.length,
        bytes: data.kinds.reduce((sum, row) => sum + row.bytes, 0),
        never_read: data.kinds.reduce((sum, row) => sum + row.never_read, 0),
        ...dates,
        meaning_ready: ready,
      });
    },
  };
  return client;
}
