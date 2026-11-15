import { KnowledgeTool } from "./knowledge.ts";

export enum NativeToolTransport {
  Http = "http",
  Stdio = "stdio",
}

export enum NativeToolRole {
  Worker = "worker",
  Checker = "checker",
}

export const NativeTool = {
  Name: "titan",
  Ready: "titan_native_ready",
  ReadFile: "titan_file_read",
  ListFiles: "titan_file_list",
  Route: "/native-tools",
  Version: 1,
  Source: "@titan/server/native-tool-bridge",
} as const;

export const NativeToolLaunchLimit = { Arguments: 16 } as const;
export const NativeFileLimit = {
  Bytes: 1024 * 1024,
  VersionCharacters: 1024,
} as const;
export const NativeFileField = { Files: "files" } as const;

export const NativeToolAudit = {
  Method: "tools/call",
  Kind: "tool",
  Unknown: "unknown_tool",
} as const;

export enum NativeToolOutcome {
  Returned = "returned",
  Refused = "refused",
}

export enum NativeAuditFixture {
  Valid = "valid",
  Execution = "execution",
  Attempt = "attempt",
  Role = "role",
  Completed = "completed",
  Extra = "extra",
  Outcome = "outcome",
  Capacity = "capacity",
  DuplicateRead = "duplicate_read",
  AuditWrite = "audit_write",
  NoRead = "no_read",
  NoWorkspace = "no_workspace",
  UnsafePath = "unsafe_path",
  Candidate = "candidate",
  Generation = "generation",
}

export const NativeToolPolicy = {
  [NativeToolRole.Worker]: [
    NativeTool.Ready,
    NativeTool.ReadFile,
    NativeTool.ListFiles,
    KnowledgeTool.Get,
    KnowledgeTool.Search,
    KnowledgeTool.Add,
    KnowledgeTool.Update,
    KnowledgeTool.Delete,
  ],
  [NativeToolRole.Checker]: [
    NativeTool.Ready,
    NativeTool.ReadFile,
    NativeTool.ListFiles,
    KnowledgeTool.Get,
    KnowledgeTool.Search,
  ],
} as const;

export enum NativeRuntimeFixture {
  Ready = "ready",
  Prefixed = "prefixed",
  Pending = "pending",
  Failed = "failed",
  Inventory = "inventory",
  Duplicate = "duplicate",
  Missing = "missing",
  Deadline = "deadline",
  Cancelled = "cancelled",
  Initialize = "initialize",
  Status = "status",
}

export enum NativeBindingFixture {
  Valid = "valid",
  Omitted = "omitted",
  Run = "run",
  Execution = "execution",
  Launch = "launch",
  Credential = "credential",
}

export enum NativeOwnerFixture {
  Ready = "ready",
  Value = "value",
  Chunks = "chunks",
  Directory = "directory",
  Obsolete = "obsolete",
}
