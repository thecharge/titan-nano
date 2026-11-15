import { KnowledgeKind } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const knowledgeRunnerDecisionCases = {
  positive: [
    positive("kept fact publishes before step success", [KnowledgeKind.Fact, false], true),
    positive("kept lesson publishes before step success", [KnowledgeKind.Lesson, false], true),
  ],
  negative: [
    rejected(
      "final fact refutation discards every proposal",
      [KnowledgeKind.Fact, true, true],
      true,
    ),
    rejected(
      "final lesson refutation discards every proposal",
      [KnowledgeKind.Lesson, true, true],
      true,
    ),
    rejected("refuted fact cannot leak through a later success", [KnowledgeKind.Fact, true], true),
    rejected(
      "refuted lesson cannot leak through a later success",
      [KnowledgeKind.Lesson, true],
      true,
    ),
  ],
};
export const knowledgeRunnerConflictCases = {
  positive: [
    positive("current fact set keeps both checked changes", [KnowledgeKind.Fact, false], true),
    positive("current lesson set keeps both checked changes", [KnowledgeKind.Lesson, false], true),
  ],
  negative: [
    rejected("stale fact set fails without partial publication", [KnowledgeKind.Fact, true], true),
    rejected(
      "stale lesson set fails without partial publication",
      [KnowledgeKind.Lesson, true],
      true,
    ),
  ],
};
