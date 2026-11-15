export const TestProcessLimit = {
  DefaultMilliseconds: 3000,
  MaximumMilliseconds: 30000,
} as const;

export enum ProcessScopeMode {
  Complete = "complete",
  Deadline = "deadline",
  Throw = "throw",
}

export enum ObservationFixture {
  Sequential = "sequential",
  Paging = "paging",
  Settled = "settled",
  Json = "json",
  Detached = "detached",
  EventFailure = "event-failure",
  StateFailure = "state-failure",
}

export enum ConcurrentWorkflowFixture {
  SharedProject = "shared-project",
  SeparateProjects = "separate-projects",
  Cancel = "cancel",
  OperationalStop = "operational-stop",
}

export enum ConfiguredStartupFixture {
  None = "none",
  Backend = "backend",
  Script = "script",
}

export const TestProcessFixture = {
  Eval: "-e",
  ExitScript: "process.exit(2)",
  Script: "await Bun.sleep(Number(process.argv[1]));",
  HeldMilliseconds: 200,
} as const;

export enum DaemonFixture {
  Fresh = "fresh",
  Reuse = "reuse",
  Concurrent = "concurrent",
  Stale = "stale",
  LaunchError = "launch-error",
  ExpiredProbe = "expired-probe",
  Exited = "exited",
  Timeout = "timeout",
  Zero = "zero",
  Excess = "excess",
}

export enum DaemonProbeFixture {
  Older = "older",
  Newer = "newer",
  Healthy = "healthy",
  Trailing = "trailing",
  Unauthorized = "unauthorized",
  Empty = "empty",
  Malformed = "malformed",
  Oversized = "oversized",
  Invalid = "invalid",
  Missing = "missing",
}

export const DaemonEntryFixture = {
  Source: "main.ts",
  Bundle: "titan.js",
  Traversal: "../../untrusted.ts",
  Empty: "",
} as const;

export enum DaemonClientFixture {
  Runs = "runs",
  Knowledge = "knowledge",
  Requests = "requests",
  Mcp = "mcp",
  EmptyKnowledge = "empty-knowledge",
  UnsafeKnowledge = "unsafe-knowledge",
  UnsafeRun = "unsafe-run",
  UnsafeRequest = "unsafe-request",
}

export enum DaemonBuildCase {
  Same = "same",
  Different = "different",
  Legacy = "legacy",
}
