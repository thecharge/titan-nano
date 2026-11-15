import {
  ErrorCode,
  KnowledgePromote,
  KnowledgePromoteCase,
  KnowledgeScope,
  KnowledgeScopeFixture,
} from "@titan/constants";
import { KnowledgeMessage } from "@titan/messages";
import { positive, rejected } from "@titan/test-factories";

export const scopedPromoteCases = {
  positive: [
    positive(
      "the home entry keeps the text of the project entry",
      [KnowledgePromoteCase.Text],
      KnowledgeScopeFixture.UtcBody,
    ),
    positive(
      "the home entry records that it came from the project",
      [KnowledgePromoteCase.Source],
      `${KnowledgePromote.SourceTag}${KnowledgeScope.Project}`,
    ),
    positive(
      "the project entry is still there after promotion",
      [KnowledgePromoteCase.ProjectKept],
      `${KnowledgeScope.Project}${KnowledgeScopeFixture.Joiner}${KnowledgeScopeFixture.UtcTitle}`,
    ),
  ],
  negative: [
    rejected(
      "an id the home hub already has is refused",
      [KnowledgePromoteCase.Duplicate],
      ErrorCode.KnowledgeConflict,
    ),
    rejected(
      "the refusal says that the home hub already has the id",
      [KnowledgePromoteCase.DuplicateMessage],
      KnowledgeMessage.PromoteExists,
    ),
    rejected(
      "the refusal leaves the home entry unchanged",
      [KnowledgePromoteCase.DuplicateKept],
      KnowledgeScopeFixture.ZoneBody,
    ),
    rejected(
      "an id the project hub does not have is a missing entry",
      [KnowledgePromoteCase.Missing],
      ErrorCode.KnowledgeMissing,
    ),
  ],
};
