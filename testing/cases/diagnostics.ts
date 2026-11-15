import { positive, rejected } from "@titan/test-factories";
export const diagnosticCases = {
  positive: [
    positive("boundary scope report", ["summary"], "Package boundaries: 2 workspaces, 0 findings"),
    positive(
      "pending work is explicit",
      ["pending"],
      "Acceptance map checked; 3 scenarios pending. This is not a full release gate pass.",
    ),
  ],
  negative: [
    rejected(
      "boundary defect identifies owner",
      ["boundary"],
      "@titan/core/src/index.ts: private-export: @titan/runner/internal",
    ),
    rejected(
      "package failure retains command",
      ["package"],
      "Package check failed: bun run pack:preview",
    ),
    rejected("command error retains diagnostic", ["command"], "titan check: invalid workflow"),
    rejected("server exit retains reason", ["exit"], "Server exited: unavailable"),
    rejected("missing input names consumer", ["input"], "consumer: producer.note"),
  ],
};
