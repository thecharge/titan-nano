import {
  KnowledgeKind,
  KnowledgeMeaningFixture,
  KnowledgeMeaningSetup,
  KnowledgeSearchMode,
} from "@titan/constants";
import { newId } from "@titan/core";
import { KnowledgeHub } from "@titan/knowledge";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type Embedder,
  type KnowledgeMeaning,
  KnowledgeSearchPageSchema,
  type KnowledgeVectorIndex,
} from "@titan/types";

function concepts(text: string): number[] {
  return [
    Number(KnowledgeMeaningFixture.Time.test(text)),
    Number(KnowledgeMeaningFixture.Cooking.test(text)),
  ];
}

function similarity(left: number[], right: number[]): number {
  return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

function fakeIndex(ghost: boolean): KnowledgeVectorIndex {
  const vectors = new Map<string, number[]>();
  return {
    replace: async (id, vector) => {
      vectors.set(id, vector);
    },
    remove: async (id) => {
      vectors.delete(id);
    },
    nearest: async (vector, limit) => {
      const hits = [...vectors]
        .map(([id, stored]) => ({ id, score: similarity(vector, stored) }))
        .sort((left, right) => right.score - left.score)
        .slice(0, limit);
      return ghost ? [...hits, { id: newId(), score: 1 }] : hits;
    },
    close: async () => {},
  };
}

export function meaningFor(setup: KnowledgeMeaningSetup): KnowledgeMeaning {
  const embedder: Embedder = {
    name: KnowledgeMeaningFixture.EmbedderName,
    embed: async (text) => {
      if (setup === KnowledgeMeaningSetup.BrokenEmbedder)
        throw new Error(KnowledgeMeaningFixture.Broken);
      return concepts(text);
    },
  };
  return {
    embedder,
    open: async () => {
      if (setup === KnowledgeMeaningSetup.Unloadable)
        throw new Error(KnowledgeMeaningFixture.Broken);
      return fakeIndex(setup === KnowledgeMeaningSetup.Ghost);
    },
  };
}

const lesson = {
  kind: KnowledgeKind.Lesson,
  title: KnowledgeMeaningFixture.Title,
  tags: [],
  body: KnowledgeMeaningFixture.Body,
};

const renamed = {
  ...lesson,
  title: KnowledgeMeaningFixture.UpdatedTitle,
  body: KnowledgeMeaningFixture.UpdatedBody,
};

export async function knowledgeMeaning(
  mode: KnowledgeSearchMode,
  question: string,
  setup: KnowledgeMeaningSetup,
  kind?: KnowledgeKind,
) {
  async function observe(home: string) {
    const hub = await KnowledgeHub.open(home, {}, undefined, meaningFor(setup));
    try {
      const added = await hub.add(lesson);
      const id = added.entry.id;
      const changing =
        setup === KnowledgeMeaningSetup.Updated || setup === KnowledgeMeaningSetup.Deleted;
      if (changing)
        await hub.search({
          question: KnowledgeMeaningFixture.Related,
          mode: KnowledgeSearchMode.Meaning,
        });
      if (setup === KnowledgeMeaningSetup.Updated)
        await hub.update({ id, version: 1, entry: renamed });
      if (setup === KnowledgeMeaningSetup.Deleted) await hub.delete({ id, version: 1 });
      const page = KnowledgeSearchPageSchema.parse(await hub.search({ question, mode, kind }));
      return {
        count: page.results.length,
        first: page.results[0]?.id === id,
        score: page.results[0]?.score ?? null,
        actual_mode: page.actual_mode,
        warning: page.warning,
      };
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}
