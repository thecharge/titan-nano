import { FakeEmbedder } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const sameVectorCases = {
  positive: [
    positive("skeptic twice gives equal vectors", ["skeptic", "skeptic"], {
      equal: true,
      size: FakeEmbedder.Dimension,
    }),
    positive("empty text twice gives equal vectors", ["", ""], {
      equal: true,
      size: FakeEmbedder.Dimension,
    }),
  ],
  negative: [
    rejected("different words give different vectors", ["skeptic", "critic"], {
      equal: false,
      size: FakeEmbedder.Dimension,
    }),
    rejected("case change gives a different vector", ["skeptic", "Skeptic"], {
      equal: false,
      size: FakeEmbedder.Dimension,
    }),
  ],
};
