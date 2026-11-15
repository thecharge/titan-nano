import { positive, rejected } from "@titan/test-factories";

export const packageDirectionTreeCases = {
  positive: [
    positive("real core manifest may use types", ["@titan/core", "@titan/types"], {
      code: 0,
      findings: 0,
    }),
    positive("real core manifest may use messages", ["@titan/core", "@titan/messages"], {
      code: 0,
      findings: 0,
    }),
    positive("runtime manifest composes Codex", ["@titan/runtime", "@titan/backend-codex"], {
      code: 0,
      findings: 0,
    }),
    positive("adapter manifest depends on core", ["@titan/backend-claude", "@titan/core"], {
      code: 0,
      findings: 0,
    }),
  ],
  negative: [
    rejected(
      "runner manifest cannot introduce Claude",
      ["@titan/runner", "@titan/backend-claude"],
      { code: 1, findings: 1 },
    ),
    rejected("server manifest cannot introduce Codex", ["@titan/server", "@titan/backend-codex"], {
      code: 1,
      findings: 1,
    }),
    rejected(
      "adapter manifest cannot depend on workflow",
      ["@titan/backend-codex", "@titan/workflow"],
      { code: 1, findings: 1 },
    ),
    rejected("core manifest cannot depend on runner", ["@titan/core", "@titan/runner"], {
      code: 1,
      findings: 1,
    }),
  ],
};
