import { ApprovalPolicyFixture, ErrorCode } from "@titan/constants";
import { negative, positive } from "@titan/test-factories";

export const approvalPolicyCases = {
  positive: [
    positive(
      "all default kinds are visible in effective config",
      [ApprovalPolicyFixture.Defaults],
      true,
    ),
    positive("home owner raises a configurable kind", [ApprovalPolicyFixture.OwnerRaise], true),
    positive("home owner lowers a configurable kind", [ApprovalPolicyFixture.OwnerLower], true),
    positive("workflow raises the default", [ApprovalPolicyFixture.WorkflowRaise], true),
    positive("workflow raises an owner override", [ApprovalPolicyFixture.WorkflowInherited], true),
    positive("project raises the inherited policy", [ApprovalPolicyFixture.ProjectRaise], true),
    positive("CLI assignment raises through the registry", [ApprovalPolicyFixture.CliRaise], true),
  ],
  negative: [
    negative("workflow cannot lower a level", [ApprovalPolicyFixture.WorkflowLower], {
      code: ErrorCode.InvalidConfig,
    }),
    negative("project cannot lower an owner choice", [ApprovalPolicyFixture.ProjectLower], {
      code: ErrorCode.InvalidConfig,
    }),
    negative("selected file cannot lower an owner choice", [ApprovalPolicyFixture.ExplicitLower], {
      code: ErrorCode.InvalidConfig,
    }),
    negative("CLI cannot lower a level", [ApprovalPolicyFixture.CliLower], {
      code: ErrorCode.InvalidConfig,
    }),
    negative("external actions remain human", [ApprovalPolicyFixture.FixedAction], {
      code: ErrorCode.InvalidConfig,
    }),
    negative("paid compute remains human", [ApprovalPolicyFixture.FixedPaid], {
      code: ErrorCode.InvalidConfig,
    }),
    negative("persona deletion remains human", [ApprovalPolicyFixture.FixedDelete], {
      code: ErrorCode.InvalidConfig,
    }),
    negative("limit increases remain human", [ApprovalPolicyFixture.FixedLimit], {
      code: ErrorCode.InvalidConfig,
    }),
    negative("unknown request kind is refused", [ApprovalPolicyFixture.Unknown], {
      code: ErrorCode.InvalidConfig,
    }),
    negative("unknown authority is refused", [ApprovalPolicyFixture.Invalid], {
      code: ErrorCode.InvalidConfig,
    }),
  ],
};
export const approvalPolicyReplayCases = {
  positive: [
    positive("owner's lowered policy survives reload", [ApprovalPolicyFixture.LoweredReplay], true),
    positive(
      "raised policy enforces authority after reload",
      [ApprovalPolicyFixture.RaisedReplay],
      true,
    ),
    positive(
      "legacy config keeps its hash and default policy",
      [ApprovalPolicyFixture.Legacy],
      true,
    ),
  ],
  negative: [
    negative(
      "changed frozen policy cannot reinterpret history",
      [ApprovalPolicyFixture.ChangedPolicy],
      { code: ErrorCode.CorruptBoard },
    ),
    negative("forged request level is refused on replay", [ApprovalPolicyFixture.ForgedLevel], {
      code: ErrorCode.CorruptBoard,
    }),
  ],
};

export const approvalPolicyCliCases = {
  positive: [
    positive("CLI check admits the default policy", [ApprovalPolicyFixture.Defaults, true], true),
    positive(
      "CLI check admits a raised workflow policy",
      [ApprovalPolicyFixture.WorkflowRaise, true],
      true,
    ),
  ],
  negative: [
    negative(
      "CLI check refuses lower tool server authority",
      [ApprovalPolicyFixture.WorkflowServerLower, true],
      { code: ErrorCode.InvalidConfig },
    ),
    negative(
      "CLI check refuses lower fixed home authority",
      [ApprovalPolicyFixture.FixedAction, true],
      { code: ErrorCode.InvalidConfig },
    ),
  ],
};
