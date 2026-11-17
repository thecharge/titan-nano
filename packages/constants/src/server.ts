import { ServerCredential } from "./credentials.ts";
import { KnowledgeFile } from "./knowledge.ts";
import { KnowledgeAttemptFile } from "./knowledge-attempts.ts";
import { TitanRelease } from "./runtime.ts";
import { LocalServer } from "./transport.ts";

export const ServerFile = {
  Lock: "server.lock",
  Owner: "owner.json",
  Lease: "server-writer.db",
  MaintenanceLease: "update-writer.db",
  Database: "runs.db",
} as const;
export const ServerRuntimePaths = [
  ServerFile.Lock,
  LocalServer.File,
  ServerCredential.PersonFile,
  KnowledgeFile.Directory,
  KnowledgeAttemptFile.Directory,
  ...[
    ServerFile.Database,
    ServerFile.Lease,
    ServerFile.MaintenanceLease,
    KnowledgeFile.Database,
    KnowledgeFile.Lease,
  ].flatMap((path) => KnowledgeFile.SqliteSidecars.map((suffix) => path + suffix)),
];
export const DaemonStartup = {
  CliEntry: "./main.ts",
  TimeoutMilliseconds: 5000,
  ProbeMilliseconds: 250,
  PollMilliseconds: 25,
} as const;
export const ServerRoute = {
  Health: "/health",
  Stop: "/maintenance/stop",
  Stream: "stream",
  Pattern:
    /^\/runs\/([^/]+)(?:\/(events|stream|usage|config|artifacts|resume|pause|cancel)(?:\/([^/]+))?)?$/,
} as const;
export const ServerLimit = {
  IdentityCharacters: 128,
  RunPageSize: 50,
  CompactSnapshotAttempts: 3,
  KnownHomePageSize: 50,
  RunPageMaximum: 200,
  SummaryCharacters: 4096,
  RunPageVersion: 1,
  FilteredRunPageVersion: 2,
  DirectoryMode: 0o700,
  FileMode: 0o600,
  IdleSeconds: 30,
  RequestBytes: 1024 * 1024,
} as const;
export const ServerState = {
  InitializationIncomplete: "initialization_incomplete",
  ReadUnavailable: "read_unavailable",
} as const;
export const ServerCode = {
  Unauthorized: "unauthorized",
  NotFound: "not_found",
  Internal: "server_error",
} as const;
export enum HttpStatus {
  Ok = 200,
  Created = 201,
  SeeOther = 303,
  BadRequest = 400,
  MethodNotAllowed = 405,
  Conflict = 409,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  Internal = 500,
  Unavailable = 503,
}
export enum SqlMethod {
  Unsafe = "unsafe",
}
export const ServerSql = {
  ClaimWriter: ["PRAGMA busy_timeout=250", "BEGIN EXCLUSIVE"],
  Initialize: [
    "PRAGMA journal_mode=WAL",
    "PRAGMA synchronous=FULL",
    "CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, root TEXT UNIQUE NOT NULL, client TEXT NOT NULL, submission TEXT NOT NULL, request_hash TEXT NOT NULL, UNIQUE(client,submission))",
    "CREATE TABLE IF NOT EXISTS run_summaries (id TEXT PRIMARY KEY, size INTEGER NOT NULL, stamp REAL NOT NULL, summary TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS run_numbers (id TEXT PRIMARY KEY, size INTEGER NOT NULL, stamp REAL NOT NULL, numbers TEXT NOT NULL)",
  ],
  NumbersGet: "SELECT size,stamp,numbers FROM run_numbers WHERE id = ?",
  NumbersPut: "INSERT OR REPLACE INTO run_numbers VALUES (?,?,?,?)",
  SummaryGet: "SELECT size,stamp,summary FROM run_summaries WHERE id = ?",
  SummaryPut: "INSERT OR REPLACE INTO run_summaries VALUES (?,?,?,?)",
  Root: "SELECT root FROM runs WHERE id = ?",
  Stored: "SELECT id,root FROM runs ORDER BY rowid",
  List: "SELECT rowid AS sequence,id,root,client AS client_id FROM runs WHERE rowid < ? ORDER BY rowid DESC LIMIT ?",
  ListClient:
    "SELECT rowid AS sequence,id,root,client AS client_id FROM runs WHERE client = ? AND rowid < ? ORDER BY rowid DESC LIMIT ?",
  Submission: "SELECT id,root,request_hash FROM runs WHERE client = ? AND submission = ?",
  Insert: "INSERT INTO runs VALUES (?,?,?,?,?)",
} as const;
export const McpIdentity = {
  Name: "titan",
  Version: TitanRelease,
  Text: "text",
  Schema: "titan_schema",
  Check: "titan_check",
  Run: "titan_run",
  Runs: "titan_runs",
  Events: "titan_events",
  Usage: "titan_usage",
  Config: "titan_config",
  Artifacts: "titan_artifacts",
  Artifact: "titan_artifact",
  RequestOpen: "titan_request_open",
  RequestRead: "titan_request_read",
  RequestAnswer: "titan_request_answer",
  RequestEscalate: "titan_request_escalate",
  Requests: "titan_requests",
  Prefix: "titan_",
} as const;

export const ServerDatabaseAdapter = "sqlite";
export const MissingProcessCode = "ESRCH";

export enum SummaryCase {
  Same,
  Appended,
  NoCache,
  Missing,
}

export const SummaryTest = {
  Id: "summary-run",
  Client: "summary-client",
  Workflow: "summary-workflow",
  Project: "/project",
  Database: "summary.db",
  Journal: "one line\n",
  Extra: "two lines\n",
  Folder: "run",
  Sequence: 1,
} as const;

export const KnownHome = {
  BusyTimeout: "PRAGMA busy_timeout=5000",
  Scope: "known-home",
  File: "known-homes.sqlite",
  NullByte: "\0",
  Create: "CREATE TABLE IF NOT EXISTS homes (path TEXT PRIMARY KEY NOT NULL)",
  Insert: "INSERT OR IGNORE INTO homes (path) VALUES (?)",
  Page: "SELECT path FROM homes WHERE path > ? ORDER BY path LIMIT ?",
} as const;
