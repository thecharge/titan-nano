import { Database } from "bun:sqlite";
import { join } from "node:path";
import { KnowledgeFile, KnowledgeMeta, KnowledgeSql } from "@titan/constants";
import { createFakeEmbedder } from "@titan/embedder-fake";
import { KnowledgeHub, localMeaning, selectEmbedder } from "@titan/knowledge";
import { withTemporaryDirectory } from "@titan/test-framework/files";

export async function embedderRecord(
  first: string | undefined,
  second: string | undefined,
  reindexed: boolean,
) {
  return withTemporaryDirectory(async (home) => {
    async function open(configured: string | undefined, reindex: boolean) {
      const embedder = selectEmbedder([createFakeEmbedder()], configured);
      const hub = await KnowledgeHub.open(home, {}, undefined, localMeaning(home, embedder));
      try {
        if (reindex) await hub.reindex();
      } finally {
        await hub.close();
      }
    }
    await open(first, false);
    await open(second, reindexed);
    const database = new Database(join(home, KnowledgeFile.Database), { readonly: true });
    try {
      const row = database.query(KnowledgeSql.MetaGet).get(KnowledgeMeta.Embedder);
      return Reflect.get(Object(row), "value");
    } finally {
      database.close();
    }
  });
}
