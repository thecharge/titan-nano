import { resolve } from "node:path";
import {
  ErrorCode,
  KnowledgeAttemptFile,
  KnowledgeAttemptState,
  KnowledgeFormat,
  KnowledgeLimit,
  KnowledgeMemoryDatabase,
  KnowledgeSearchMode,
  KnowledgeState,
  PathPart,
  ServerDatabaseAdapter,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import { jsonByteLength } from "@titan/streams";
import {
  type KnowledgeAttemptDocument,
  KnowledgeEntrySchema,
  type KnowledgeMatch,
  type KnowledgeSearch,
  KnowledgeSearchSchema,
  type KnowledgeSettings,
  KnowledgeViewSearchPageSchema,
  type KnowledgeViewSearchResult,
  KnowledgeViewSearchResultSchema,
} from "@titan/types";
import { KnowledgeCatalog } from "./catalog.ts";
import { insertKnowledgeRow } from "./catalog-rows.ts";
import { knowledgeAttemptPath } from "./files.ts";
import { knowledgeBytes } from "./format.ts";
import { searchResults } from "./search.ts";

export class KnowledgeAttemptSearch {
  constructor(
    private root: string,
    private catalog: KnowledgeCatalog,
    private settings: KnowledgeSettings,
  ) {}

  private async pending(
    document: KnowledgeAttemptDocument | null,
    query: KnowledgeSearch,
  ): Promise<KnowledgeMatch[]> {
    if (!document?.mutations.some((mutation) => mutation.entry !== null)) return [];
    await using resources = new AsyncDisposableStack();
    const database = new Bun.SQL({
      adapter: ServerDatabaseAdapter,
      filename: KnowledgeMemoryDatabase,
      strict: true,
    });
    resources.defer(() => database.close());
    const memory = new KnowledgeCatalog(database, this.root, this.settings);
    await memory.initialize();
    for (const mutation of document.mutations) {
      if (!mutation.entry) continue;
      const entry = KnowledgeEntrySchema.parse({
        ...mutation.entry,
        id: mutation.id,
        version: (mutation.version ?? 0) + 1,
      });
      await insertKnowledgeRow(
        database,
        entry,
        knowledgeBytes(entry, this.settings.max_entry_bytes),
      );
    }
    return await memory.search(query);
  }

  async page(input: unknown, document: KnowledgeAttemptDocument | null, revision: string) {
    const parsed = KnowledgeSearchSchema.safeParse(input);
    if (!parsed.success) throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Search);
    const query = parsed.data;
    if (query.mode === KnowledgeSearchMode.Meaning)
      throw new TitanError(ErrorCode.NotBuilt, KnowledgeMessage.MeaningUnavailable);
    const active =
      document?.state === KnowledgeAttemptState.Open ||
      document?.state === KnowledgeAttemptState.Prepared
        ? document
        : null;
    const mutations = active?.mutations ?? [];
    const excluded = mutations.map((mutation) => mutation.id);
    const privateRows = await this.pending(active, query);
    const finalRows = await this.catalog.search(query, excluded);
    const rows = [...privateRows, ...finalRows];
    const page = this.project(rows, active, query.limit);
    return KnowledgeViewSearchPageSchema.parse({
      schema_version: KnowledgeFormat.Version,
      revision,
      private_revision: document?.revision ?? null,
      query,
      actual_mode: KnowledgeSearchMode.Words,
      warning: query.mode === KnowledgeSearchMode.Both ? KnowledgeMessage.MeaningUnavailable : null,
      ...page,
    });
  }

  private project(
    rows: KnowledgeMatch[],
    document: KnowledgeAttemptDocument | null,
    limit: number,
  ) {
    const page = searchResults(this.root, rows.slice(0, limit));
    const pending = new Set(document?.mutations.map((mutation) => mutation.id) ?? []);
    const directory = resolve(this.root, PathPart.Parent, KnowledgeAttemptFile.Directory);
    const privatePath = document ? knowledgeAttemptPath(directory, document.scope) : null;
    const results: KnowledgeViewSearchResult[] = [];
    let bytes = 0;
    for (const entry of page.results) {
      const result = KnowledgeViewSearchResultSchema.parse({
        ...entry,
        path: pending.has(entry.id) ? privatePath : entry.path,
        visibility: pending.has(entry.id) ? KnowledgeState.Pending : KnowledgeState.Final,
      });
      bytes += jsonByteLength(result, KnowledgeLimit.PageBytes);
      if (bytes > KnowledgeLimit.PageBytes) return { results, truncated: true };
      results.push(result);
    }
    return { results, truncated: page.truncated || rows.length > limit };
  }
}
