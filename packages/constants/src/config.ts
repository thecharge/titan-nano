import { NativeToolTransport } from "./native-tools.ts";

export enum RecoverySessionMode {
  NativeOnly = "native_only",
  AllowReconstruction = "allow_reconstruction",
}

export enum AgentTool {
  Read = "Read",
  Glob = "Glob",
  Grep = "Grep",
  Write = "Write",
  Edit = "Edit",
  Bash = "Bash",
}

export enum ServerResourceField {
  ResidentRuns = "max_resident_runs",
}

export enum ServerQueueField {
  Requests = "max_pending_request_operations",
  Runs = "max_pending_run_operations",
  Submissions = "max_pending_submissions",
}

export enum ConfigSource {
  BuiltIn = "built-in",
  User = "user",
  Project = "project",
  Workflow = "workflow",
  Cli = "CLI",
}

export enum ConfigSection {
  Approvals = "approvals",
  Defaults = "defaults",
  Limits = "limits",
  Recovery = "recovery",
  Requests = "requests",
  Server = "server",
  Client = "client",
  Update = "update",
}

export enum DataKind {
  Number = "number",
  Object = "object",
  String = "string",
  Boolean = "boolean",
}

export enum EnvVar {
  TitanHome = "TITAN_HOME",
  Home = "HOME",
  XdgConfigHome = "XDG_CONFIG_HOME",
  UserProfile = "USERPROFILE",
  AppData = "APPDATA",
  LocalAppData = "LOCALAPPDATA",
}

export const ConfigFile = {
  HomeDirectory: ".titan",
  User: "config.yaml",
  Project: ".titan/config.yaml",
} as const;

export const ConfigDefault = {
  HostGcMarkers: 1,
  HostGcMarkersLimit: 16,
  NativeTransport: NativeToolTransport.Http,
  HostWorkerThreads: 2,
  HostWorkerThreadsMinimum: 2,
  HostWorkerThreadsLimit: 16,
  HostStartupMilliseconds: 10000,
  HostStartupLimit: 60000,
  SchemaVersion: 1,
  MaxWorkspaceEntries: 10000,
  MaxWorkspaceEntriesLimit: 100000,
  MaxWorkspaceBytes: 1024 * 1024 * 1024,
  MaxWorkspaceBytesLimit: 16 * 1024 * 1024 * 1024,
  MaxWorkspaceDepth: 64,
  MaxWorkspaceDepthLimit: 128,
  MaxSteps: 50,
  MaxParallel: 4,
  MaxGroupDepth: 32,
  MaxGroupDepthLimit: 128,
  MaxRetries: 5,
  BaseDelaySeconds: 1,
  MaxDelaySeconds: 60,
  JitterRatio: 0.2,
  MaxAttempts: 3,
  ClaudeMaxTurns: 30,
  Candidates: 1,
  MaxCandidates: 1,
  MaxActiveAgents: 8,
  MaxNativeBindings: 1024,
  MaxNativeBindingsLimit: 65536,
  MaxPendingAgents: 1024,
  MaxPendingAgentsLimit: 65536,
} as const;

export const UnsafeSettingNames = ["__proto__", "prototype", "constructor"] as const;
export const SecretEnvironmentPattern =
  /_API_KEY$|_TOKEN$|^ANTHROPIC_|^OPENAI_|^GEMINI_|^GOOGLE_API|^RUNPOD_/;
export const IdentifierPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

export enum FileErrorCode {
  IsDirectory = "EISDIR",
  NotDirectory = "ENOTDIR",
  NoProcess = "ESRCH",
  AccessDenied = "EACCES",
  InputOutput = "EIO",
  Missing = "ENOENT",
  Exists = "EEXIST",
}

export enum TextSymbol {
  Space = " ",
  Empty = "",
  Comma = ",",
  Dot = ".",
  Colon = ":",
  Newline = "\n",
}

export const ConcurrencyDefault = 8;

export const WorkflowConfigFields = [
  "backends",
  "defaults",
  "limits",
  "recovery",
  "approvals",
  "requests",
] as const;

export const SettingOverrideLimit = { Entries: 64, Characters: 1024 } as const;
export const SettingAssignment = "=";

export enum ConfigScope {
  User = "user",
  Project = "project",
}

export enum ConfigCommand {
  Show = "show",
  Init = "init",
  Validate = "validate",
  Set = "set",
  Schema = "schema",
}

export const ConfigWrite = {
  LockSuffix: ".writer.db",
  Adapter: "sqlite",
  Prepare: "PRAGMA busy_timeout=0",
  Claim: "BEGIN EXCLUSIVE",
  Busy: "SQLITE_BUSY",
  Attempts: 10,
  RetryMilliseconds: 25,
  FileMode: 0o600,
  DirectoryMode: 0o700,
  SettingPattern: /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/,
} as const;

export const ConfigInspection = { Version: 1 } as const;
