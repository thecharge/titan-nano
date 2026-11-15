import { KnowledgeKind } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const knowledgeWriterCases = {
  positive: [
    positive(
      "eight fact clients preserve every accepted update",
      [KnowledgeKind.Fact, false],
      true,
    ),
    positive(
      "eight lesson clients preserve every accepted update",
      [KnowledgeKind.Lesson, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "eight stale fact clients cannot overwrite a newer version",
      [KnowledgeKind.Fact, true],
      true,
    ),
    rejected(
      "eight stale lesson clients cannot overwrite a newer version",
      [KnowledgeKind.Lesson, true],
      true,
    ),
  ],
};
