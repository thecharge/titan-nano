import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  EmbedderFixture,
  KnowledgeLimit,
  KnowledgeMeaningLocal,
  LocalEmbedder,
  VectorIndexSetup,
} from "@titan/constants";
import { newId } from "@titan/core";
import { createFakeEmbedder } from "@titan/embedder-fake";
import { openVectorIndex } from "@titan/knowledge";
import { withTemporaryDirectory } from "@titan/test-framework/files";

export async function vectorIndex(setup: VectorIndexSetup) {
  return withTemporaryDirectory(async (home) => {
    const path = join(home, KnowledgeMeaningLocal.VectorFile);
    if (setup === VectorIndexSetup.Garbage) await writeFile(path, EmbedderFixture.Garbage);
    const index = await openVectorIndex(path).catch(() => null);
    if (!index) return { opened: false, wrote: false, count: 0, top: false, score: null };
    try {
      const id = newId();
      const vector = await createFakeEmbedder().embed(EmbedderFixture.Text);
      const stored =
        setup === VectorIndexSetup.Oversize
          ? [...vector, ...new Array<number>(LocalEmbedder.Dimension).fill(1)]
          : vector;
      const wrote = await index.replace(id, stored).then(
        () => true,
        () => false,
      );
      if (setup === VectorIndexSetup.Removed) await index.remove(id);
      const hits = await index.nearest(vector, KnowledgeLimit.Page);
      return {
        opened: true,
        wrote,
        count: hits.length,
        top: hits[0]?.id === id,
        score: hits[0]?.score ?? null,
      };
    } finally {
      await index.close();
    }
  });
}
