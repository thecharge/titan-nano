import { KnowledgeKind } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const knowledgeInspectionCases = {
  positive: [
    positive("facts are inspected without recording reads", [KnowledgeKind.Fact, false], true),
    positive("lessons retain their persisted read counters", [KnowledgeKind.Lesson, false], true),
  ],
  negative: [
    rejected("fact inspection refuses all mutation methods", [KnowledgeKind.Fact, true], true),
    rejected(
      "lesson inspection refuses question search and writes",
      [KnowledgeKind.Lesson, true],
      true,
    ),
  ],
};
export const missingInspectionCases = {
  positive: [
    positive("empty home yields an empty view", [false], true),
    positive("missing home yields an empty view", [true], true),
  ],
  negative: [
    rejected("empty view does not create a database", [false], true),
    rejected("missing view does not create its directory", [true], true),
  ],
};

export const inspectionAdmissionCases = {
  positive: [
    positive("bounded snapshot reads an indexed fact", ["fact"], true),
    positive("bounded snapshot reads an indexed lesson", ["lesson"], true),
  ],
  negative: [
    rejected("entry count beyond budget is refused", ["capacity"], true),
    rejected("index byte budget is enforced", ["bytes"], true),
    rejected("missing entry is not adopted", ["missing"], true),
    rejected("external content change is not shown as indexed content", ["changed"], true),
  ],
};
