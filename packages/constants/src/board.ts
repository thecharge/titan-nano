export const BoardFile = {
  Journal: "board.jsonl",
  State: "state.json",
  Events: "events.jsonl",
  Base: "base",
  Runs: ".titan/runs",
  Steps: "/steps/",
} as const;
export const BoardLimit = {
  EventPageVersion: 1,
  RecordBytes: 16 * 1024 * 1024,
  EventPageSize: 1000,
  EventPageBytes: 1024 * 1024,
} as const;
export const EventCursor = {
  After: "after",
  Limit: "limit",
  IntegerPattern: /^(0|[1-9]\d*)$/,
  Separator: "?",
} as const;
export const BoardParty = { Titan: "titan" } as const;
export const BoardDecision = { Kind: "decision", WithinLimits: "within limits" } as const;
export const BoardPostKind = {
  Answer: "answer",
  Refused: "refused",
  Dropped: "dropped",
  StepAdded: "step_added",
  PersonaPicked: "persona_picked",
} as const;
export const BoardLoad = {
  Writers: 8,
  PostsPerWriter: 2000,
  Concurrency: 8,
  TimeoutMs: 900000,
} as const;
export const BoardTalk = {
  Fixer: "fixer",
  Investigator: "investigator",
  Planner: "planner",
  Skeptic: "skeptic",
  RequestId: "board-question",
  Question: "What failed?",
  Answer: "The parser",
  ExpiresMs: 60000,
  Event: "fixture_event",
  UnknownKind: "delete_files",
  OtherUnknownKind: "format_disk",
  Split: ",",
  Arrow: ">",
  Colon: ":",
  Torn: '{"torn":',
} as const;
export const Newline = "\n";
export const RunFormat = {
  Legacy: 1,
  ExecutionRequests: 2,
  RequestTurns: 3,
  CallerSessions: 4,
  PinnedRuntime: 5,
  CaptureReceipts: 6,
  FileObservations: 7,
  ReadClaims: 8,
  Reconciliation: 9,
  WriteClaims: 10,
  PersonaBindings: 11,
  HelperTurns: 12,
  PersonaAnswers: 13,
  ScriptProofs: 14,
  ProofReports: 15,
  GoalProofs: 16,
  ProofCaptures: 17,
  PinnedBuild: 18,
} as const;

export const RunResultFormat = { FailureVersion: 1, PassedVersion: 1, ProofVersion: 2 } as const;
