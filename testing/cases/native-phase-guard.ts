import { NativePhaseFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const nativePhaseGuardCases = {
  positive: [
    positive(
      "late event from a closed execution cannot enter the journal",
      [NativePhaseFixture.LateEvent, false],
      true,
    ),
    positive(
      "worker and checker revoke before successful publication",
      [NativePhaseFixture.Clean, false],
      true,
    ),
    positive(
      "resumed worker retains logical attempt and receives a fresh binding",
      [NativePhaseFixture.Clean, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "raw Codex native result is scanned before projection",
      [NativePhaseFixture.CodexResult, false],
      true,
    ),
    rejected(
      "raw Claude native result is scanned before projection",
      [NativePhaseFixture.ClaudeResult, false],
      true,
    ),
    rejected(
      "credential in worker content cannot enter checkpoint",
      [NativePhaseFixture.Content, false],
      true,
    ),
    rejected(
      "credential in filename cannot enter checkpoint",
      [NativePhaseFixture.Filename, false],
      true,
    ),
    rejected(
      "credential across file chunks cannot enter checkpoint",
      [NativePhaseFixture.Boundary, false],
      true,
    ),
    rejected("credential in event cannot enter journal", [NativePhaseFixture.Event, false], true),
    rejected("credential in answer cannot enter journal", [NativePhaseFixture.Answer, false], true),
    rejected(
      "credential in native identity cannot enter journal",
      [NativePhaseFixture.Session, false],
      true,
    ),
    rejected(
      "credential in backend error becomes a safe failure",
      [NativePhaseFixture.Error, false],
      true,
    ),
    rejected(
      "credential in session close failure becomes a safe failure",
      [NativePhaseFixture.Close, false],
      true,
    ),
    rejected(
      "backend start failure still revokes binding",
      [NativePhaseFixture.Start, false],
      true,
    ),
    rejected(
      "backend resume failure still revokes fresh binding",
      [NativePhaseFixture.Resume, true],
      true,
    ),
    rejected(
      "owner close failure cannot disclose its credential",
      [NativePhaseFixture.OwnerClose, false],
      true,
    ),
  ],
};
