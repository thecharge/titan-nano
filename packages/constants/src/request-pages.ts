export const RequestPageLimit = {
  Version: 1,
  Count: 20,
  Maximum: 100,
  Runs: 16,
  Bytes: 1024 * 1024,
  CursorCharacters: 1024,
  QueryBytes: 16 * 1024,
  EnvelopeBytes: 32 * 1024,
  ProjectCharacters: 4096,
} as const;

export const RequestPageFormat = {
  Route: "/requests",
  CursorEncoding: "base64url",
  CursorPattern: /^[A-Za-z0-9_-]+$/,
} as const;

export const RequestPageSql = {
  Run: "SELECT rowid AS sequence,id,root,client AS client_id FROM runs WHERE id = ? AND rowid < ? LIMIT 1",
} as const;

export enum RequestPageFixture {
  EscalatedWaiting = "escalated_waiting",
  EscalatedAnswered = "escalated_answered",
  Plain = "plain",
  Count = "count",
  Bytes = "bytes",
  Scan = "scan",
  Filters = "filters",
  SingleRun = "single_run",
  ChangedCount = "changed_count",
  Restart = "restart",
  Unavailable = "unavailable",
  WrongRun = "wrong_run",
  Capacity = "capacity",
  OversizedRecord = "oversized_record",
  BadProject = "bad_project",
  BadLimit = "bad_limit",
  BadCursor = "bad_cursor",
  ChangedFilter = "changed_filter",
  MissingCursorRun = "missing_cursor_run",
  MissingCursorRequest = "missing_cursor_request",
  UnknownQuery = "unknown_query",
}

export enum RequestPageTransport {
  Http = "http",
  Cli = "cli",
  Mcp = "mcp",
}

export enum RequestPageSurface {
  All = "all",
  Run = "run",
  Answered = "answered",
  Sessions = "sessions",
  Project = "project",
  Unknown = "unknown",
  InvalidLimit = "invalid_limit",
  Duplicate = "duplicate",
  Method = "method",
}

export enum RequestPageClientFixture {
  Selected = "selected",
  Empty = "empty",
  Malformed = "malformed",
  Query = "query",
  Caller = "caller",
  Session = "session",
  Project = "project",
  Run = "run",
  State = "state",
  Count = "count",
  Cursor = "cursor",
  Duplicate = "duplicate",
  Bytes = "bytes",
  Input = "input",
  Accessor = "accessor",
}
