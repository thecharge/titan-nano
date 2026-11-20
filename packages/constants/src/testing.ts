import { RunFormat } from "./board.ts";

export enum CaseMode {
  Returns = "returns",
  Throws = "throws",
}
export enum CasePolarity {
  Positive = "positive",
  Negative = "negative",
}
export const MinimumCasesPerPolarity = 2;
export const TestLabel = {
  Positive: "positive: $name",
  Negative: "negative: $name",
} as const;
export enum SubmissionMutation {
  None = "none",
  Goal = "goal",
  Path = "path",
  Session = "session",
}

export enum SnapshotMutation {
  Grown = "grown",
  None = "none",
  Changed = "changed",
  Deleted = "deleted",
  Escape = "escape",
  Metadata = "metadata",
}
export enum BoardFixture {
  Cutoff = "cutoff",
  Parallel = "parallel",
  TrailingWrite = "trailing_write",
  InvalidJson = "invalid_json",
  InvalidUsage = "invalid_usage",
  DuplicateSequence = "duplicate_sequence",
}

export enum HookSnapshotFixture {
  StagedContent = "staged_content",
  StagedDeletion = "staged_deletion",
  SymbolicLink = "symbolic_link",
  CallbackFailure = "callback_failure",
}

export enum HookRevisionFixture {
  Range = "range",
  NewBranch = "new_branch",
  Deletion = "deletion",
  MissingRemote = "missing_remote",
  InvalidLocal = "invalid_local",
}

export enum CancellationBoundary {
  None = "none",
  BeforeSend = "before_send",
  BeforeEvent = "before_event",
  ResultHandler = "result_handler",
  StreamEnd = "stream_end",
}

export enum VendorStubMode {
  QuotaExhausted = "quota_exhausted",
  QuotaBilling = "quota_billing",
  FinalWorkerRetry = "final_worker_retry",
  FinalCheckerRetry = "final_checker_retry",
  FinalWorkerBlocked = "final_worker_blocked",
  FinalCheckerBlocked = "final_checker_blocked",
  NativeTools = "native_tools",
  NativeProjectWrite = "native_project_write",
  NativeProjectRefused = "native_project_refused",
  RateWaitOnce = "rate_wait_once",
  RateWarning = "rate_warning",
  RateRejectedNotice = "rate_rejected_notice",
  RateLimitOnce = "rate_limit_once",
  ServiceRetryOnce = "service_retry_once",
  ServerRetryOnce = "server_retry_once",
  RateLimitAlways = "rate_limit_always",
  UnknownRetry = "unknown_retry",
  InvalidRetry = "invalid_retry",
  BillingRetry = "billing_retry",
  MismatchedRetry = "mismatched_retry",
  RecoverOnce = "recover_once",
  DelayedRecoverOnce = "delayed_recover_once",
  RecoverReplacedSession = "recover_replaced_session",
  RecoverReplacedResult = "recover_replaced_result",
  ReplacedSession = "replaced_session",
  ReplacedResult = "replaced_result",
  Complete = "complete",
  ActiveOnce = "active_once",
  AwaitPeer = "await_peer",
  Unexpected = "unexpected",
  Truncated = "truncated",
  Malformed = "malformed",
  InvalidOutput = "invalid_output",
  Exit = "exit",
  Cancel = "cancel",
}

export enum SymlinkFixture {
  Root = "root",
  None = "none",
  Outside = "outside",
  Dangling = "dangling",
  Inside = "inside",
  InsideDirectory = "inside_directory",
  HardLink = "hard_link",
}

export const VendorFixture = {
  ResumeHold: "request-resume-hold",
  ResumeEntered: "request-resume-entered",
  ResumeRelease: "request-resume-release",
  TransportTimeoutMilliseconds: 3000,
  StateDirectory: ".titan/vendor-fixture",
  Heartbeat: "writer-heartbeat",
  Pids: "active-pids.json",
  Output: "DELIVERED.txt",
  Partial: "Partial native delivery",
  Delivered: "Delivered by SDK stub",
  SourceFile: "source.txt",
  SourceContent: "Original project content",
  HeartbeatStabilityMilliseconds: 100,
  Codex: "codex-0.171.0.mjs",
  Claude: "claude-0.3.329.mjs",
} as const;

export enum EventInspectionTransport {
  Http = "http",
  Cli = "cli",
  Mcp = "mcp",
}

export enum UsageTransport {
  Http = "http",
  Cli = "cli",
  Mcp = "mcp",
}

export enum SnapshotReadFixture {
  Commit = "commit",
  Reload = "reload",
  Empty = "empty",
  AppendFailure = "append_failure",
  ProjectionFailure = "projection_failure",
}

