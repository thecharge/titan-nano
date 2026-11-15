import { KnowledgeKind } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const knowledgeStepFactKeptCases = {
  positive: [
    positive("surviving step keeps its fact as final", [KnowledgeKind.Fact, false], true),
    positive("surviving step keeps its lesson as final", [KnowledgeKind.Lesson, false], true),
  ],
  negative: [
    rejected("unchecked fact is absent after refutation", [KnowledgeKind.Fact, true], true),
    rejected("unchecked lesson is absent after refutation", [KnowledgeKind.Lesson, true], true),
  ],
};
export const knowledgeStepFactUndoneCases = {
  positive: [
    positive("refuted fact is undone and logged", [KnowledgeKind.Fact, true], true),
    positive("refuted lesson is undone and logged", [KnowledgeKind.Lesson, true], true),
  ],
  negative: [
    rejected("kept fact is not undone", [KnowledgeKind.Fact, false], true),
    rejected("kept lesson is not undone", [KnowledgeKind.Lesson, false], true),
  ],
};
