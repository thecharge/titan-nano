import { NativeAuditFixture, NativeToolRole } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const nativeFileAccessCases = {
  positive: [
    positive(
      "worker Read authority can observe a missing file",
      [NativeAuditFixture.Valid, true, true, true],
      true,
    ),
    positive(
      "checker Read authority can observe a missing file",
      [NativeAuditFixture.Valid, false, true, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "worker without Read cannot acquire managed file data",
      [NativeAuditFixture.NoRead, true, true, true],
      true,
    ),
    rejected(
      "checker without Read cannot acquire managed file data",
      [NativeAuditFixture.NoRead, false, true, true],
      true,
    ),
    rejected(
      "worker without an admitted workspace cannot read",
      [NativeAuditFixture.NoWorkspace, true, true, true],
      true,
    ),
    rejected(
      "checker without an admitted workspace cannot read",
      [NativeAuditFixture.NoWorkspace, false, true, true],
      true,
    ),
    rejected(
      "crossed execution cannot acquire managed file data",
      [NativeAuditFixture.Execution, true, true, true],
      true,
    ),
    rejected(
      "managed read rejects path traversal",
      [NativeAuditFixture.UnsafePath, false, true, true],
      true,
    ),
  ],
};

export const nativeFileAuditCases = {
  positive: [
    positive(
      "worker read metadata is retained in its phase",
      [NativeAuditFixture.Valid, true, true],
      true,
    ),
    positive(
      "checker read metadata is retained in its phase",
      [NativeAuditFixture.Valid, false, true],
      true,
    ),
    positive(
      "duplicate worker read remains valid at capacity",
      [NativeAuditFixture.DuplicateRead, true, true],
      true,
    ),
    positive(
      "duplicate checker read remains valid at capacity",
      [NativeAuditFixture.DuplicateRead, false, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "new worker observation is refused at capacity",
      [NativeAuditFixture.Capacity, true, true],
      true,
    ),
    rejected(
      "new checker observation is refused at capacity",
      [NativeAuditFixture.Capacity, false, true],
      true,
    ),
    rejected(
      "failed worker audit restores its prior observations",
      [NativeAuditFixture.AuditWrite, true, true],
      true,
    ),
    rejected(
      "failed checker audit restores its prior observations",
      [NativeAuditFixture.AuditWrite, false, true],
      true,
    ),
  ],
};

export const nativeAuditMetadataCases = {
  positive: [
    positive(
      "worker search is acknowledged after metadata is committed",
      [NativeToolRole.Worker, false],
      true,
    ),
    positive(
      "checker search is acknowledged after metadata is committed",
      [NativeToolRole.Checker, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "worker audit failure poisons its lease without exposing details",
      [NativeToolRole.Worker, true],
      true,
    ),
    rejected(
      "checker audit failure poisons its lease without exposing details",
      [NativeToolRole.Checker, true],
      true,
    ),
  ],
};

export const nativeAuditRefusalCases = {
  positive: [
    positive(
      "worker missing entry records a metadata refusal",
      [NativeToolRole.Worker, false],
      true,
    ),
    positive(
      "checker missing entry records a metadata refusal",
      [NativeToolRole.Checker, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "worker unknown tool name cannot enter the audit",
      [NativeToolRole.Worker, true],
      true,
    ),
    rejected(
      "checker unknown tool name cannot enter the audit",
      [NativeToolRole.Checker, true],
      true,
    ),
  ],
};

export const nativeAuditScopeCases = {
  positive: [
    positive(
      "worker board metadata owns its persona and two entry ids",
      [NativeAuditFixture.Valid, true],
      true,
    ),
    positive(
      "checker board metadata owns its persona and two entry ids",
      [NativeAuditFixture.Valid, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "worker cannot claim another candidate generation",
      [NativeAuditFixture.Candidate, true],
      true,
    ),
    rejected(
      "checker cannot claim another candidate generation",
      [NativeAuditFixture.Candidate, false],
      true,
    ),
    rejected(
      "old worker candidate cannot append to a reconciliation",
      [NativeAuditFixture.Generation, true],
      true,
    ),
    rejected(
      "old checker candidate cannot append to a reconciliation",
      [NativeAuditFixture.Generation, false],
      true,
    ),
    rejected(
      "obsolete execution cannot append metadata",
      [NativeAuditFixture.Execution, true],
      true,
    ),
    rejected("forged attempt cannot append metadata", [NativeAuditFixture.Attempt, false], true),
    rejected("worker cannot claim checker metadata", [NativeAuditFixture.Role, true], true),
    rejected(
      "completed checker cannot append metadata",
      [NativeAuditFixture.Completed, false],
      true,
    ),
    rejected("private tool result cannot enter metadata", [NativeAuditFixture.Extra, true], true),
    rejected(
      "refused call cannot claim returned entry ids",
      [NativeAuditFixture.Outcome, false],
      true,
    ),
  ],
};

export const nativeAuditCompletionCases = {
  positive: [
    positive("audited worker may publish its checked artifact and knowledge", [true, false], true),
    positive(
      "audited checker may publish its checked artifact and knowledge",
      [false, false],
      true,
    ),
  ],
  negative: [
    rejected("worker cannot ignore audit failure and publish", [true, true], true),
    rejected("checker cannot ignore audit failure and publish", [false, true], true),
  ],
};

export const nativeAuditProtocolCases = {
  positive: [
    positive(
      "worker invalid tool arguments retain refusal metadata",
      [NativeToolRole.Worker, false],
      true,
    ),
    positive(
      "checker invalid tool arguments retain refusal metadata",
      [NativeToolRole.Checker, false],
      true,
    ),
  ],
  negative: [
    rejected("worker malformed JSON retains protocol refusal", [NativeToolRole.Worker, true], true),
    rejected(
      "checker malformed JSON retains protocol refusal",
      [NativeToolRole.Checker, true],
      true,
    ),
  ],
};

export const nativeSplitAuditCases = {
  positive: [
    positive(
      "split worker metadata retains its worker identity",
      [NativeAuditFixture.Valid, true, false, false, true],
      true,
    ),
    positive(
      "split worker managed read retains its worker authority",
      [NativeAuditFixture.Valid, true, true, true, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "split worker cannot claim checker authority",
      [NativeAuditFixture.Role, true, false, false, true],
      true,
    ),
    rejected(
      "split worker without Read cannot acquire file data",
      [NativeAuditFixture.NoRead, true, true, true, true],
      true,
    ),
    rejected(
      "completed split worker cannot append metadata",
      [NativeAuditFixture.Completed, true, false, false, true],
      true,
    ),
  ],
};

export const nativeSplitCompletionCases = {
  positive: [
    positive("split workers publish jointly after native worker audits", [true, false, true], true),
    positive("split aggregate publishes after native checker audits", [false, false, true], true),
  ],
  negative: [
    rejected("failed split worker audit cannot publish any proposal", [true, true, true], true),
    rejected(
      "failed aggregate checker audit cannot publish part proposals",
      [false, true, true],
      true,
    ),
  ],
};
