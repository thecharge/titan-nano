import { EmbedderFixture, FakeEmbedder } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const embedderRecordCases = {
  positive: [
    positive(
      "the first open records the embedder name",
      [undefined, undefined, false],
      FakeEmbedder.Name,
    ),
    positive(
      "a reindex after a change records the new name",
      [undefined, EmbedderFixture.Other, true],
      EmbedderFixture.Other,
    ),
  ],
  negative: [
    rejected(
      "a change without a reindex keeps the old name",
      [undefined, EmbedderFixture.Other, false],
      FakeEmbedder.Name,
    ),
    rejected(
      "a reindex with the same embedder keeps the name",
      [EmbedderFixture.Other, EmbedderFixture.Other, true],
      EmbedderFixture.Other,
    ),
  ],
};
