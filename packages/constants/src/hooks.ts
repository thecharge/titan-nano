export enum HookMode {
  Commit = "commit",
  Push = "push",
}

export enum HookCommand {
  Git = "git",
  Bun = "bun",
}

export enum ProcessIo {
  Pipe = "pipe",
  Inherit = "inherit",
  Ignore = "ignore",
}

export const HookFile = {
  Manifest: "package.json",
  Lock: "bun.lock",
  Dependencies: "node_modules",
  Index: "index",
  Snapshot: "source",
  Verified: ".git/titan-verified",
  TemporaryPrefix: "titan-hook-",
  MessageTemporaryPrefix: "titan-message-",
  Message: "COMMIT_EDITMSG.md",
  PrivateMode: 0o600,
  Configuration: "lefthook.yml",
  Secrets: ".secretlintrc.json",
  Commitlint: ".commitlintrc.json",
  RepositoryRoot: "../..",
  RelativePrefix: "./",
  ManifestSuffix: "/package.json",
} as const;

export const CiPolicy = {
  WorkflowPattern: ".github/workflows/*",
} as const;

export const HookLimit = {
  LockBytes: 8_388_608,
  OutputBytes: 1_048_576,
  CommitCount: 1000,
  FilesPerScan: 128,
  ChangedFiles: 4096,
} as const;
export const GitObjectPattern = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
export const GitZeroPattern = /^0+$/;
export const GitRefPattern = /^refs\/[A-Za-z0-9._/-]+$/;
export const GitLocalRefPattern = /^(?:refs\/[A-Za-z0-9._/-]+|HEAD|\(delete\))$/;
export const HookPackagePattern = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
export const HookWorkspacePattern = /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_*-]+)*$/;

export const GitHookArgument = {
  Root: ["rev-parse", "--show-toplevel"],
  Head: "HEAD",
  ParentSuffix: "^1",
  Changes: ["diff", "--raw", "--no-abbrev", "--no-renames", "--no-ext-diff", "--no-textconv", "-z"],
  IndexTree: ["write-tree"],
  ReadTree: "read-tree",
  ExportIndex: ["checkout-index", "--all", "--ignore-skip-worktree-bits"],
  Prefix: "--prefix=",
  RevisionList: ["rev-list", "--reverse", "--topo-order"],
  Verify: ["rev-parse", "--verify"],
  CommitSuffix: "^{commit}",
  TreeSuffix: "^{tree}",
  Range: "..",
  Inventory: ["ls-tree", "-r"],
  Files: ["ls-tree", "-rz", "--name-only"],
  Message: ["show", "-s", "--format=%B"],
} as const;

export const HookEnvironment = {
  Prefix: "GIT_",
  Index: "GIT_INDEX_FILE",
  Directory: "GIT_DIR",
  WorkTree: "GIT_WORK_TREE",
} as const;

export const GitHookFormat = {
  Newline: "\n",
  Null: "\0",
  FieldSeparator: /\s+/,
  Whitespace: /\s+/,
  SymbolicLink: "120000",
  Submodule: "160000",
  TreeMode: /^(120000|160000) /m,
} as const;

export const HandChange = {
  Prefix: "Written by hand: ",
  WrappedPrefix: /^Written by hand:[ \t]*\r?\n[ \t]+/gm,
  Separator: ", ",
  RunRecord: ".titan/written-by-runs.json",
  Staged: ["diff", "--cached", "--name-only", "-z", "--no-renames"],
} as const;

export const HandChangeTest = {
  Subject: "feat: add one file",
  Message: "message.txt",
  FileA: "a.txt",
  FileB: "b.txt",
  Initial: "--initial-branch=main",
  Content: "content",
  Corrupt: "not json",
  Folder: ".titan",
  Invalid: "updated stuff",
  Init: "init",
  Add: "add",
  Body: "\n\n",
} as const;