export enum CatalogFixture {
  Healthy = "healthy",
  Missing = "missing",
  Corrupt = "corrupt",
  Directory = "directory",
}

export enum BackgroundFixture {
  Healthy = "healthy",
  Operational = "operational",
  AppendFailure = "append_failure",
  ProjectionFailure = "projection_failure",
}

export enum SdkPlanFixture {
  Complete = "complete",
  MissingInput = "missing_input",
  Conflict = "conflict",
}

export const SdkDelivery = {
  Steps: ["seed", "left", "middle", "right", "join", "document", "audit", "finish"],
  Origins: ["codex-harness", "claude-code-harness"],
  Workflow: "mixed-sdk-delivery",
  DaemonTimeout: 60000,
  SettleAttempts: 1000,
  PollMilliseconds: 50,
} as const;

export const SdkProcessFixture = {
  CommandTimeout: 5000,
  DaemonTimeout: 15000,
  ObserveAttempts: 4000,
  CaseTimeout: 60000,
} as const;

export enum UsageHistoryFault {
  None = "none",
  ChangedUsage = "changed_usage",
  LessUsage = "less_usage",
  LessExecutions = "less_executions",
  MoreUsage = "more_usage",
  RewindAttempt = "rewind_attempt",
  UnknownPhase = "unknown_phase",
  WrongRun = "wrong_run",
  FutureCursor = "future_cursor",
}

export enum UsageBackendSource {
  Persona = "persona",
  Defaults = "defaults",
  Run = "run",
}

export enum ArtifactMutation {
  None = "none",
  Content = "content",
  Mode = "mode",
  Paths = "paths",
  MissingPath = "missing_path",
  DuplicatePath = "duplicate_path",
  ContentAndManifest = "content_and_manifest",
  Hash = "hash",
  Outputs = "outputs",
  OutputsAndResult = "outputs_and_result",
  Result = "result",
  Malformed = "malformed",
  MissingManifest = "missing_manifest",
  DirectoryLink = "directory_link",
  ManifestLink = "manifest_link",
  FileLink = "file_link",
  ResultLink = "result_link",
  NotPassed = "not_passed",
  MissingDirectory = "missing_directory",
  WrongDirectory = "wrong_directory",
  JournalType = "journal_type",
  JournalHash = "journal_hash",
  JournalEmpty = "journal_empty",
}

export enum ArtifactInspectionTransport {
  Http = "http",
  Cli = "cli",
  Mcp = "mcp",
}

export enum SpellingFixture {
  Plain = "plain",
  GitIgnored = "git-ignored",
  ChildPolicy = "child-policy",
  GlobalPolicy = "global-policy",
}

export enum TestSchedule {
  Sequential = "sequential",
  Concurrent = "concurrent",
}
export enum ArtifactContentMutation {
  None = "none",
  Hash = "hash",
  Short = "short",
  Grown = "grown",
  Mode = "mode",
  Link = "link",
  Missing = "missing",
}

export const TestScheduling = {
  Maximum: 8,
  Timeout: 5000,
  DelayMilliseconds: 25,
  Program: "testing/fixtures/scheduling.mjs",
  Settings: "settings.json",
  Result: "result.json",
  Probe: "probe.test.ts",
  Guard: "testing/support/guard.ts",
  Dependencies: "testing/node_modules",
} as const;
export const TestConcurrencyArguments = [
  "--max-concurrency",
  String(TestScheduling.Maximum),
] as const;

export enum ArtifactExportFixture {
  AlteredCopy = "altered-copy",
  MissingCopy = "missing-copy",
  Plain = "plain",
  Executable = "executable",
  Binary = "binary",
  Nested = "nested",
  Existing = "existing",
  LinkedParent = "linked-parent",
  LinkedTarget = "linked-target",
  MissingParent = "missing-parent",
  FileParent = "file-parent",
  Relative = "relative",
  RunStorage = "run-storage",
  InvalidId = "invalid-id",
  MissingId = "missing-id",
  Changed = "changed",
  LinkedSource = "linked-source",
  NotPassed = "not-passed",
  OversizedMetadata = "oversized-metadata",
  LongName = "long-name",
  PartialWrite = "partial-write",
  ChangedDuringCopy = "changed-during-copy",
  ManifestConflict = "manifest-conflict",
}

export enum DependencyReadFixture {
  Normal = "normal",
  RootLock = "root-lock",
  SnapshotLock = "snapshot-lock",
  CachedManifest = "cached-manifest",
}

