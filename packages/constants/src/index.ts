export enum Backend {
  Codex = "codex-sdk",
  Claude = "claude-sdk",
  Fake = "fake",
}
export const HarnessBackends = {
  codex: Backend.Codex,
  claude: Backend.Claude,
  fake: Backend.Fake,
} as const;
export const backendIds = [Backend.Codex, Backend.Claude, Backend.Fake] as const;
export enum ExitCode {
  Success = 0,
  Unsuccessful = 1,
  Input = 2,
  Blocked = 3,
  Transport = 4,
  Interrupted = 130,
}
export enum RunStatus {
  Waiting = "waiting",
  Running = "running",
  Recovering = "recovering",
  Blocked = "blocked",
  Pausing = "pausing",
  Paused = "paused",
  Passed = "passed",
  Failed = "failed",
  Cancelled = "cancelled",
  TimedOut = "timed_out",
}
export const runStatuses = [
  RunStatus.Waiting,
  RunStatus.Running,
  RunStatus.Recovering,
  RunStatus.Blocked,
  RunStatus.Pausing,
  RunStatus.Paused,
  RunStatus.Passed,
  RunStatus.Failed,
  RunStatus.Cancelled,
  RunStatus.TimedOut,
] as const;
export enum StepStatus {
  Waiting = "waiting",
  Pending = "pending",
  Running = "running",
  Blocked = "blocked",
  Passed = "passed",
  Failed = "failed",
  SkippedDependency = "skipped_dependency",
}
export const stepStatuses = [
  StepStatus.Waiting,
  StepStatus.Pending,
  StepStatus.Running,
  StepStatus.Blocked,
  StepStatus.Passed,
  StepStatus.Failed,
  StepStatus.SkippedDependency,
] as const;
export const BackendContractVersion = "titan-backend-v1";

export * from "./agent-host.ts";
export * from "./agents.ts";
export * from "./approval-policy.ts";
export * from "./artifacts.ts";
export * from "./board.ts";
export * from "./catalog-decisions.ts";
export * from "./cli.ts";
export * from "./cli-output.ts";
export * from "./cli-positionals.ts";
export * from "./command-capture.ts";
export * from "./concurrency.ts";
export * from "./config.ts";
export * from "./credentials.ts";
export * from "./dashboard.ts";
export * from "./development.ts";
export * from "./document-links.ts";
export * from "./documentation.ts";
export * from "./embedder.ts";
export * from "./errors.ts";
export * from "./formatting.ts";
export * from "./graph-testing.ts";
export * from "./harness-detection.ts";
export * from "./hooks.ts";
export * from "./improve-rounds.ts";
export * from "./improved-files.ts";
export * from "./improvement.ts";
export * from "./improver.ts";
export * from "./io.ts";
export * from "./knowledge.ts";
export * from "./knowledge-attempts.ts";
export * from "./knowledge-view.ts";
export * from "./lean-check.ts";
export * from "./lessons.ts";
export * from "./lint.ts";
export * from "./live-testing.ts";
export * from "./live-workspace-testing.ts";
export * from "./local-model.ts";
export * from "./logging.ts";
export * from "./messages.ts";
export * from "./native-events.ts";
export * from "./native-phase.ts";
export * from "./native-tool-bridge.ts";
export * from "./native-tools.ts";
export * from "./offline.ts";
export * from "./package-direction.ts";
export * from "./packaging.ts";
export * from "./persona-lifecycle.ts";
export * from "./plans.ts";
export * from "./policy.ts";
export * from "./policy-alarms.ts";
export * from "./prerequisites.ts";
export * from "./request-escalation.ts";
export * from "./request-mcp.ts";
export * from "./request-pages.ts";
export * from "./request-testing.ts";
export * from "./request-transport.ts";
export * from "./request-waiting.ts";
export * from "./requests.ts";
export * from "./run-hub.ts";
export * from "./runner.ts";
export * from "./runtime.ts";
export * from "./schemas.ts";
export * from "./script-sandbox.ts";
export * from "./server.ts";
export * from "./server-startup.ts";
export * from "./source-comments.ts";
export * from "./spelling.ts";
export * from "./split-testing.ts";
export * from "./statements.ts";
export * from "./step-start.ts";
export * from "./store.ts";
export * from "./submissions.ts";
export * from "./test-process.ts";
export * from "./test-structure.ts";
export * from "./testing.ts";
export * from "./transport.ts";
export * from "./unused.ts";
export * from "./updates.ts";
export * from "./usage-limit.ts";
export * from "./verification.ts";
export * from "./width-learner.ts";
export * from "./workflow.ts";
export * from "./workflow-features.ts";
export * from "./workspace.ts";
