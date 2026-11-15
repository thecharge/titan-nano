import {
  LeanCaseFile,
  LeanCheck,
  LeanCheckCase,
  LeanCheckFixture,
  LeanLimitMode,
  ProofAnswer,
} from "@titan/constants";
import { leanTimeLimit } from "@titan/messages";
import { positive, rejected } from "@titan/test-factories";

const last = (file: LeanCaseFile) => LeanCheckFixture.Evidence[file].lines.at(-1);
const compare = LeanCheck.Compare.join(LeanCheck.CommandSeparator);
const paranoid = [...LeanCheck.Compare, LeanCheck.Paranoid].join(LeanCheck.CommandSeparator);
const cheat = (file: LeanCaseFile) => [ProofAnswer.NotProven, last(file), compare];

export const leanAnswerCases = {
  positive: [
    positive(
      LeanCheckCase.Good,
      [LeanCaseFile.Good, false],
      [ProofAnswer.Proven, LeanCheck.Okay, compare],
    ),
    positive(
      LeanCheckCase.GoodParanoid,
      [LeanCaseFile.Good, true],
      [ProofAnswer.Proven, LeanCheck.Okay, paranoid],
    ),
  ],
  negative: [
    rejected(LeanCheckCase.Sorry, [LeanCaseFile.Sorry, false], cheat(LeanCaseFile.Sorry)),
    rejected(LeanCheckCase.Weakened, [LeanCaseFile.Weakened, false], cheat(LeanCaseFile.Weakened)),
    rejected(
      LeanCheckCase.Redefined,
      [LeanCaseFile.Redefined, false],
      cheat(LeanCaseFile.Redefined),
    ),
    rejected(LeanCheckCase.Axiom, [LeanCaseFile.Axiom, false], cheat(LeanCaseFile.Axiom)),
    rejected(LeanCheckCase.Native, [LeanCaseFile.Native, false], cheat(LeanCaseFile.Native)),
  ],
};

export const leanFolderCases = {
  positive: [
    positive(
      LeanCheckCase.OneTheorem,
      [[LeanCheckFixture.Theorem]],
      [LeanCheck.Toolchain, LeanCheckFixture.Theorem, true],
    ),
    positive(
      LeanCheckCase.TwoTheorems,
      [[LeanCheckFixture.Theorem, LeanCheckFixture.SecondTheorem]],
      [
        LeanCheck.Toolchain,
        [LeanCheckFixture.Theorem, LeanCheckFixture.SecondTheorem].join(
          LeanCheck.EvidenceSeparator,
        ),
        true,
      ],
    ),
  ],
  negative: [
    rejected(LeanCheckCase.NoTheorems, [[]], LeanCheckFixture.Rejected),
    rejected(LeanCheckCase.BlankTheorem, [[LeanCheckFixture.Empty]], LeanCheckFixture.Rejected),
  ],
};

export const leanLimitCases = {
  positive: [
    positive(
      LeanCheckCase.QuickFive,
      [LeanLimitMode.Quick, LeanCheckFixture.LimitSeconds],
      [ProofAnswer.Proven, LeanCheck.Okay, LeanCheckFixture.SpawnedTwice],
    ),
    positive(
      LeanCheckCase.QuickMinute,
      [LeanLimitMode.Quick, LeanCheck.DefaultSeconds],
      [ProofAnswer.Proven, LeanCheck.Okay, LeanCheckFixture.SpawnedTwice],
    ),
  ],
  negative: [
    rejected(
      LeanCheckCase.ThrownFive,
      [LeanLimitMode.Thrown, LeanCheckFixture.LimitSeconds],
      [
        ProofAnswer.NotProven,
        leanTimeLimit(LeanCheckFixture.LimitSeconds),
        LeanCheckFixture.SpawnedNever,
      ],
    ),
    rejected(
      LeanCheckCase.HangingShort,
      [LeanLimitMode.Hanging, LeanCheckFixture.ShortSeconds],
      [
        ProofAnswer.NotProven,
        leanTimeLimit(LeanCheckFixture.ShortSeconds),
        LeanCheckFixture.SpawnedOnce,
      ],
    ),
    rejected(
      LeanCheckCase.AbortedFive,
      [LeanLimitMode.Aborted, LeanCheckFixture.LimitSeconds],
      [LeanCheckFixture.Rethrown, LeanCheckFixture.Empty, LeanCheckFixture.SpawnedNever],
    ),
  ],
};
