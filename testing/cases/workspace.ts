import { ErrorCode, SnapshotMutation } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const workspaceExistsCases = {
  positive: [
    positive("existing file and missing peer are distinguished", ["file.txt", false], true),
    positive("nested file and missing peer are distinguished", ["nested/file.txt", false], true),
  ],
  negative: [
    negative("link loop remains a filesystem error", ["loop", true], { code: "ELOOP" }),
    negative("nested link loop remains a filesystem error", ["nested/loop", true], {
      code: "ELOOP",
    }),
  ],
};

export const workspaceSelectedCases = {
  positive: [
    positive(
      "a selected file ignores unrelated changing SQLite companions and links",
      [["kept/a.txt"], "none"],
      ["kept/a.txt"],
    ),
    positive(
      "a selected directory retains every child within its own budgets",
      [["kept"], "none"],
      ["kept/a.txt", "kept/b.txt"],
    ),
    positive(
      "combined selection retains the bounded union",
      [["kept/a.txt", "kept/b.txt"], "none"],
      ["kept/a.txt", "kept/b.txt"],
    ),
    positive("a missing selection retains an empty observation", [["absent"], "none"], []),
    positive(
      "an owned omission still applies inside the selected directory",
      [["kept"], "omitted"],
      ["kept/b.txt"],
    ),
  ],
  negative: [
    negative("a selected symbolic link remains refused", [["unrelated"], "none"], {
      code: ErrorCode.UnsafeSymlink,
    }),
    negative(
      "a selected descendant cannot traverse a symbolic link",
      [["unrelated/file.txt"], "none"],
      { code: ErrorCode.UnsafeSymlink },
    ),
    negative("selected parents and children consume entry allowance", [["kept"], "entries"], {
      code: ErrorCode.WorkspaceEntries,
    }),
    negative("selected bytes retain the aggregate allowance", [["kept/a.txt"], "bytes"], {
      code: ErrorCode.WorkspaceBytes,
    }),
    negative("a selected nested file retains its actual depth", [["kept/a.txt"], "depth"], {
      code: ErrorCode.WorkspaceDepth,
    }),
    negative("selection refuses parent traversal", [["../escape"], "none"], { name: "ZodError" }),
    negative("selection refuses protected metadata", [[".titan/requests.json"], "none"], {
      name: "ZodError",
    }),
    negative("selection cannot be empty", [[], "none"], { name: "ZodError" }),
    negative(
      "a whole-tree selector cannot bypass invalid sibling selection",
      [[".", "../escape"], "none"],
      { name: "ZodError" },
    ),
  ],
};

export const versionedSourceCases = {
  positive: [
    positive("versioned empty source retains its exact bytes", [0, SnapshotMutation.None], true),
    positive(
      "versioned source streams across chunk boundaries",
      [1024 * 1024, SnapshotMutation.None],
      true,
    ),
  ],
  negative: [
    negative("changed source refuses its earlier observation", [128, SnapshotMutation.Changed], {
      code: ErrorCode.SnapshotChanged,
    }),
    negative("growing source refuses its earlier observation", [128, SnapshotMutation.Grown], {
      code: ErrorCode.SnapshotChanged,
    }),
  ],
};

export const snapshotCases = {
  positive: [
    positive("empty file", [0, 0, SnapshotMutation.None], { bytes: 0, sameHash: true }),
    positive("binary data crosses stream chunks", [2 * 1024 * 1024, 255, SnapshotMutation.None], {
      bytes: 2 * 1024 * 1024,
      sameHash: true,
    }),
  ],
  negative: [
    negative(
      "growing source cannot exceed its declared copy size",
      [8192, 1, SnapshotMutation.Grown],
      {
        code: ErrorCode.SnapshotChanged,
      },
    ),
    negative("changed source never passes its manifest", [8192, 1, SnapshotMutation.Changed], {
      code: ErrorCode.SnapshotChanged,
    }),
    negative("missing source is not an empty file", [8192, 1, SnapshotMutation.Deleted], {
      code: "ENOENT",
    }),
    negative("manifest path cannot escape", [1, 1, SnapshotMutation.Escape], {
      code: ErrorCode.UnsafePath,
    }),
    negative("manifest cannot replace Git metadata", [1, 1, SnapshotMutation.Metadata], {
      code: ErrorCode.UnsafePath,
    }),
  ],
};

