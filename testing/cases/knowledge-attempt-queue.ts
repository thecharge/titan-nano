import { KnowledgeKind } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const knowledgeAttemptQueueCases = {
  positive: [
    positive("fact owner close drains accepted private work", [KnowledgeKind.Fact, false], true),
    positive(
      "lesson owner close drains accepted private work",
      [KnowledgeKind.Lesson, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "failed fact publication fences queued private writes",
      [KnowledgeKind.Fact, true],
      true,
    ),
    rejected(
      "failed lesson publication fences queued private writes",
      [KnowledgeKind.Lesson, true],
      true,
    ),
  ],
};
