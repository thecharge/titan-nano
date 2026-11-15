import { RunOriginMutation } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const runOriginCases = {
  positive: [
    positive("caller origin survives live commits", [RunOriginMutation.None, false], true),
    positive("caller origin survives complete replay", [RunOriginMutation.None, true], true),
    positive("legacy origin survives live commits", [RunOriginMutation.None, false, true], true),
    positive("legacy origin survives replay", [RunOriginMutation.None, true, true], true),
  ],
  negative: [
    rejected("live caller session cannot change", [RunOriginMutation.Session, false], true),
    rejected("replayed caller session cannot change", [RunOriginMutation.Session, true], true),
    rejected("live caller client cannot change", [RunOriginMutation.Client, false], true),
    rejected("replayed caller client cannot change", [RunOriginMutation.Client, true], true),
    rejected("live submission cannot change", [RunOriginMutation.Submission, false], true),
    rejected("replayed submission cannot change", [RunOriginMutation.Submission, true], true),
    rejected(
      "live caller metadata cannot be removed by downgrade",
      [RunOriginMutation.Downgrade, false],
      true,
    ),
    rejected(
      "replayed caller metadata cannot be removed by downgrade",
      [RunOriginMutation.Downgrade, true],
      true,
    ),
    rejected(
      "legacy live run cannot acquire caller metadata",
      [RunOriginMutation.Session, false, true],
      true,
    ),
    rejected(
      "legacy replay cannot acquire caller metadata",
      [RunOriginMutation.Session, true, true],
      true,
    ),
  ],
};
