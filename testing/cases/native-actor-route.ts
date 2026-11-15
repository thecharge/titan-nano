import { ApprovalLevel } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const nativeActorRouteCases = {
  positive: [
    positive("ordinary agent credential retains health access", [ApprovalLevel.Main, false], true),
    positive("person credential retains health access", [ApprovalLevel.Human, false], true),
  ],
  negative: [
    rejected(
      "ordinary agent credential grants no execution tool role",
      [ApprovalLevel.Main, true],
      true,
    ),
    rejected("person credential grants no execution tool role", [ApprovalLevel.Human, true], true),
  ],
};
