export enum RunEventKind {
  GoalStarted = "goal_started",
  GoalCompleted = "goal_completed",
  CheckAnswered = "check_answered",
  ScriptStarted = "script_started",
  ScriptCompleted = "script_completed",
  JournalCompleted = "journal_completed",
  FileAccessWaiting = "file_access_waiting",
  FileAccessAcquired = "file_access_acquired",
  FileAccessBound = "file_access_bound",
  FileAccessRevised = "file_access_revised",
  FileWriteInputCaptured = "file_write_input_captured",
  FileAccessReleased = "file_access_released",
  FileAccessWithdrawn = "file_access_withdrawn",
  ExecutionDeferred = "execution_deferred",
  HubRead = "hub_read",
  HubWrote = "hub_wrote",
  RequestTurnOpened = "request_turn_opened",
  Waiting = "run_waiting",
  RequestEscalated = "passed_up",
  RequestOpened = "request_opened",
  RequestAnswered = "request_answered",
  RequestRefused = "request_refused",
  Decision = "decision",
  Created = "run_created",
  Restart = "engine_restart",
  StepRestarted = "step_restarted",
  Started = "run_started",
  Blocked = "run_blocked",
  PauseRequested = "pause_requested",
  Paused = "run_paused",
  Cancelled = "run_cancelled",
  TimedOut = "run_timed_out",
  Failed = "run_failed",
  Passed = "run_passed",
  StepSkipped = "step_skipped",
  StepAdded = "step_added",
  PersonaPicked = "persona_picked",
  StatementLocked = "statement_locked",
  StepBlocked = "step_blocked",
  AttemptStarted = "attempt_started",
  StepPassed = "step_passed",
  StepFailed = "step_failed",
  ResultRefuted = "result_refuted",
  ResultJudged = "result_judged",
  KnowledgeAdded = "knowledge_added",
  KnowledgeUndone = "knowledge_undone",
  ExecutionStarted = "execution_started",
  ExecutionDispatching = "execution_dispatching",
  AgentEvent = "agent_event",
  PhaseReceived = "phase_received",
  HelperStarted = "helper_started",
  ReconciliationStarted = "reconciliation_started",
  PhaseCaptured = "phase_captured",
  PhaseCompleted = "phase_completed",
  ExecutionBlocked = "execution_blocked",
  ExecutionRecovering = "execution_recovering",
}
export const FileAccessQueue = "file-access";
export const FileWriteScope = { Operation: "file_write", InputPrefix: "write-input-" } as const;

export enum FileAccessMode {
  Read = "read",
  Write = "write",
}
export const ProgramRun = {
  PollMilliseconds: 5,
  UuidPattern: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
  IdMark: "<id>",
  PersonasField: "personas",
  BackendField: "backend",
  WorkflowFile: "example.yaml",
  Persona: "checker",
} as const;
export enum ProgramFault {
  None = "none",
  Persona = "persona",
  Handle = "handle",
  Resume = "resume",
  Answer = "answer",
  Submission = "submission",
  Run = "run",
  NoBackend = "no-backend",
  Follow = "follow",
  Ended = "ended",
  EndedSlow = "ended-slow",
}
export const ProgramCheck = {
  Project: "project",
  Note: "note.txt",
  Flow: "flow",
  ClientId: "program",
  SubmissionId: "program-1",
  CliClientId: "cli",
  CliSubmissionId: "cli-1",
  HttpClientId: "http",
  HttpSubmissionId: "http-1",
  MissingRun: "missing",
  Ghost: "ghost",
  Constructor: "constructor",
  PrototypeMethod: "toString",
  PageLimit: 2,
  SlowMilliseconds: 40,
} as const;
export const StepCap = {
  Resource: "max_steps",
  Operation: "raise_limit",
  ExpiresMs: 604800000,
} as const;
export enum ExecutionDelivery {
  Prepared = "prepared",
  Uncertain = "uncertain",
}

export const ScriptCheckFixture = { Script: "check", Folder: "." } as const;
export enum ScriptCheckCase {
  FirstOnly = "a first candidate with two equal passes is proven",
  Failing = "a failing script is not proven with its output",
  Changing = "a script that passes then fails is not proven",
  ChangingBack = "a script that fails then passes is not proven",
  Later = "a later candidate runs the script once",
  LaterFailing = "a later candidate that fails is not proven",
  Twice = "a first candidate with two failures is not proven after two runs",
}
export enum Verdict {
  Survived = "survived",
  Refuted = "refuted",
}
export enum JudgeWinner {
  First = "A",
  Second = "B",
}
export const ExecutionPhase = {
  Worker: "worker",
  FalsifierPrefix: "falsifier-",
  PartPrefix: "part-",
  HelperPrefix: "helper-",
} as const;
export const SplitInput = { Part: "part", Index: "part_index" } as const;
export const GoalExecution = { Id: "$goal", Directory: "goal", Attempt: 1 } as const;
export const ProofReportFormat = {
  Version: 1,
  Step: "step",
  Goal: "goal",
  Scope: "scope",
  Candidate: 1,
} as const;
export const RunFile = {
  Workflow: "workflow.yaml",
  Config: "effective-config.json",
  Candidate: "candidate",
  CandidateHash: "candidate.hash",
  Artifacts: "artifacts",
  Steps: "steps",
  Input: "input",
  Work: "work",
  AttemptPrefix: "attempt-",
  ReviewPrefix: "review-",
  ReconciliationPrefix: "reconciliation-",
  ReconciliationCandidatePrefix: "worker-reconciliation-",
  TaskSuffix: ".task.json",
} as const;
export const FileReconciliation = {
  Operation: "preserve_concurrent_files",
  Prefix: "files-",
  ExpiresMs: 604800000,
} as const;
export const ScriptExecution = {
  ProofTimeoutSeconds: 300,
  CaptureSuffix: ".capture.json",
  PhasePattern: /^(worker|check-(0|[1-9]\d*)|proof-(0|[1-9]\d*)-(0|1)|falsifier-(0|[1-9]\d*))$/,
  Operation: "execute_script",
  RequestPrefix: "script-",
  CheckPrefix: "check-",
  ProofPrefix: "proof-",
  ProofSeparator: "-",
  MillisecondsPerSecond: 1000,
  ProofFirst: 0,
  ProofRepeat: 1,
  ProofResultPrefix: "proof-result-",
  ProofOutputSuffix: ".json",
  Shell: ["/bin/sh", "-c"],
  ExpiresMs: 604800000,
} as const;
export enum FailureKind {
  DisobeyTask = "disobey-task",
  DisobeyRole = "disobey-role",
  StepRepetition = "step-repetition",
  LostHistory = "lost-history",
  UnawareOfStop = "unaware-of-stop",
  ConversationReset = "conversation-reset",
  NoClarification = "no-clarification",
  TaskDerailment = "task-derailment",
  InformationWithholding = "information-withholding",
  IgnoredInput = "ignored-input",
  ReasoningActionMismatch = "reasoning-action-mismatch",
  PrematureTermination = "premature-termination",
  IncompleteVerification = "incomplete-verification",
  IncorrectVerification = "incorrect-verification",
  Other = "other",
}
const FalsifierProperties = {
  verdict: { type: "string", enum: [Verdict.Survived, Verdict.Refuted] },
  evidence: { type: "string" },
  failure: { type: "string", enum: Object.values(FailureKind) },
};
export const FalsifierOutput = {
  type: "object",
  properties: FalsifierProperties,
  required: ["verdict", "evidence", "failure"],
  additionalProperties: false,
};