export enum HandChangeFixture {
  Listed = "listed",
  Wrapped = "wrapped",
  WrappedWindows = "wrapped-windows",
  Unindented = "unindented",
  EmptyWrapped = "empty-wrapped",
  Unlisted = "unlisted",
  WrittenByRun = "written-by-run",
  Mixed = "mixed",
  MixedListed = "mixed-listed",
  NothingStaged = "nothing-staged",
  CorruptRecord = "corrupt-record",
  NotRepository = "not-repository",
  MissingMessage = "missing-message",
  PolicyListed = "policy-listed",
  PolicyUnlisted = "policy-unlisted",
  PolicyInvalid = "policy-invalid",
}

export const HookTestCommand = ["bun", "run", "test"] as const;

export const HookCheckCommands = [
  [
    "bun",
    "x",
    "--no-install",
    "biome",
    "ci",
    "--colors=off",
    "--max-diagnostics=20",
    "--error-on-warnings",
    ".",
  ],
  ["bun", "run", "typecheck"],
  ["bun", "run", "check:typescript-policy"],
  ["bun", "run", "check:lint-policy"],
  ["bun", "run", "check:schemas"],
  ["bun", "run", "check:flat-tests"],
  ["bun", "run", "check:source-comments"],
  ["bun", "run", "check:format:docs"],
  ["bun", "run", "check:spelling"],
  ["bun", "run", "check:promises"],
  ["bun", "run", "check:async-fs"],
  ["bun", "run", "check:unused"],
  ["bun", "run", "check:boundaries"],
  ["bun", "run", "check:package-policy"],
  ["bun", "run", "check:specs"],
  ["bun", "run", "check:docs"],
  ["bun", "run", "check:links"],
  ["bun", "run", "check:readmes"],
  HookTestCommand,
] as const;

export const HookDocumentationCheckCommands = HookCheckCommands.filter(
  (command) => command !== HookTestCommand,
);

export const HookToolchain = {
  PackageManagerPrefix: "bun@",
  Scope: "@",
  Workspace: "workspace:",
  Catalog: "catalog:",
} as const;

export const HookDependencyPath = { Cache: ".bun", Binaries: ".bin" } as const;
export const HookGitInputLimit = 1_048_576;
export const HookConfigArgument = { Secrets: "--secretlintrc", Commits: "--config" } as const;
export const HookSecretCommand = [
  "bun",
  "x",
  "--no-install",
  "secretlint",
  "--no-gitignore",
  "--no-glob",
] as const;
export const HookCommitMessageCommand = ["bun", "x", "--no-install", "commitlint"] as const;

export enum HookName {
  PreCommit = "pre-commit",
  CommitMessage = "commit-msg",
  PrePush = "pre-push",
}

export const HookInvocation = {
  Commit: "bun tooling/scripts/check-hook.ts commit",
  Push: "bun tooling/scripts/check-hook.ts push",
  Message: 'bun tooling/scripts/check-message.ts "{1}"',
  FormatCode:
    "bunx biome check --write --no-errors-on-unmatched --files-ignore-unknown=true {staged_files}",
  FormatDocs: "bun run format:docs",
} as const;

export const HookGlob = {
  Code: "*.{ts,tsx,js,json,jsonc}",
  Documents: "*.{md,yaml,yml}",
} as const;

export const HookJob = {
  FormatCode: "format-code",
  FormatDocs: "format-docs",
  Commit: "staged-snapshot",
  Push: "outgoing-snapshots",
  Message: "message-policy",
} as const;

export const HookPreset = {
  Secrets: "@secretlint/secretlint-rule-preset-recommend",
  Commitlint: "@commitlint/config-conventional",
} as const;

export enum HookCheckScope {
  Full = "full",
  Documentation = "documentation",
}

export enum GitFileMode {
  Absent = "000000",
  Regular = "100644",
  Executable = "100755",
  SymbolicLink = "120000",
  Submodule = "160000",
}

export enum GitChangeKind {
  Added = "A",
  Deleted = "D",
  Modified = "M",
}

export const HookDocumentation = {
  Directories: ["docs/", "openspec/"],
  Passive: [".claude/", ".agent/", ".codex/", ".titan-delivery/"],
  Readme: "README.md",
  Extension: ".md",
  PathPattern: /^[A-Za-z0-9_ ./-]+$/,
} as const;