export const legacyHashCases = {
  positive: [
    positive("empty bytes retain persisted hash", [0, 0], true),
    positive("large binary retains persisted hash", [2 * 1024 * 1024 + 1, 255], true),
  ],
  negative: [
    negative(
      "changed source cannot receive its earlier tree hash",
      [32, 1, 1, SnapshotMutation.Changed],
      { code: ErrorCode.SnapshotChanged },
    ),
    negative(
      "growing source cannot receive its earlier tree hash",
      [32, 1, 1, SnapshotMutation.Grown],
      { code: ErrorCode.SnapshotChanged },
    ),
    rejected("changed one-byte content has a different hash", [1, 128, 127], false),
    rejected("changed two-byte content has a different hash", [2, 127, 128], false),
  ],
};

export const relativePathCases = {
  positive: [
    positive(
      "hidden code configuration remains an artifact",
      [".github/workflows/check.yml"],
      ".github/workflows/check.yml",
    ),
    positive(
      "similar environment names remain ordinary files",
      ["nested/.environment.txt"],
      "nested/.environment.txt",
    ),
  ],
  negative: [
    negative("empty name", [""], { code: ErrorCode.UnsafePath }),
    negative("parent traversal", ["../file"], { code: ErrorCode.UnsafePath }),
    negative("current component", ["./file"], { code: ErrorCode.UnsafePath }),
    negative("empty component", ["nested//file"], { code: ErrorCode.UnsafePath }),
    negative("null byte", ["a\u0000b"], { code: ErrorCode.UnsafePath }),
    negative("backslash", ["a\\b"], { code: ErrorCode.UnsafePath }),
    negative("runtime metadata", [".titan/agent-writer.db"], { code: ErrorCode.UnsafePath }),
    negative("nested Git metadata", ["nested/.git/config"], { code: ErrorCode.UnsafePath }),
    negative("environment credentials", [".env"], { code: ErrorCode.UnsafePath }),
    negative("nested environment credentials", ["nested/.env.local"], {
      code: ErrorCode.UnsafePath,
    }),
    negative("agent instructions", [".agents/skills/titan/SKILL.md"], {
      code: ErrorCode.UnsafePath,
    }),
    negative("dependencies", ["node_modules/package/index.js"], { code: ErrorCode.UnsafePath }),
  ],
};

export const workspaceVisibleCases = {
  positive: [
    positive(
      "hidden code configuration is retained",
      [[".github/workflows/check.yml"]],
      [".github/workflows/check.yml"],
    ),
    positive(
      "similar environment name is retained",
      [["nested/.environment.txt"]],
      ["nested/.environment.txt"],
    ),
  ],
  negative: [
    rejected(
      "runtime and Git metadata cannot enter a snapshot",
      [["keep.txt", ".titan/agent-writer.db", "nested/.git/config"]],
      ["keep.txt"],
    ),
    rejected(
      "credentials and agent state cannot enter a snapshot",
      [
        [
          "keep.txt",
          ".env",
          "nested/.env.local",
          ".claude/settings.json",
          ".agents/skills/titan/SKILL.md",
        ],
      ],
      ["keep.txt"],
    ),
  ],
};

export const workspaceCopyBatchCases = {
  positive: [
    positive("two files retain bytes and modes", [2, SnapshotMutation.None], true),
    positive("seventeen files cross the copy worker cap", [17, SnapshotMutation.None], true),
  ],
  negative: [
    rejected(
      "changed source drains every admitted copy and descriptor",
      [17, SnapshotMutation.Changed],
      true,
    ),
    rejected(
      "missing source drains every admitted copy and descriptor",
      [17, SnapshotMutation.Deleted],
      true,
    ),
  ],
};
