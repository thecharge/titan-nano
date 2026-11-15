export const ProgramMessage = {
  UnknownPersona: (name: string): string => `backend names persona "${name}" the workflow lacks`,
  BackendMissing: "No backend was given and the settings name no default backend",
  NotStarted: "The run handle was not made by runWorkflow",
};
export const RunnerMessage = {
  FileClaim: "Execution does not own the current live file claim",
  FileReadClaims: "Observed dependencies exceed the live file claim allowance",
  FileWriteClaims: "Requested write paths exceed the live file claim allowance",
  FileScopeChanged: "Write scope changed; release and reacquire the complete live claim",
  FileWriteScope: "Write scope requires an approved worker request for a permitted project path",
  CapturePending:
    "Worker result was received but its file checkpoint is incomplete; preserve the result and reconcile current files before continuing",
  ReconcileReceived:
    "Reconcile the retained worker result with the current shared project. Read the original input, retained result and current input evidence provided in reconciliation. Preserve external edits and reuse completed work. Produce the requested output against the current files. The original worker command has already completed. Any further changes require fresh independent checks.",
  FileReconciliation:
    "Preserve concurrent edits and rebuild the refused attempt from the current shared files",
  PassedResultPrefix: "# Checked workflow\n\n```json\n",
  FailedResultPrefix: "# Failed workflow\n\n```json\n",
  FailedResultSuffix: "\n```\n",
  ProofSummary: (proven: number, total: number): string => `\nproven ${proven} of ${total}\n`,
  FailureKindsHeading: "\n## Failure kinds\n\n",
  FailureKindLine: (kind: string, count: number): string => `- ${kind}: ${count}\n`,
  RecoveryScheduled: "Execution stopped and retained for its recorded retry date",
  UsageLimit: "Usage limit reached; the step waits for its recorded reset time",
  UsageHistory: "Usage history is inconsistent with its run and phase accounting",
  Capacity:
    "Active and backend agent limits must be positive; pending capacity must fit its schema budget",
  PendingCapacity: "Agent wait queue is full; resume after queued work has drained",
  StepLimit: "Plan exceeds limits.max_steps",
  StepRefused: "Step refused: the plan already holds limits.max_steps steps",
  RaiseLimit: "Raise limits.max_steps",
  NoFalsifier: "every step needs at least one falsifier",
  ScriptPending: "Scripts require scoped approval support, which is not built yet",
  ExistingRun: "Refusing to replace an existing run record",
  RunPath: "Run root does not match durable record",
  Restart: "Previous engine stopped; explicitly resume this run",
  ResidentCapacity: "All resident run slots are active",
  RunNotFound: "Run not found",
  StoreNotFound: "Run store not found",
  TerminalRun: "A terminal run requires a new submission",
  TerminalPause: "Cannot pause a terminal run",
  Pause: "pause requested",
  Cancel: "run cancelled",
  InputCheckpoint: "Attempt input snapshot differs from verified run inputs",
  BaseChanged: "Run input snapshot was changed",
  AssemblyCycle: "Cannot assemble dependency snapshots",
  Deadline: "run deadline",
  MissingVerdict: "Falsifier returned no verdict",
  SplitNotList: "split.parts must name an output that is a list",
  SessionUnavailable: "No durable native session ID; refusing to start the invocation over",
  RecoveryExhausted: "Recovery allowance exhausted; prior retries remain spent",
  ScriptApproval: "Script execution requires approval for its exact command and working directory",
  ScriptCaptureChanged: "Retained script capture does not match its committed metadata",
  GoalChanged: "Final files changed during goal verification. Current files were preserved",
  Reconstruction: "No native session was recorded; reconstruction is pending",
  Aborted: "execution aborted",
  WorkerOutput: "Worker output does not match its declared formats",
  VerdictObject: "Falsifier answer is not an object",
  ScriptExit: "Script falsifier exited with a nonzero code",
  ScriptDiffers: "the script gave two different answers",
  ProofUnavailable: "The selected formal proof checker is not connected to workflow execution",
  StatementChanged: "the locked statement changed",
  StatementDenied: "the lock_statement request was denied",
  InvalidVerdict: "Falsifier answer has no valid verdict and evidence",
  InvalidJudgement: "Judge answer has no valid winner and reason",
} as const;
export const leanTimeLimit = (seconds: number): string => `time limit of ${seconds} s reached`;
export const fileConflict = (path: string, owner: string, step: string): string =>
  `${path}: conflict between ${owner} and ${step}`;
export const stepsDropped = (from: string, ids: readonly string[]): string =>
  `${from}: result refuted, steps dropped: ${ids.join(", ")}`;
export const stepReference = (step: string, reference: string): string => `${step}: ${reference}`;
export const invocationId = (step: string, attempt: number, phase: string): string =>
  `${step}/${attempt}/${phase}`;
export const resultDocument = (name: string, goal: string, outputs: unknown): string =>
  `# ${name}\n\n${goal}\n\n${JSON.stringify(outputs, null, 2)}\n`;
export const executionFailure = (code: string, message: string): string => `${code}: ${message}`;

export const rollbackConflict = (path: string): string =>
  `${path}: rollback stopped because the file changed after the attempt; current user data and attempt snapshots were preserved`;

export const liveCandidateConflict = (path: string): string =>
  `${path}: live files differ from the retained candidate; no checked result was published and current files were preserved`;