export enum JsonFixture {
  Projection = "projection",
  Value = "value",
  NullObject = "null-object",
  NullArray = "null-array",
  Cycle = "cycle",
  Accessor = "accessor",
  Setter = "setter",
  Sparse = "sparse",
  BigInt = "big-int",
  Symbol = "symbol",
  Function = "function",
  Date = "date",
  Undefined = "undefined",
  Deep = "deep",
  PairBoundary = "pair-boundary",
  Repeated = "repeated",
}

export enum ClaudeMcpFixture {
  Read = "mcp__inherited__read",
  Write = "mcp__inherited__write",
}

export const OperationalEvidenceFixture = {
  Error: "Transport interruption fixture",
  Refutation: "Candidate fails the quality fixture",
  Survived: "Candidate passed the quality fixture",
} as const;

export enum SubmissionSurface {
  Cli = "cli",
  Mcp = "mcp",
  Http = "http",
}

export enum RunOriginMutation {
  None = "none",
  Client = "client",
  Submission = "submission",
  Session = "session",
  Downgrade = "downgrade",
}

export enum RecoveryCheckpointMode {
  Complete = "complete",
  Pause = "pause",
  Reload = "reload",
  Cancel = "cancel",
  Deadline = "deadline",
  Peer = "peer",
}

export const RecoveryCheckpointFixture = {
  PartialFile: "PARTIAL.txt",
  PartialContent: "Work retained before retry\n",
  WaitMilliseconds: 60000,
  CompletionMilliseconds: 50,
  DeadlineMinutes: 1 / 60,
} as const;

export const StreamDescriptorFixture = { Iterations: 32, Directory: "/proc/self/fd" } as const;

export enum NativeStreamOutcome {
  CloseFailure = "close_failure",
  Complete = "complete",
  Failure = "failure",
  Malformed = "malformed",
  Cancel = "cancel",
  Close = "close",
  Abort = "abort",
}

export enum VendorPreparationFixture {
  Source = "source",
  Missing = "missing",
  Malformed = "malformed",
}

export enum NativeSetupFixture {
  Owner = "owner",
  Validation = "validation",
  Dispatch = "dispatch",
  Legacy = "legacy",
  Exhausted = "exhausted",
}

export const NativeSetupDelivery = { Steps: ["first", "second"] } as const;

export const CliCatalogFixture = {
  File: "../fixtures/cli-catalog.json",
  MaximumBytes: 32768,
  FunctionType: "function",
  FunctionMarker: "<function>",
} as const;

export const GroupExecutionFixture = { AnswerMilliseconds: 200 } as const;

export enum EventLogFixture {
  Created = "created",
  Legacy = "legacy",
  Replaced = "replaced",
  Directory = "directory",
  Symbolic = "symbolic",
}

export enum ArtifactResultFixture {
  LegacyOrdinary = "legacy-ordinary",
  LegacyExecutable = "legacy-executable",
  Downgrade = "downgrade",
  Attempts = "attempts",
}

export enum WorkflowSourceFixture {
  Yaml = "yaml",
  Json = "json",
  Missing = "missing",
  Mismatch = "mismatch",
  Relative = "relative",
  TooLarge = "too-large",
  Changed = "changed",
}

export enum WorkflowExample {
  CodeFix = "code-fix",
  ScienceClaim = "science-claim",
  BusinessPlan = "business-plan",
  EverydayProblem = "everyday-problem",
}
export enum ExampleMutation {
  None = "none",
  Missing = "missing",
  Malformed = "malformed",
}
export const ExampleFixture = {
  WorkflowSuffix: ".yaml",
  AnswersSuffix: ".answers.yaml",
} as const;

export enum ExampleCheckMutation {
  None = "none",
  Invalid = "invalid",
  Missing = "missing",
  Empty = "empty",
  Count = "count",
  Output = "output",
}

export enum SubmissionReceiptFixture {
  Damaged = "damaged",
  Directory = "directory",
  Generated = "generated",
  Explicit = "explicit",
  Independent = "independent",
  Concurrent = "concurrent",
  Conflict = "conflict",
  Ambiguous = "ambiguous",
  Full = "full",
  Invalid = "invalid",
}

export const McpSubmissionFixture = { AcceptanceMilliseconds: 1000 } as const;

export enum CliObservationFault {
  None = "none",
  Events = "events",
  State = "state",
  Unexpected = "unexpected",
}

export const McpStdioFixture = {
  RpcVersion: "2.0",
  ProtocolVersion: "2024-11-05",
  Initialize: "initialize",
  Initialized: "notifications/initialized",
  ToolsList: "tools/list",
  ToolCall: "tools/call",
  UnknownMethod: "unknown-method",
  InitializationId: 1,
  RequestId: 2,
  FrameCount: 2,
} as const;

