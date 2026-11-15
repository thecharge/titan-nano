import {
  ConfigSource,
  ErrorCode,
  SubmissionReceipt,
  SubmissionReceiptFixture,
} from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";
export const submissionReceiptCases = {
  positive: [
    positive(
      "generated caller survives a reopened ledger",
      [SubmissionReceiptFixture.Generated],
      true,
    ),
    positive(
      "explicit caller retries at the receipt limit",
      [SubmissionReceiptFixture.Explicit],
      true,
    ),
    positive(
      "independent callers can share a submission id",
      [SubmissionReceiptFixture.Independent],
      true,
    ),
    positive(
      "racing callers reserve one generated caller",
      [SubmissionReceiptFixture.Concurrent],
      true,
    ),
  ],
  negative: [
    rejected("damaged ledger refuses submission", [SubmissionReceiptFixture.Damaged], true),
    rejected(
      "directory at ledger path refuses submission",
      [SubmissionReceiptFixture.Directory],
      true,
    ),
    rejected(
      "changed input retains the original identity",
      [SubmissionReceiptFixture.Conflict],
      true,
    ),
    rejected(
      "ambiguous submission requires its caller",
      [SubmissionReceiptFixture.Ambiguous],
      true,
    ),
    rejected(
      "full ledger refuses new ids and permits retry",
      [SubmissionReceiptFixture.Full],
      true,
    ),
    rejected("invalid identity creates no ledger", [SubmissionReceiptFixture.Invalid], true),
  ],
};
export const cliSubmissionReceiptCases = {
  positive: [
    positive("generated ids commit before posting", [false, false], true),
    positive("explicit ids commit before posting", [true, false], true),
  ],
  negative: [
    rejected("lost acknowledgement recovers generated caller", [false, true], true),
    rejected("lost acknowledgement recovers explicit caller", [true, true], true),
  ],
};

export const clientReceiptConfigCases = {
  positive: [
    positive(
      "built-in default preserves older frozen schemas",
      [ConfigSource.BuiltIn, 1],
      SubmissionReceipt.Maximum,
    ),
    positive("home owner can lower the receipt budget", [ConfigSource.User, 1], 1),
    positive(
      "home owner can select the receipt ceiling",
      [ConfigSource.User, SubmissionReceipt.Maximum],
      SubmissionReceipt.Maximum,
    ),
  ],
  negative: [
    negative("project cannot set client receipt budget", [ConfigSource.Project, 1], {
      code: ErrorCode.OwnerSetting,
    }),
    negative("workflow cannot set client receipt budget", [ConfigSource.Workflow, 1], {
      code: ErrorCode.OwnerSetting,
    }),
    negative("CLI override cannot set client receipt budget", [ConfigSource.Cli, 1], {
      code: ErrorCode.OwnerSetting,
    }),
    negative("receipt budget must be positive", [ConfigSource.User, 0], {
      code: ErrorCode.InvalidConfig,
    }),
    negative(
      "receipt budget cannot exceed the ceiling",
      [ConfigSource.User, SubmissionReceipt.Maximum + 1],
      { code: ErrorCode.InvalidConfig },
    ),
  ],
};
