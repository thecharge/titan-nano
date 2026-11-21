import { Backend, KnowledgeKind, KnowledgePublicationStage } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const knowledgeRunnerRecoveryCases = {
  positive: [
    positive(
      "checked fact intent survives owner restart",
      [KnowledgePublicationStage.Journal, KnowledgeKind.Fact, Backend.Codex],
      true,
    ),
    positive(
      "checked lesson intent survives owner restart",
      [KnowledgePublicationStage.Journal, KnowledgeKind.Lesson, Backend.Claude],
      true,
    ),
  ],
  negative: [
    rejected(
      "file interruption cannot rerun checked fact agents",
      [KnowledgePublicationStage.File, KnowledgeKind.Fact, Backend.Codex],
      true,
    ),
    rejected(
      "lost receipt cannot duplicate checked lesson changes",
      [KnowledgePublicationStage.Receipt, KnowledgeKind.Lesson, Backend.Claude],
      true,
    ),
    rejected(
      "lost receipt cannot duplicate checked Codex delivery",
      [KnowledgePublicationStage.Receipt, KnowledgeKind.Fact, Backend.Codex],
      true,
    ),
  ],
};

export const knowledgeRunnerArtifactCases = {
  positive: [
    positive(
      "unchanged fact candidate admits checked publication",
      [KnowledgeKind.Fact, false],
      true,
    ),
    positive(
      "unchanged lesson candidate admits checked publication",
      [KnowledgeKind.Lesson, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "changed fact candidate cannot publish its private set",
      [KnowledgeKind.Fact, true],
      true,
    ),
    rejected(
      "changed lesson candidate cannot publish its private set",
      [KnowledgeKind.Lesson, true],
      true,
    ),
  ],
};
