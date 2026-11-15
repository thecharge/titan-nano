import { positive, rejected } from "@titan/test-factories";

export const personaDefinitionCases = {
  positive: [
    positive(
      "open-call tags match regardless of order and allow additional skills",
      ["order"],
      true,
    ),
    positive(
      "an approved merge publishes a trial definition and retains both source versions",
      ["merge"],
      true,
    ),
    positive(
      "a supplied definition answers an empty open call and runs after approval",
      ["new"],
      true,
    ),
    positive("the persona file command publishes the approved definition", ["cli"], true),
    positive(
      "an approved improvement saves a new trial version with its parent",
      ["improve"],
      true,
    ),
  ],
  negative: [
    rejected("a merge cannot supply the same source version twice", ["duplicate"], true),
    rejected("a definition with other tags cannot answer the selected open call", ["tags"], true),
    rejected("an improvement cannot change another persona name", ["name"], true),
  ],
};
