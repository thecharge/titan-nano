import { ErrorCode, KnowledgeFileFixture } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

const corrupt = { code: ErrorCode.KnowledgeCorrupt };
export const knowledgeFileRecoveryCases = {
  positive: [
    positive("intact owner reopens its committed entry", [KnowledgeFileFixture.Intact], true),
    positive(
      "missing database rebuilds from committed files",
      [KnowledgeFileFixture.Rebuild],
      true,
    ),
  ],
  negative: [
    negative(
      "malformed final entry cannot become ready",
      [KnowledgeFileFixture.MalformedEntry],
      corrupt,
    ),
    negative(
      "malformed journal refuses readiness and releases the owner",
      [KnowledgeFileFixture.Journal],
      corrupt,
    ),
    negative(
      "journal original text must match its original entry",
      [KnowledgeFileFixture.Before],
      corrupt,
    ),
    negative("entry identity must match its file path", [KnowledgeFileFixture.Entry], corrupt),
    negative(
      "journal symlink cannot read outside bytes",
      [KnowledgeFileFixture.LinkedJournal],
      corrupt,
    ),
    negative(
      "database symlink cannot modify outside bytes",
      [KnowledgeFileFixture.LinkedDatabase],
      corrupt,
    ),
    negative(
      "database hard link cannot modify outside bytes",
      [KnowledgeFileFixture.SharedDatabase],
      corrupt,
    ),
  ],
};
export const knowledgeSearchBudgetCases = {
  positive: [
    positive("two word results fit the page budget", [2, false], false),
    positive("four word results fit the page budget", [4, false], false),
  ],
  negative: [
    rejected("expanded metadata truncates below requested count", [180, true], true),
    rejected("maximum count cannot exceed the page byte budget", [200, true], true),
  ],
};
