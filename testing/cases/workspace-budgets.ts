import { ErrorCode } from "@titan/constants";
import { WorkspaceMessage } from "@titan/messages";
import { negative, positive, rejected } from "@titan/test-factories";

export const workspaceReadBudgetCases = {
  positive: [
    positive(
      "exact entries bytes and depth",
      [
        { "dir/file": 4 },
        { max_workspace_entries: 2, max_workspace_bytes: 4, max_workspace_depth: 2 },
      ],
      ["dir/file"],
    ),
    positive(
      "excluded trees consume no inventory",
      [
        { ".git/large": 20, ".env": 20, file: 1 },
        { max_workspace_entries: 1, max_workspace_bytes: 1, max_workspace_depth: 1 },
      ],
      ["file"],
    ),
    positive(
      "empty directory is allowed at the ceiling",
      [{ "empty/": 0 }, { max_workspace_entries: 1, max_workspace_depth: 1 }],
      [],
    ),
    positive(
      "prototype-shaped filename remains a real file",
      [{ ["__proto__"]: 1 }, {}, false],
      ["__proto__"],
    ),
  ],
  negative: [
    negative(
      "wide inventory exceeds entries",
      [{ first: 1, second: 1 }, { max_workspace_entries: 1 }],
      { code: ErrorCode.WorkspaceEntries },
    ),
    negative(
      "empty directories count toward entries",
      [{ "first/": 0, "second/": 0 }, { max_workspace_entries: 1 }],
      { code: ErrorCode.WorkspaceEntries },
    ),
    negative("nested file exceeds depth", [{ "dir/file": 1 }, { max_workspace_depth: 1 }], {
      code: ErrorCode.WorkspaceDepth,
    }),
    negative(
      "empty nested directory exceeds depth",
      [{ "dir/empty/": 0 }, { max_workspace_depth: 1 }],
      { code: ErrorCode.WorkspaceDepth },
    ),
    negative(
      "one streamed file exceeds bytes",
      [{ file: 131073 }, { max_workspace_bytes: 65536 }],
      { code: ErrorCode.WorkspaceBytes },
    ),
    negative(
      "separate files share the byte budget",
      [{ first: 3, second: 3 }, { max_workspace_bytes: 5 }],
      { code: ErrorCode.WorkspaceBytes },
    ),
  ],
};
export const workspaceWriteBudgetCases = {
  positive: [
    positive(
      "copy accepts the exact manifest boundary",
      [
        { "dir/first": 2, "dir/second": 2 },
        { max_workspace_entries: 3, max_workspace_bytes: 4, max_workspace_depth: 2 },
        true,
      ],
      ["dir/first", "dir/second"],
    ),
    positive(
      "candidate accepts the exact manifest boundary",
      [
        { file: 4 },
        { max_workspace_entries: 1, max_workspace_bytes: 4, max_workspace_depth: 1 },
        true,
        true,
      ],
      ["file"],
    ),
  ],
  negative: [
    negative(
      "copy refuses excess entries before creating target",
      [{ first: 1, second: 1 }, { max_workspace_entries: 1 }, true],
      { code: ErrorCode.WorkspaceEntries },
    ),
    negative(
      "candidate refuses excess entries before creating target",
      [{ first: 1, second: 1 }, { max_workspace_entries: 1 }, true, true],
      { code: ErrorCode.WorkspaceEntries },
    ),
    negative(
      "copy refuses excess depth before creating target",
      [{ "dir/file": 1 }, { max_workspace_depth: 1 }, true],
      { code: ErrorCode.WorkspaceDepth },
    ),
    negative(
      "copy refuses excess bytes before creating target",
      [{ file: 4 }, { max_workspace_bytes: 3 }, true],
      { code: ErrorCode.WorkspaceBytes },
    ),
  ],
};
export const workspaceConfigBudgetCases = {
  positive: [
    positive(
      "owner sets all budgets",
      [{ max_workspace_entries: 5, max_workspace_bytes: 20, max_workspace_depth: 2 }, {}],
      { entries: 5, bytes: 20, depth: 2 },
    ),
    positive(
      "workflow overrides one budget and retains siblings",
      [
        { max_workspace_entries: 5, max_workspace_bytes: 20, max_workspace_depth: 2 },
        { max_workspace_bytes: 10 },
      ],
      { entries: 5, bytes: 10, depth: 2 },
    ),
  ],
  negative: [
    negative("zero byte budget is rejected", [{}, { max_workspace_bytes: 0 }], {
      code: ErrorCode.InvalidConfig,
    }),
    negative("fractional entry budget is rejected", [{ max_workspace_entries: 1.5 }, {}], {
      code: ErrorCode.InvalidConfig,
    }),
    negative("excessive depth is rejected", [{}, { max_workspace_depth: 129 }], {
      code: ErrorCode.InvalidConfig,
    }),
    negative("unbounded entry count is rejected", [{}, { max_workspace_entries: 100001 }], {
      code: ErrorCode.InvalidConfig,
    }),
    negative(
      "unbounded byte count is rejected",
      [{}, { max_workspace_bytes: 16 * 1024 * 1024 * 1024 + 1 }],
      { code: ErrorCode.InvalidConfig },
    ),
  ],
};
const passed = { passed: true, blocked: false, reason: null, refutations: 0, original: true };
const blocked = { passed: false, blocked: true, refutations: 0, original: true, files: [] };
export const engineWorkspaceBudgetCases = {
  positive: [
    positive(
      "one candidate fits the exact budgets",
      [{ max_workspace_entries: 3, max_workspace_bytes: 8, max_workspace_depth: 2 }],
      { ...passed, files: ["nested/left", "source"] },
    ),
    positive(
      "parallel candidates merge within the budgets",
      [{ max_workspace_entries: 4, max_workspace_bytes: 12, max_workspace_depth: 2 }, true],
      { ...passed, files: ["nested/left", "nested/right", "source"] },
    ),
  ],
  negative: [
    rejected("candidate entries block without a refutation", [{ max_workspace_entries: 2 }], {
      ...blocked,
      reason: WorkspaceMessage.Entries,
    }),
    rejected("candidate bytes block without a refutation", [{ max_workspace_bytes: 7 }], {
      ...blocked,
      reason: WorkspaceMessage.Bytes,
    }),
    rejected("candidate depth blocks without a refutation", [{ max_workspace_depth: 1 }], {
      ...blocked,
      reason: WorkspaceMessage.Depth,
    }),
    rejected("parallel union cannot exceed entry budget", [{ max_workspace_entries: 3 }, true], {
      ...blocked,
      reason: WorkspaceMessage.Entries,
    }),
    rejected("parallel union cannot exceed byte budget", [{ max_workspace_bytes: 8 }, true], {
      ...blocked,
      reason: WorkspaceMessage.Bytes,
    }),
  ],
};
