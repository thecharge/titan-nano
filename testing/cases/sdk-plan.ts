import { RunStatus, SdkPlanFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const delivered = {
  unexpectedErrors: [],
  state: RunStatus.Passed,
  companion: RunStatus.Passed,
  artifacts: true,
  companionArtifacts: true,
  independent: true,
  overlap: true,
  accounting: true,
  completed: 8,
  projectPreserved: true,
  verified: true,
};
const blocked = { ...delivered, state: RunStatus.Blocked, artifacts: null };

export const sdkMixedDeliveryCases = {
  positive: [
    positive(
      "two origins deliver eight mixed steps through both SDKs",
      [SdkPlanFixture.Complete, false],
      delivered,
    ),
    positive(
      "reversed graph order and swapped backends retain delivery",
      [SdkPlanFixture.Complete, true],
      delivered,
    ),
  ],
  negative: [
    rejected(
      "parallel file conflict blocks only its originating run",
      [SdkPlanFixture.Conflict, false],
      blocked,
    ),
    rejected(
      "missing ancestor file blocks only its originating run",
      [SdkPlanFixture.MissingInput, true],
      blocked,
    ),
  ],
};

export const sdkMixedRestartCases = {
  positive: [
    positive("mixed restart retains the Claude checker session", [false], true),
    positive("mixed restart retains the Codex checker session", [true], true),
  ],
  negative: [
    rejected("mixed restart rejects an extra quality attempt", [false, "attempt"], true),
    rejected("mixed restart rejects a rerun of a completed peer", [true, "peer"], true),
  ],
};
