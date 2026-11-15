import {
  ErrorCode,
  RunFormat,
  RuntimePinFixture,
  RuntimePinMutation,
  TitanRelease,
} from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const runtimePinCases = {
  positive: [
    positive(
      "pinned commits retain the installed release",
      [RuntimePinMutation.None, false, false],
      true,
    ),
    positive(
      "pinned replay retains caller and release",
      [RuntimePinMutation.None, true, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "an unlabelled initial record requires a release pin",
      [RuntimePinMutation.Missing, true, false, true],
      true,
    ),
    rejected(
      "a labelled initial record requires a release pin",
      [RuntimePinMutation.Missing, true, true, true],
      true,
    ),
    rejected(
      "another release cannot be appended",
      [RuntimePinMutation.Release, false, false],
      true,
    ),
    rejected("another release cannot be recovered", [RuntimePinMutation.Release, true, true], true),
    rejected(
      "a pinned append cannot omit the release",
      [RuntimePinMutation.Missing, false, false],
      true,
    ),
    rejected(
      "a pinned replay cannot omit the release",
      [RuntimePinMutation.Missing, true, true],
      true,
    ),
    rejected(
      "a live run cannot discard its runtime pin",
      [RuntimePinMutation.Downgrade, false, false],
      true,
    ),
    rejected(
      "replay cannot discard its runtime pin",
      [RuntimePinMutation.Downgrade, true, false],
      true,
    ),
    rejected("an empty release cannot be appended", [RuntimePinMutation.Empty, false, false], true),
    rejected("an empty release cannot be replayed", [RuntimePinMutation.Empty, true, true], true),
  ],
};

export const runtimePinProcessCases = {
  positive: [
    positive(
      "installed release restarts an unlabelled pinned run",
      [false, TitanRelease, null],
      true,
    ),
    positive(
      "installed release restarts a caller-labelled pinned run",
      [true, TitanRelease, null],
      true,
    ),
  ],
  negative: [
    rejected(
      "installed reader refuses an unlabelled first record without a pin",
      [false, null, ErrorCode.CorruptBoard],
      true,
    ),
    rejected(
      "installed reader refuses a labelled first record without a pin",
      [true, null, ErrorCode.CorruptBoard],
      true,
    ),
    rejected(
      "another release cannot recover an unlabelled run",
      [false, RuntimePinFixture.OtherRelease, ErrorCode.UnsupportedRunRuntime],
      true,
    ),
    rejected(
      "another release cannot recover a caller-labelled run",
      [true, RuntimePinFixture.OtherRelease, ErrorCode.UnsupportedRunRuntime],
      true,
    ),
  ],
};

export const legacyPinSchemaCases = {
  positive: [
    positive("legacy unlabelled records remain valid", [RunFormat.Legacy, false], true),
    positive("legacy labelled records remain valid", [RunFormat.CallerSessions, true], true),
  ],
  negative: [
    rejected("legacy format cannot acquire a caller label", [RunFormat.Legacy, true], false),
    rejected(
      "caller-labelled format cannot omit its caller",
      [RunFormat.CallerSessions, false],
      false,
    ),
  ],
};

export const runtimeBuildPinCases = {
  positive: [
    positive("the creating build reads its run", ["matching"], true),
    positive("read-only compatibility inspection can inspect a different build", ["inspect"], true),
  ],
  negative: [
    rejected("another build cannot recover the run", ["different"], true),
    rejected("a source engine cannot recover a build-pinned run", ["unavailable"], true),
    rejected("a journal cannot change its creating build", ["changed"], true),
  ],
};
