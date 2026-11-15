import { positive, rejected } from "@titan/test-factories";

export const nativeReadGrantCases = {
  positive: [
    positive("approved worker read reaches managed files", [true, "approved"], true),
    positive("approved checker read reaches managed files", [false, "approved"], true),
  ],
  negative: [
    rejected("denied worker read remains unavailable", [true, "denied"], true),
    rejected("denied checker read remains unavailable", [false, "denied"], true),
    rejected("a different tool cannot authorize file reads", [true, "other-tool"], true),
    rejected(
      "an earlier request turn cannot authorize the current read",
      [false, "other-turn"],
      true,
    ),
  ],
};
