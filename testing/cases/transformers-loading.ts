import { EmbedderFixture, LocalEmbedder, TransformersSetup as Setup } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const empty = { loaded: false, loads: 0, task: "", model: "", vector: [] };

export const transformersLoadingCases = {
  positive: [
    positive("the extractor loads the library once and shapes the output", [Setup.Fake], {
      loaded: true,
      loads: 1,
      task: LocalEmbedder.Task,
      model: LocalEmbedder.Model,
      vector: EmbedderFixture.Vector,
    }),
    positive("the installed library loads and offers a pipeline", [Setup.Real], {
      ...empty,
      loaded: true,
    }),
  ],
  negative: [
    rejected("a library that is not installed does not load", [Setup.Missing], empty),
    rejected("a failed load is reported once and kept", [Setup.Broken], { ...empty, loads: 1 }),
  ],
};
