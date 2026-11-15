import { KnowledgeKind, KnowledgePublicationStage } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const knowledgeAttemptRoundTripCases = {
  positive: [
    positive(
      "private fact set survives restart and publishes once",
      [KnowledgeKind.Fact, false],
      true,
    ),
    positive(
      "private lesson set survives restart and publishes once",
      [KnowledgeKind.Lesson, false],
      true,
    ),
  ],
  negative: [
    rejected("discarded fact set cannot return", [KnowledgeKind.Fact, true], true),
    rejected("discarded lesson set cannot return", [KnowledgeKind.Lesson, true], true),
  ],
};
export const knowledgeAttemptRevisionCases = {
  positive: [
    positive("fact set accepts its observed revision", [KnowledgeKind.Fact, false], true),
    positive("lesson set accepts its observed revision", [KnowledgeKind.Lesson, false], true),
  ],
  negative: [
    rejected("stale fact revision cannot overwrite", [KnowledgeKind.Fact, true], true),
    rejected("stale lesson revision cannot overwrite", [KnowledgeKind.Lesson, true], true),
  ],
};
export const knowledgeAttemptLoserCases = {
  positive: [
    positive(
      "refuted attempt one leaves only attempt two final",
      [KnowledgeKind.Fact, false, false],
      true,
    ),
    positive(
      "losing candidate leaves only the kept candidate final",
      [KnowledgeKind.Fact, true, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "refuted attempt cannot publish after a later success",
      [KnowledgeKind.Lesson, false, true],
      true,
    ),
    rejected(
      "losing candidate cannot publish after the judge keeps another",
      [KnowledgeKind.Lesson, true, true],
      true,
    ),
  ],
};
export const knowledgeAttemptRecoveryCases = {
  positive: [
    positive(
      "fact intent recovers the same publication",
      [KnowledgePublicationStage.Journal, KnowledgeKind.Fact],
      true,
    ),
    positive(
      "lesson intent recovers the same publication",
      [KnowledgePublicationStage.Journal, KnowledgeKind.Lesson],
      true,
    ),
  ],
  negative: [
    rejected(
      "fact file interruption cannot duplicate its set",
      [KnowledgePublicationStage.File, KnowledgeKind.Fact],
      true,
    ),
    rejected(
      "lesson receipt loss cannot duplicate its set",
      [KnowledgePublicationStage.Receipt, KnowledgeKind.Lesson],
      true,
    ),
  ],
};
export const knowledgeAttemptEmptyCases = {
  positive: [
    positive("empty fact proposal needs no final receipt", [KnowledgeKind.Fact, false], true),
    positive("empty lesson proposal needs no final receipt", [KnowledgeKind.Lesson, false], true),
  ],
  negative: [
    rejected("cleared fact proposal cannot publish removed text", [KnowledgeKind.Fact, true], true),
    rejected(
      "cleared lesson proposal cannot publish removed text",
      [KnowledgeKind.Lesson, true],
      true,
    ),
  ],
};
