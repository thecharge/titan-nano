import { KnowledgeTamper } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const intact = {
  printed: true,
  file: true,
  row: true,
  version: true,
  body: true,
  history: true,
};
export const knowledgeCliScenarioCases = {
  positive: [
    positive(
      "fact in Sofia is stored, indexed and versioned",
      ["Rent in Sofia", KnowledgeTamper.None],
      intact,
    ),
    positive(
      "fact in Varna is stored, indexed and versioned",
      ["Rent in Varna", KnowledgeTamper.None],
      intact,
    ),
  ],
  negative: [
    rejected("missing index file shows no row", ["Rent in Sofia", KnowledgeTamper.DropIndex], {
      ...intact,
      row: false,
    }),
    rejected(
      "missing history file shows no old version",
      ["Rent in Sofia", KnowledgeTamper.DropHistory],
      { ...intact, history: false },
    ),
  ],
};
