export const WorkspaceMessage = {
  Entries: "Workspace exceeds limits.max_workspace_entries",
  Bytes: "Workspace exceeds limits.max_workspace_bytes",
  Depth: "Workspace exceeds limits.max_workspace_depth",
  SnapshotMode: "Source executable permission changed while reading its snapshot",
  WriteStalled: "Snapshot write made no progress",
  GitOutputLimit: "Git output exceeds the configured limit",
} as const;
export const unsafeArtifactPath = (path: string): string => `Unsafe artifact path: ${path}`;
export const snapshotSymlink = (path: string): string => `Snapshot refuses symlink: ${path}`;
export const snapshotSpecialFile = (path: string): string =>
  `Snapshot refuses special file: ${path}`;
