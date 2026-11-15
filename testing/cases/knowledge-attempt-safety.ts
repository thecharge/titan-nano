import { KnowledgeAttemptFixture, KnowledgeKind } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const knowledgeAttemptAdmissionCases = {
  positive: [
    positive("two private sets fit owner capacity", ["max_sets", true], true),
    positive("two private entries fit owner capacity", ["max_entries", true], true),
    positive("private bytes fit owner capacity", ["max_bytes", true], true),
  ],
  negative: [
    rejected("second private set cannot exceed capacity", ["max_sets", false], true),
    rejected("second private entry cannot exceed capacity", ["max_entries", false], true),
    rejected("private bytes cannot exceed capacity", ["max_bytes", false], true),
  ],
};
export const knowledgeAttemptConflictCases = {
  positive: [
    positive("current fact set publishes both edits", [KnowledgeKind.Fact, false], true),
    positive("current lesson set publishes both edits", [KnowledgeKind.Lesson, false], true),
  ],
  negative: [
    rejected("stale second fact leaves entire proposal open", [KnowledgeKind.Fact, true], true),
    rejected("stale second lesson leaves entire proposal open", [KnowledgeKind.Lesson, true], true),
  ],
};
export const knowledgeAttemptValidationCases = {
  positive: [
    positive("fact proposal admits unique entries", [KnowledgeKind.Fact, false], true),
    positive("lesson proposal admits unique entries", [KnowledgeKind.Lesson, false], true),
  ],
  negative: [
    rejected("fact proposal cannot duplicate identity", [KnowledgeKind.Fact, true], true),
    rejected("lesson proposal cannot duplicate identity", [KnowledgeKind.Lesson, true], true),
  ],
};
export const knowledgeAttemptFileCases = {
  positive: [
    positive("intact private receipt remains readable", [KnowledgeAttemptFixture.Intact], true),
    positive("private receipt survives a new owner", [KnowledgeAttemptFixture.Reopen], true),
  ],
  negative: [
    rejected("malformed private bytes cannot be read", [KnowledgeAttemptFixture.Malformed], true),
    rejected("private file cannot change owner scope", [KnowledgeAttemptFixture.Scope], true),
    rejected("private receipt cannot return to open", [KnowledgeAttemptFixture.Receipt], true),
    rejected("private receipt cannot change digest", [KnowledgeAttemptFixture.Digest], true),
    rejected(
      "private receipt cannot lose entry metadata",
      [KnowledgeAttemptFixture.Metadata],
      true,
    ),
    rejected("private file link cannot be followed", [KnowledgeAttemptFixture.Linked], true),
    rejected("private shared file cannot be trusted", [KnowledgeAttemptFixture.Shared], true),
  ],
};
