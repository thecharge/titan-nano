export const WorkspaceExcluded = [
  ".git",
  ".titan",
  ".codex",
  ".claude",
  ".agent",
  ".agents",
  "node_modules",
  "dist",
  "coverage",
];
export const WorkspaceFile = {
  Environment: ".env",
  EnvironmentPrefix: ".env.",
  Git: ".git",
  TemporarySuffix: ".tmp",
} as const;
export const WorkspaceLimit = {
  ProcessOutputBytes: 256 * 1024,
} as const;
export enum PathPart {
  Separator = "/",
  Backslash = "\\",
  Parent = "..",
  ParentPrefix = "../",
  Current = ".",
}
export enum FileOpenMode {
  Append = "a",
  Exclusive = "wx",
  Replace = "w",
  Read = "r",
}
export enum HashAlgorithm {
  Sha256 = "sha256",
}
export enum GitArgument {
  Command = "git",
  Directory = "-C",
  Worktree = "worktree",
  Add = "add",
  Detach = "--detach",
  Head = "HEAD",
}

export const SnapshotHashText = {
  Start: "[",
  End: "]",
  Separator: ",",
  EntryStart: "[",
  ContentStart: ',"',
  EntryEnd: '"]',
  ExecutableEntryEnd: '",true]',
} as const;

export const WorkspaceMode = {
  ExecutableBits: 0o111,
  PrivateFile: 0o600,
  PrivateExecutable: 0o700,
  ExecutableHashPrefix: "executable:",
} as const;

export const WorkspaceFileLinks = 1;

export enum WorkspaceModeSetting {
  Live = "live",
  Isolated = "isolated",
}

export const WorkspacePathPattern = /^[^\0]+$/;
export enum WorkspaceSecretFixture {
  Clean = "clean",
  Separate = "separate",
  Content = "content",
  Boundary = "boundary",
  Filename = "filename",
  Directory = "directory",
}
