import { ErrorCode, KnowledgeCommitFixture, KnowledgeKind } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const knowledgePublicationSettingsCases = {
  positive: [
    positive("legacy settings gain no publication defaults", [{}], true),
    positive(
      "owner may lower publication budgets",
      [{ max_publication_entries: 2, max_publication_bytes: 4096, max_publication_receipts: 2 }],
      true,
    ),
  ],
  negative: [
    rejected("owner cannot raise hard set count", [{ max_publication_entries: 33 }], false),
    rejected("owner cannot raise receipt count", [{ max_publication_receipts: 10001 }], false),
    rejected("zero journal bytes are refused", [{ max_publication_bytes: 0 }], false),
    rejected("fractional entry allowance is refused", [{ max_publication_entries: 1.5 }], false),
  ],
};
export const knowledgeCommitVersionCases = {
  positive: [
    positive(
      "last safe version can be committed",
      [Number.MAX_SAFE_INTEGER - 1, false, KnowledgeKind.Fact],
      null,
    ),
    positive(
      "last safe version can be deleted",
      [Number.MAX_SAFE_INTEGER, true, KnowledgeKind.Lesson],
      null,
    ),
  ],
  negative: [
    rejected(
      "version overflow cannot replace an entry",
      [Number.MAX_SAFE_INTEGER, false, KnowledgeKind.Fact],
      ErrorCode.KnowledgeInvalid,
    ),
    rejected(
      "version overflow cannot replace a lesson",
      [Number.MAX_SAFE_INTEGER, false, KnowledgeKind.Lesson],
      ErrorCode.KnowledgeInvalid,
    ),
  ],
};
export const knowledgeCommitReceiptBoundaryCases = {
  positive: [
    positive(
      "non-file receipt member refuses publication",
      [KnowledgeCommitFixture.Directory],
      true,
    ),
    positive(
      "receipt directory link refuses publication",
      [KnowledgeCommitFixture.LinkedDirectory],
      true,
    ),
  ],
  negative: [
    rejected("receipt file link cannot be followed", [KnowledgeCommitFixture.LinkedReceipt], true),
    rejected("shared receipt file cannot be trusted", [KnowledgeCommitFixture.SharedReceipt], true),
  ],
};
export const knowledgeCommitSnapshotCases = {
  positive: [
    positive("queued fact search sees complete set", [KnowledgeKind.Fact, false], true),
    positive("queued lesson search sees complete set", [KnowledgeKind.Lesson, false], true),
  ],
  negative: [
    rejected("interrupted fact search cannot see partial set", [KnowledgeKind.Fact, true], true),
    rejected(
      "interrupted lesson search cannot see partial set",
      [KnowledgeKind.Lesson, true],
      true,
    ),
  ],
};