export enum HostReadinessMode {
  Accepted = "accepted",
  Refused = "refused",
  RateLimited = "rate-limited",
  Aborted = "aborted",
  MissingBinding = "missing-binding",
  Duplicate = "duplicate",
  EarlyAnswer = "early-answer",
  EarlyEvent = "early-event",
  PendingAnswer = "pending-answer",
}

export const HostReadinessFixture = {
  Probe: "testing/fixtures/host-readiness.mjs",
  Session: "native-ready-fixture",
  WaitMilliseconds: 10,
  RetryMilliseconds: 50,
} as const;

export const CrashResumeFixture = {
  Cause: "cause",
  Fix: "fix",
  Client: "crash-resume",
  Submission: "preserve-completed-step",
  Attempt: 1,
} as const;

export enum GraphValidationMode {
  Mixed = "mixed",
  Reversed = "reversed",
  Groups = "groups",
  Cycle = "cycle",
  Input = "input",
  Forms = "forms",
  Missing = "missing",
  Duplicate = "duplicate",
  GroupNeeds = "group-needs",
}

export const GraphValidationFixture = {
  Source: "workflow.yaml",
  Home: "home",
  Project: "project",
  First: "a",
  Left: "b",
  Right: "c",
  Branch: "d",
  Join: "e",
  Missing: "absent",
  Input: "source",
  Reference: "b.output",
} as const;

export const RunCompatibilityFixture = {
  Home: "home",
  Project: "project",
  Workflow: "workflow.yaml",
  Answers: "answers.yaml",
  Source: "source.txt",
  Content: "Preserve the original project\n",
  Session: "compatibility/caller",
  Tail: '{"id":',
  Future: Math.max(...Object.values(RunFormat)) + 1,
  DistantFuture: 99,
  RecoveryGuide: "docs/preview.md",
  RecoveryInstruction: "Use the installed release",
} as const;

export enum RuntimePinMutation {
  None = "none",
  Release = "release",
  Missing = "missing",
  Downgrade = "downgrade",
  Empty = "empty",
}
export const RuntimePinFixture = {
  Home: "home",
  Client: "runtime-pin-client",
  OtherRelease: "0.0.0-incompatible",
  Tail: '{"id":',
  RecoveryInstruction: "Use the installed release",
} as const;

export enum OfflineSelectorFixtureMode {
  Normal = "normal",
  Empty = "empty",
  ExternalLink = "external-link",
  InternalLink = "internal-link",
  DirectoryLink = "directory-link",
  DanglingLink = "dangling-link",
}
export const OfflineSelectorFixture = {
  First: "testing/unit/first.test.ts",
  Second: "testing/unit/second.test.ts",
  Integration: "testing/integration/first.test.ts",
  EndToEnd: "testing/e2e/first.test.ts",
  Missing: "testing/unit/missing.test.ts",
  NonTest: "testing/unit/notes.md",
  Outside: "outside.test.ts",
  Linked: "testing/unit/linked.test.ts",
  Marker: "executed",
  Content: "executed",
  Token: "__TITAN_TEST_MARKER__",
  OutputBytes: 2 * 1024 * 1024,
  OutputStart: "TITAN_OUTPUT_START",
  OutputEnd: "TITAN_OUTPUT_END",
  OutputFill: "x",
  OutputProgram:
    'import { test, expect } from "bun:test"; test("output witness", async () => { await Bun.write(__STREAM__, __PAYLOAD__); expect(__FAIL__).toBe(false); });',
  Program:
    'import { test } from "bun:test"; import { writeFile } from "node:fs/promises"; test("execution witness", async () => { await writeFile(__TITAN_TEST_MARKER__, Buffer.from("executed")); });',
} as const;

export const OperationalPeerFixture = {
  Peer: "peer",
  Target: "deliver",
  Client: "operational-peer",
  Submission: "independent-progress",
  ExitEvidence: /exit.*7/i,
  Source: "source.txt",
  Original: "Original project content",
  Delivered: "DELIVERED.txt",
  Content: "Delivered by SDK stub",
  Allowance: 1,
  Parallel: 1,
  Attempt: 1,
} as const;

export const FinalAttemptFixture = {
  Attempt: 3,
  Refutations: 2,
  RetryDelayMilliseconds: 60_000,
  Client: "final-attempt",
  Submission: "native-rate-limit",
  Evidence: ["Rejected candidate on attempt 1", "Rejected candidate on attempt 2"],
} as const;

export const FakeDefaultFixture = { MissingProfile: "default" } as const;

export const SourceDescriptorFixture = {
  Empty: "empty.bin",
  Content: "content.bin",
  Null: "/dev/null",
  Zero: "/dev/zero",
  Directory: ".",
  Contents: "Regular snapshot data",
  Bytes: 128,
} as const;
