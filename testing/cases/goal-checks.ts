import { positive, rejected } from "@titan/test-factories";

export const goalScriptCheckCases = {
  positive: [
    positive("kept step proofs and final goal proof share the final counts", [0, 0, "mixed"], true),
    positive("final goal proof gates successful delivery", [0, 0, "normal"], true),
    positive("goal proof capture survives approval and restart", [0, 0, "restart"], true),
    positive("legacy binary goal captures survive restart", [0, 0, "legacy-binary"], true),
    positive("legacy text goal captures survive restart", [0, 0, "legacy-text"], true),
  ],
  negative: [
    rejected("nested retained captures refuse goal replay", [0, 0, "capture-nested"], true),
    rejected("changed retained exit code refuses goal replay", [0, 0, "capture-exit"], true),
    rejected(
      "goal state cannot be written under an older run format",
      [0, 0, "corrupt-format"],
      true,
    ),
    rejected("goal state cannot redirect checks outside the project", [0, 0, "corrupt-path"], true),
    rejected(
      "a failed final goal retains three proven step checks out of four",
      [1, 1, "mixed"],
      true,
    ),
    rejected("failed goal proof fails a run with passed steps", [1, 1, "normal"], true),
    rejected("inconsistent goal proof refuses successful delivery", [0, 1, "normal"], true),
    rejected("denied goal command starts no checker", [0, 0, "denied"], true),
    rejected(
      "external changes block final checking and retain user files",
      [0, 0, "changed"],
      true,
    ),
  ],
};
