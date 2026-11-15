import { expect } from "bun:test";
import { resolve } from "node:path";
import {
  KnowledgeKind,
  KnowledgeMeaningFixture,
  KnowledgeSearchMode,
  LocalEmbedder,
  LocalModel,
} from "@titan/constants";
import { KnowledgeHub, localMeaning } from "@titan/knowledge";
import { createHomeEmbedder } from "@titan/runtime";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { KnowledgeSearchPageSchema } from "@titan/types";

import { defaultServices } from "../../apps/cli/src/bootstrap.ts";

export async function realModelFindsRelated(): Promise<void> {
  expect(
    (await defaultServices.fetchModel(resolve(process.cwd(), LocalModel.TestHome))).ready,
  ).toBe(true);
  const embedder = createHomeEmbedder(resolve(process.cwd(), LocalModel.TestHome));
  expect(await embedder.embed(KnowledgeMeaningFixture.Related)).toHaveLength(
    LocalEmbedder.Dimension,
  );
  await withTemporaryDirectory(async (home) => {
    const hub = await KnowledgeHub.open(home, {}, undefined, localMeaning(home, embedder));
    try {
      const added = await hub.add({
        kind: KnowledgeKind.Lesson,
        title: KnowledgeMeaningFixture.Title,
        tags: [],
        body: KnowledgeMeaningFixture.Body,
      });
      const page = KnowledgeSearchPageSchema.parse(
        await hub.search({
          question: KnowledgeMeaningFixture.Related,
          mode: KnowledgeSearchMode.Meaning,
        }),
      );
      expect(page.results[0]?.id).toBe(added.entry.id);
    } finally {
      await hub.close();
    }
  });
}
