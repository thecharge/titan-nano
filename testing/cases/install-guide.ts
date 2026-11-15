import { negative, positive } from "@titan/test-factories";

const AssertionFailure = { code: "ERR_ASSERTION" };

export const installGuideCases = {
  positive: [
    positive("every command in docs/install.md is in the command list", [null], true),
    positive("a known command resolves", ["Run `titan doctor`."], true),
  ],
  negative: [
    negative("an unknown command is refused", ["Run `titan nonsense`."], AssertionFailure),
    negative("a page without commands is refused", ["Nothing here."], AssertionFailure),
  ],
};
