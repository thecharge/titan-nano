import { KnowledgeTool } from "./knowledge.ts";

export enum NativeToolTransport {
  Http = "http",
  Stdio = "stdio",
}

export enum NativeToolRole {
  Worker = "worker",
  Checker = "checker",
  Improver = "improver",
}

export const NativeTool = {
  Name: "titan",
  Ready: "titan_native_ready",
  ReadFile: "titan_file_read",
  WriteFile: "titan_file_write",
  ListFiles: "titan_file_list",
  ReadWeb: "titan_web_read",
  Route: "/native-tools",
  Version: 1,
  Source: "@titan/server/native-tool-bridge",
} as const;

export const WebResource = {
  Operation: "web_read",
  Bytes: 128 * 1024,
  UrlCharacters: 2048,
  TimeoutMs: 10_000,
  Redirects: 5,
  HeaderBytes: 16 * 1024,
  NonPublicV4: [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.88.99.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 3],
  ],
  NonPublicV6: [
    ["2001::", 23],
    ["2001:db8::", 32],
    ["2002::", 16],
    ["3fff::", 20],
  ],
  Protocol: "https:",
  IpV6: "ipv6",
  PublicV6: "2000::",
  AcceptEncoding: "accept-encoding",
  ContentEncoding: "content-encoding",
  Identity: "identity",
  TextTypePrefix: "text/",
  JsonTypeSuffix: "+json",
  MediaTypeDelimiter: ";",
  Host: "host",
  RedirectStatuses: [301, 302, 303, 307, 308] as readonly number[],
  ErrorEvent: "error",
  CloseEvent: "close",
} as const;
export const OperationWebRead = WebResource.Operation;
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
  [NativeToolRole.Improver]: [NativeTool.Ready, NativeTool.ReadFile],
  [NativeToolRole.Worker]: [
    NativeTool.Ready,
    NativeTool.ReadFile,
    NativeTool.WriteFile,
    NativeTool.ReadWeb,
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
