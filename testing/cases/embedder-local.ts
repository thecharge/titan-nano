import { EmbedderName, ErrorCode } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const localEmbedderCases = {
  positive: [
    positive("array output becomes the vector", [[0.25, 0.5]], {
      name: EmbedderName.Local,
      vector: [0.25, 0.5],
      model: true,
      failure: null,
    }),
    positive("typed array output becomes the vector", [new Float32Array([1, 2])], {
      name: EmbedderName.Local,
      vector: [1, 2],
      model: true,
      failure: null,
    }),
  ],
  negative: [
    rejected("the unavailable extractor fails with not built", [null], {
      name: EmbedderName.Local,
      vector: null,
      model: false,
      failure: ErrorCode.NotBuilt,
    }),
    rejected("empty output gives an empty vector", [[]], {
      name: EmbedderName.Local,
      vector: [],
      model: true,
      failure: null,
    }),
  ],
};
