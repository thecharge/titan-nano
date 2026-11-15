import {
  ErrorCode,
  KnowledgeCommitFixture,
  KnowledgeKind,
  KnowledgePublicationStage,
} from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const knowledgeCommitRoundTripCases = {
  positive: [
    positive(
      "two facts commit once across restart",
      [KnowledgeKind.Fact, KnowledgeCommitFixture.Update],
      true,
    ),
    positive(
      "two lessons commit once across restart",
      [KnowledgeKind.Lesson, KnowledgeCommitFixture.Update],
      true,
    ),
  ],
  negative: [
    rejected(
      "deleted fact cannot reappear on receipt retry",
      [KnowledgeKind.Fact, KnowledgeCommitFixture.Mixed],
      true,
    ),
    rejected(
      "deleted lesson cannot reappear on receipt retry",
      [KnowledgeKind.Lesson, KnowledgeCommitFixture.Mixed],
      true,
    ),
  ],
};
export const knowledgeCommitRefusalCases = {
  positive: [
    positive(
      "stale second entry preserves both originals",
      [KnowledgeCommitFixture.Conflict, ErrorCode.KnowledgeConflict],
      true,
    ),
    positive(
      "duplicate entry preserves both originals",
      [KnowledgeCommitFixture.Duplicate, ErrorCode.KnowledgeInvalid],
      true,
    ),
  ],
  negative: [
    rejected(
      "entry kind cannot change",
      [KnowledgeCommitFixture.Kind, ErrorCode.KnowledgeInvalid],
      true,
    ),
    rejected(
      "missing base cannot publish first entry",
      [KnowledgeCommitFixture.Missing, ErrorCode.KnowledgeMissing],
      true,
    ),
    rejected(
      "existing entry cannot be added again",
      [KnowledgeCommitFixture.Add, ErrorCode.KnowledgeConflict],
      true,
    ),
    rejected(
      "persona cannot bypass approval",
      [KnowledgeCommitFixture.Persona, ErrorCode.PermissionDenied],
      true,
    ),
  ],
};
export const knowledgeCommitAdmissionCases = {
  positive: [
    positive("two entries fit entry count", ["max_entries", true], true),
    positive("two entries fit total bytes", ["max_total_bytes", true], true),
    positive("two entries fit index bytes", ["max_index_bytes", true], true),
    positive("two entries fit publication count", ["max_publication_entries", true], true),
    positive("two entries fit publication bytes", ["max_publication_bytes", true], true),
  ],
  negative: [
    rejected("aggregate count refuses entire set", ["max_entries", false], true),
    rejected("aggregate bytes refuse entire set", ["max_total_bytes", false], true),
    rejected("aggregate index refuses entire set", ["max_index_bytes", false], true),
    rejected("publication count refuses entire set", ["max_publication_entries", false], true),
    rejected("publication bytes refuse entire set", ["max_publication_bytes", false], true),
  ],
};
export const knowledgeCommitReplacementCases = {
  positive: [
    positive("fact addition can precede freeing its slot", [KnowledgeKind.Fact, false], true),
    positive("lesson addition can precede freeing its slot", [KnowledgeKind.Lesson, false], true),
  ],
  negative: [
    rejected("fact deletion cannot leave stale count", [KnowledgeKind.Fact, true], true),
    rejected("lesson deletion cannot leave stale count", [KnowledgeKind.Lesson, true], true),
  ],
};
export const knowledgeCommitRecoveryCases = {
  positive: [
    positive(
      "journal recovery completes both deletions",
      [KnowledgePublicationStage.Journal, 1, true],
      true,
    ),
    positive(
      "journal recovery completes both updates",
      [KnowledgePublicationStage.Journal, 1, false],
      true,
    ),
    positive(
      "first history recovery completes both deletions",
      [KnowledgePublicationStage.History, 1, true],
      true,
    ),
    positive(
      "first history recovery completes both updates",
      [KnowledgePublicationStage.History, 1, false],
      true,
    ),
    positive(
      "second history recovery completes both deletions",
      [KnowledgePublicationStage.History, 2, true],
      true,
    ),
    positive(
      "second history recovery completes both updates",
      [KnowledgePublicationStage.History, 2, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "first file loss cannot expose partial ready state",
      [KnowledgePublicationStage.File, 1, true],
      true,
    ),
    rejected(
      "first file loss cannot expose partial ready state",
      [KnowledgePublicationStage.File, 1, false],
      true,
    ),
    rejected(
      "second file loss cannot lose receipt",
      [KnowledgePublicationStage.File, 2, true],
      true,
    ),
    rejected(
      "second file loss cannot lose receipt",
      [KnowledgePublicationStage.File, 2, false],
      true,
    ),
    rejected(
      "index loss cannot duplicate deletion",
      [KnowledgePublicationStage.Index, 1, true],
      true,
    ),
    rejected(
      "index loss cannot duplicate update",
      [KnowledgePublicationStage.Index, 1, false],
      true,
    ),
    rejected(
      "receipt acknowledgement loss cannot duplicate deletion",
      [KnowledgePublicationStage.Receipt, 1, true],
      true,
    ),
    rejected(
      "receipt acknowledgement loss cannot duplicate update",
      [KnowledgePublicationStage.Receipt, 1, false],
      true,
    ),
  ],
};
export const knowledgeCommitReceiptCases = {
  positive: [
    positive("malformed receipt is typed corruption", [KnowledgeCommitFixture.Receipt], true),
    positive("invalid receipt is typed corruption", [KnowledgeCommitFixture.ReceiptShape], true),
  ],
  negative: [
    rejected("receipt cannot change publication id", [KnowledgeCommitFixture.ReceiptId], true),
    rejected("receipt cannot change entry versions", [KnowledgeCommitFixture.ReceiptChanges], true),
  ],
};
export const knowledgeCommitCorruptionCases = {
  positive: [
    positive(
      "changed digest refuses before readiness",
      [KnowledgeCommitFixture.Digest],
      ErrorCode.KnowledgeCorrupt,
    ),
    positive(
      "changed before text refuses before readiness",
      [KnowledgeCommitFixture.Before],
      ErrorCode.KnowledgeCorrupt,
    ),
  ],
  negative: [
    rejected(
      "duplicate journal entries refuse before readiness",
      [KnowledgeCommitFixture.Duplicate],
      ErrorCode.KnowledgeCorrupt,
    ),
    rejected(
      "changed second file prevents first replacement",
      [KnowledgeCommitFixture.Current],
      ErrorCode.KnowledgeCorrupt,
    ),
    rejected(
      "different durable receipt refuses readiness",
      [KnowledgeCommitFixture.ReceiptCollision],
      ErrorCode.KnowledgeCorrupt,
    ),
  ],
};
