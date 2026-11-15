import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  EmbedderFixture,
  KnowledgeKind,
  KnowledgeMeaningLocal,
  type KnowledgeSearchMode,
  VectorHubSetup,
} from "@titan/constants";
import { createFakeEmbedder } from "@titan/embedder-fake";
import { KnowledgeHub, localMeaning } from "@titan/knowledge";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { KnowledgeSearchPageSchema } from "@titan/types";

export async function vectorHub(
  mode: KnowledgeSearchMode,
  question: string,
  setup: VectorHubSetup,
  kind?: KnowledgeKind,
) {
  return withTemporaryDirectory(async (home) => {
    if (setup === VectorHubSetup.Blocked) await mkdir(join(home, KnowledgeMeaningLocal.VectorFile));
    const hub = await KnowledgeHub.open(
      home,
      {},
      undefined,
      localMeaning(home, createFakeEmbedder()),
    );
    try {
      const added = await hub.add({
        kind: KnowledgeKind.Lesson,
        title: EmbedderFixture.Title,
        tags: [],
        body: EmbedderFixture.Body,
      });
      const page = KnowledgeSearchPageSchema.parse(await hub.search({ question, mode, kind }));
      return {
        count: page.results.length,
        first: page.results[0]?.id === added.entry.id,
        score: page.results[0]?.score ?? null,
        actual_mode: page.actual_mode,
        warning: page.warning,
      };
    } finally {
      await hub.close();
    }
  });
}
