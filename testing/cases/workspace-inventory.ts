import { BoundaryReadLimit, ErrorCode } from "@titan/constants";
import { negative, positive } from "@titan/test-factories";

export const workspaceInventoryCases = {
  positive: [
    positive("root and one package are admitted", [[0]], 2),
    positive(
      "overlapping patterns do not duplicate a package",
      [[0], {}, ["packages/*", "packages/item-0"]],
      2,
    ),
    positive(
      "overlap does not spend an exact entry allowance",
      [[0], { max_workspaces: 2 }, ["packages/*", "packages/item-0"]],
      2,
    ),
    positive("root-only inventory is valid", [[], {}, []], 1),
    positive("root is included in an exact workspace cap", [[0, 0], { max_workspaces: 3 }], 3),
  ],
  negative: [
    negative("root manifest has a byte limit", [[], { manifest_bytes: 32 }], {
      code: ErrorCode.StreamLimit,
    }),
    negative("member manifest has a byte limit", [[200], { manifest_bytes: 150 }], {
      code: ErrorCode.StreamLimit,
    }),
    negative("member input shares the aggregate budget", [[100, 100], { total_bytes: 250 }], {
      code: ErrorCode.StreamLimit,
    }),
    negative(
      "root input shares the aggregate budget",
      [[0], { total_bytes: 150 }, ["packages/*"], 100],
      { code: ErrorCode.StreamLimit },
    ),
    negative("member count includes the root", [[0, 0], { max_workspaces: 2 }], {
      code: ErrorCode.VerificationBudget,
    }),
    negative(
      "too many workspace patterns fail",
      [[0], { max_patterns: 1 }, ["packages/*", "packages/item-0"]],
      { code: ErrorCode.VerificationBudget },
    ),
    negative("parent traversal pattern is rejected", [[0], {}, ["../packages/*"]], {
      name: "ZodError",
    }),
    negative("absolute pattern is rejected", [[0], {}, ["/packages/*"]], { name: "ZodError" }),
    negative("zero budget is rejected", [[], { max_workspaces: 0 }], { name: "ZodError" }),
    negative(
      "owner ceiling cannot be enlarged",
      [[], { total_bytes: BoundaryReadLimit.TotalBytes + 1 }],
      { name: "ZodError" },
    ),
    negative("unknown budget cannot omit checks", [[], { ignore: true }], { name: "ZodError" }),
    negative("default root budget is enforced", [[], {}, [], BoundaryReadLimit.ManifestBytes + 1], {
      code: ErrorCode.StreamLimit,
    }),
    negative("default member budget is enforced", [[BoundaryReadLimit.ManifestBytes + 1]], {
      code: ErrorCode.StreamLimit,
    }),
  ],
};
