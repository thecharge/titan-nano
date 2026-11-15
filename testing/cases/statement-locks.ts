import {
  ApprovalLevel,
  ErrorCode,
  ProofAnswer,
  RunStatus,
  StatementFixture,
  StatementLock,
  StatementTesting,
  StepStatus,
} from "@titan/constants";
import { RunnerMessage } from "@titan/messages";
import { negative, positive, rejected } from "@titan/test-factories";

const open = {
  started: StatementTesting.Starts,
  run: RunStatus.Waiting,
  step: StepStatus.Waiting,
  requests: StatementTesting.RequestCount,
  level: ApprovalLevel.Human,
  resource: StatementTesting.StepId,
  textMatches: true,
  hashMatches: true,
};
const refused = {
  started: StatementTesting.Starts,
  step: StepStatus.Blocked,
  locked: false,
};
const changed = { answer: ProofAnswer.NotProven, evidence: RunnerMessage.StatementChanged };

export const statementLockCases = {
  positive: [
    positive(
      "a lean step opens one human request with its text and hash",
      [StatementFixture.Waiting],
      open,
    ),
    positive("a goal statement opens a request that names scope goal", [StatementFixture.Goal], {
      ...open,
      resource: StatementLock.Goal,
    }),
    positive("executable statement text remains readable", [StatementFixture.Executable], open),
    positive("a long statement is carried whole in the request", [StatementFixture.Long], open),
    positive("a second pass keeps one request and starts no agent", [StatementFixture.Twice], open),
    positive(
      "an approved step statement blocks before work without a formal checker",
      [StatementFixture.Approved],
      {
        run: RunStatus.Blocked,
        started: false,
        copyMatches: true,
        hashOnBoard: true,
        readOnly: true,
      },
    ),
    positive("a denied request blocks the step without a copy", [StatementFixture.Denied], refused),
    positive("a statement edited after approval is not locked", [StatementFixture.Edited], refused),
    positive("a changed locked file is not proven", [StatementFixture.Changed], changed),
    positive("a deleted locked file is not proven", [StatementFixture.Deleted], changed),
    positive("an untouched locked file gives no answer", [StatementFixture.Unchanged], null),
  ],
  negative: [
    rejected(
      "an approved goal statement blocks before work without a formal checker",
      [StatementFixture.ApprovedGoal],
      {
        run: RunStatus.Blocked,
        started: false,
        copyMatches: true,
        hashOnBoard: true,
        readOnly: true,
      },
    ),
    rejected(
      "a linked lock directory cannot redirect publication",
      [StatementFixture.LockedParent],
      true,
    ),
    rejected("a linked statement is refused before disclosure", [StatementFixture.Linked], {
      started: 0,
      requests: 0,
      step: StepStatus.Blocked,
    }),
    rejected(
      "a linked statement parent is refused before disclosure",
      [StatementFixture.LinkedParent],
      {
        started: 0,
        requests: 0,
        step: StepStatus.Blocked,
      },
    ),
    rejected("an oversized statement is refused before disclosure", [StatementFixture.Oversized], {
      started: 0,
      requests: 0,
      step: StepStatus.Blocked,
    }),
    rejected(
      "a linked retained statement is not accepted",
      [StatementFixture.ChangedLink],
      changed,
    ),
    negative("the main agent cannot approve a human request", [StatementFixture.Lowered], {
      code: ErrorCode.PermissionDenied,
    }),
    negative("an answered request cannot be answered again", [StatementFixture.Repeated], {
      code: ErrorCode.RequestConflict,
    }),
  ],
};

export const statementAdmissionCases = {
  positive: [
    positive(
      "a project step statement reaches engine creation",
      [StatementTesting.Path, false],
      true,
    ),
    positive(
      "a project goal statement reaches engine creation",
      [StatementTesting.Path, true],
      true,
    ),
  ],
  negative: [
    negative("a step statement cannot escape its project", ["../outside.lean", false], {
      code: ErrorCode.UnsafePath,
    }),
    negative("a goal statement cannot name an absolute outside path", ["absolute", true], {
      code: ErrorCode.UnsafePath,
    }),
    negative(
      "a goal statement cannot follow an outside link",
      [StatementTesting.Path, true, true],
      { code: ErrorCode.UnsafeSymlink },
    ),
  ],
};
