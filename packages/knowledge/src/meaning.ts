import { KnowledgeKind, Newline } from "@titan/constants";
import {
  type KnowledgeEntry,
  type KnowledgeMatch,
  type KnowledgeMeaningRuntime,
  type KnowledgeReader,
  type KnowledgeVectorHit,
  KnowledgeVectorHitsSchema,
  type KnowledgeVectorScores,
} from "@titan/types";
import type { KnowledgeCatalog } from "./catalog.ts";
import { personaMergeOffers } from "./persona-merge.ts";

export class KnowledgeMeaningSearch {
  private embedded = new Map<string, string>();

  constructor(
    private runtime: KnowledgeMeaningRuntime,
    private catalog: KnowledgeCatalog,
    private read: KnowledgeReader,
  ) {}

  async ready(): Promise<boolean> {
    return (await this.runtime.embedder.ready?.()) ?? true;
  }

  get name(): string {
    return this.runtime.embedder.name;
  }

  async merges() {
    if (!(await this.ready())) return [];
    return personaMergeOffers(this.read, this.catalog.rows(), this.runtime.embedder);
  }

  async hits(question: string, limit: number, all = false): Promise<KnowledgeVectorHit[] | null> {
    try {
      await this.sync(all);
      const vector = await this.runtime.embedder.embed(question);
      const hits = KnowledgeVectorHitsSchema.parse(await this.runtime.index.nearest(vector, limit));
      return hits.filter((hit) => hit.score > 0);
    } catch {
      return null;
    }
  }

  private async sync(all: boolean): Promise<void> {
    const seen = new Set<string>();
    for await (const row of this.catalog.rows()) {
      if (!all && row.kind === KnowledgeKind.Persona && (await this.catalog.hidden(row.id)))
        continue;
      seen.add(row.id);
      if (this.embedded.get(row.id) === row.hash) continue;
      const { entry } = await this.read(row.id);
      await this.runtime.index.replace(row.id, await this.runtime.embedder.embed(text(entry)));
      this.embedded.set(row.id, row.hash);
    }
    for (const id of [...this.embedded.keys()]) {
      if (seen.has(id)) continue;
      await this.runtime.index.remove(id);
      this.embedded.delete(id);
    }
  }
}

function text(entry: KnowledgeEntry): string {
  return entry.title + Newline + entry.body;
}

export async function blendMeaning(
  catalog: KnowledgeCatalog,
  words: readonly KnowledgeMatch[],
  hits: readonly KnowledgeVectorHit[],
  kind: KnowledgeKind | undefined,
  limit: number,
) {
  const rows = new Map(words.map((row) => [row.id, row]));
  for (const hit of hits) {
    if (rows.has(hit.id)) continue;
    const row = await catalog.get(hit.id);
    if (!row || (kind && row.kind !== kind)) continue;
    rows.set(hit.id, { ...row, matched: row.summary, rank: 0 });
  }
  const scores: KnowledgeVectorScores = new Map(hits.map((hit) => [hit.id, hit.score]));
  return { rows: [...rows.values()].slice(0, limit), scores };
}
