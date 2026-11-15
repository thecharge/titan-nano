import {
  HookFile,
  OfflineSelectionLimit,
  OfflineSelectorFixture,
  OfflineSelectorFixtureMode,
  TestLayout,
} from "@titan/constants";
import { OfflineMessage } from "@titan/messages";
import { negative, positive, rejected } from "@titan/test-factories";

const first = HookFile.RelativePrefix + OfflineSelectorFixture.First;
const second = HookFile.RelativePrefix + OfflineSelectorFixture.Second;
const integration = HookFile.RelativePrefix + OfflineSelectorFixture.Integration;
const endToEnd = HookFile.RelativePrefix + OfflineSelectorFixture.EndToEnd;
const invalid = { message: OfflineMessage.Selection };

export const offlineSelectionCases = {
  positive: [
    positive(
      "one exact test keeps its complete name",
      [OfflineSelectorFixtureMode.Normal, [OfflineSelectorFixture.First]],
      [first],
    ),
    positive(
      "a tier expands into exact test paths",
      [OfflineSelectorFixtureMode.Normal, [TestLayout.TierDirectories[0]]],
      [first, second],
    ),
    positive(
      "default selection includes every named tier",
      [OfflineSelectorFixtureMode.Normal, []],
      [first, second, integration, endToEnd],
    ),
    positive(
      "overlapping selectors retain each test once",
      [
        OfflineSelectorFixtureMode.Normal,
        [OfflineSelectorFixture.First, TestLayout.TierDirectories[0]],
      ],
      [first, second],
    ),
  ],
  negative: [
    negative(
      "a missing path cannot disappear beside a valid test",
      [
        OfflineSelectorFixtureMode.Normal,
        [OfflineSelectorFixture.First, OfflineSelectorFixture.Missing],
      ],
      invalid,
    ),
    negative(
      "a missing-only selection cannot run another test",
      [OfflineSelectorFixtureMode.Normal, [OfflineSelectorFixture.Missing]],
      invalid,
    ),
    negative(
      "non-test files are refused",
      [OfflineSelectorFixtureMode.Normal, [OfflineSelectorFixture.NonTest]],
      invalid,
    ),
    negative(
      "outside-tier tests are refused",
      [OfflineSelectorFixtureMode.Normal, [OfflineSelectorFixture.Outside]],
      invalid,
    ),
    negative("an empty default inventory fails", [OfflineSelectorFixtureMode.Empty, []], invalid),
    negative(
      "a link outside named tiers fails",
      [OfflineSelectorFixtureMode.ExternalLink, []],
      invalid,
    ),
    negative(
      "a link within named tiers also fails",
      [OfflineSelectorFixtureMode.InternalLink, []],
      invalid,
    ),
    negative(
      "a symbolic directory cannot hide tests",
      [OfflineSelectorFixtureMode.DirectoryLink, []],
      invalid,
    ),
    negative(
      "a dangling test link fails discovery",
      [OfflineSelectorFixtureMode.DanglingLink, []],
      invalid,
    ),
    negative(
      "argument exhaustion fails before discovery",
      [
        OfflineSelectorFixtureMode.Normal,
        [OfflineSelectorFixture.First, OfflineSelectorFixture.Second],
        { max_arguments: 1 },
      ],
      invalid,
    ),
    negative(
      "file exhaustion cannot omit the remaining tests",
      [OfflineSelectorFixtureMode.Normal, [], { max_files: 1 }],
      invalid,
    ),
    negative(
      "entry exhaustion cannot report partial selection",
      [OfflineSelectorFixtureMode.Normal, [], { max_entries: 1 }],
      invalid,
    ),
    negative(
      "zero inventory budget is invalid",
      [OfflineSelectorFixtureMode.Normal, [], { max_files: 0 }],
      { name: "ZodError" },
    ),
    negative(
      "enlarged inventory budget is invalid",
      [OfflineSelectorFixtureMode.Normal, [], { max_entries: OfflineSelectionLimit.Entries + 1 }],
      { name: "ZodError" },
    ),
  ],
};

export const offlineSelectionProcessCases = {
  positive: [
    positive("an exact file reaches its test child", [[OfflineSelectorFixture.First], true], true),
    positive("a tier reaches its test children", [[TestLayout.TierDirectories[0]], true], true),
  ],
  negative: [
    rejected(
      "a mixed missing selection launches no test child",
      [[OfflineSelectorFixture.First, OfflineSelectorFixture.Missing], false],
      true,
    ),
    rejected(
      "a missing-only selection launches no test child",
      [[OfflineSelectorFixture.Missing], false],
      true,
    ),
  ],
};

export const offlineDriverOutputCases = {
  positive: [
    positive("complete standard output survives driver shutdown", [false, false], true),
    positive("complete diagnostic output survives driver shutdown", [true, false], true),
  ],
  negative: [
    rejected("a failed child preserves standard output", [false, true], true),
    rejected("a failed child preserves diagnostic output", [true, true], true),
  ],
};
