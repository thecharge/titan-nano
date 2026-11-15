export enum KnowledgeKind {
  Persona = "persona",
  Prompt = "prompt",
  Tool = "tool",
  Skill = "skill",
  Lesson = "lesson",
  Fact = "fact",
  Data = "data",
  Plan = "plan",
}

export enum KnowledgeCommand {
  Add = "add",
  Get = "get",
  Update = "update",
  Delete = "delete",
  Search = "search",
  Reindex = "reindex",
  Promote = "promote",
  List = "list",
  Stats = "stats",
  Show = "show",
  Prune = "prune",
  Consolidate = "consolidate",
  Restore = "restore",
}
export enum KnowledgeMaintenanceReason {
  Duplicate = "duplicate",
  Unread = "old_and_never_read",
  Replaced = "replaced_version",
}
export const KnowledgeMaintenance = {
  OldMilliseconds: 90 * 24 * 60 * 60 * 1000,
  SourceHeading: "Sources",
} as const;
export enum KnowledgeServerCommand {
  History = "history",
}

export enum KnowledgeTransport {
  Http = "http",
  Cli = "cli",
  Mcp = "mcp",
}
export enum KnowledgeHttpFixture {
  Get = "get",
  Search = "search",
  Malformed = "malformed",
  Invalid = "invalid",
  Method = "method",
  Query = "query",
  Unauthorized = "unauthorized",
  Origin = "origin",
  Stale = "stale",
  Missing = "missing",
  Persona = "persona",
}
export enum KnowledgeFileFixture {
  Intact = "intact",
  Rebuild = "rebuild",
  Journal = "journal",
  Before = "before",
  Entry = "entry",
  MalformedEntry = "malformed_entry",
  LinkedJournal = "linked_journal",
  LinkedDatabase = "linked_database",
  SharedDatabase = "shared_database",
}

export enum KnowledgeTamper {
  None = "none",
  DropIndex = "drop_index",
  DropHistory = "drop_history",
}

export enum KnowledgeCliScopeCase {
  DefaultAdd = "default-add",
  HomeAdd = "home-add",
  BadScope = "bad-scope",
  Promote = "promote",
  PromoteTwice = "promote-twice",
  PromoteMissing = "promote-missing",
  Search = "search",
  UpdateHome = "update-home",
  DeleteProject = "delete-project",
  Stats = "stats",
  StatsAfterRead = "stats-after-read",
  ShowMention = "show-mention",
  ShowMissing = "show-missing",
  List = "list",
  ListBadLimit = "list-bad-limit",
  WaitsForProject = "waits-for-project",
  ProjectIsFile = "project-is-file",
  ShowTagged = "show-tagged",
}

export enum KnowledgeLimitField {
  Entries = "max_entries",
  EntryBytes = "max_entry_bytes",
  IndexBytes = "max_index_bytes",
  TotalBytes = "max_total_bytes",
}

export enum KnowledgeScope {
  Project = "project",
  Home = "home",
}

export const KnowledgePromote = { SourceTag: "promoted-from:" } as const;

export enum KnowledgePromoteCase {
  Text = "text",
  Source = "source",
  ProjectKept = "project-kept",
  Duplicate = "duplicate",
  DuplicateMessage = "duplicate-message",
  DuplicateKept = "duplicate-kept",
  Missing = "missing",
}

export const KnowledgeScopeFixture = {
  HoldMilliseconds: 300,
  TwoScopes: "2",
  Blocker: "blocker.txt",
  Project: "project",
  Cloned: "cloned",
  Home: "home",
  Elsewhere: "elsewhere",
  UtcTitle: "UTC",
  UtcBody: "Keep the time in UTC",
  ZoneTitle: "time zones",
  ZoneBody: "Check time zones first",
  Question: "time",
  UtcQuestion: "UTC",
  Joiner: ":",
  Rows: "|",
  Nothing: "none",
  Missing: "zebra",
  Limit: 1,
  Refused: "refused",
  Reopened: "reopened",
  Opened: "opened",
  Truncated: "truncated",
  Complete: "complete",
  NotFile: "not-a-directory",
} as const;

export enum KnowledgeScopeSeed {
  Both = "both",
  ProjectOnly = "project-only",
  HomeOnly = "home-only",
  Neither = "neither",
  Shared = "shared",
}

export enum KnowledgeScopeLookup {
  Project = "project",
  Home = "home",
  Missing = "missing",
  List = "list",
  Limited = "limited",
}

export enum KnowledgeSearchMode {
  Words = "words",
  Meaning = "meaning",
  Both = "both",
}

export enum KnowledgePendingOperation {
  Add = "add",
  Update = "update",
  Delete = "delete",
}

export enum KnowledgeState {
  Final = "final",
  Pending = "pending",
}

export const KnowledgeText = { MarkdownEscape: "\\$&" } as const;
export const KnowledgeFormat = { Version: 1 } as const;
export const KnowledgeField = { Operation: "operation", Publication: "publication_id" } as const;
export const KnowledgeRoute = "/knowledge";
export const KnowledgeTool = {
  Add: "titan_kb_add",
  Get: "titan_kb_get",
  Update: "titan_kb_update",
  Delete: "titan_kb_delete",
  Search: "titan_kb_search",
  Reindex: "titan_kb_reindex",
} as const;
export const KnowledgeToolForCommand = {
  [KnowledgeCommand.Add]: KnowledgeTool.Add,
  [KnowledgeCommand.Get]: KnowledgeTool.Get,
  [KnowledgeCommand.Update]: KnowledgeTool.Update,
  [KnowledgeCommand.Delete]: KnowledgeTool.Delete,
  [KnowledgeCommand.Search]: KnowledgeTool.Search,
  [KnowledgeCommand.Reindex]: KnowledgeTool.Reindex,
} as const;

export const KnowledgeLimit = {
  Entries: 10000,
  EntryBytes: 1024 * 1024,
  HistoryBytes: 8 * 1024 * 1024,
  IndexBytes: 16 * 1024 * 1024,
  TotalBytes: 1024 * 1024 * 1024,
  TitleCharacters: 256,
  TagCharacters: 64,
  Tags: 32,
  SearchCharacters: 4096,
  Page: 50,
  MaximumPage: 200,
  SummaryCharacters: 160,
  BusyMilliseconds: 5000,
  OpenAttempts: 200,
  OpenWaitMilliseconds: 50,
  SearchTerms: 64,
  MatchedCharacters: 512,
  JournalBytes: 12 * 1024 * 1024 + 4096,
  PageBytes: 1024 * 1024,
  PublicationEntries: 32,
  PublicationBytes: 16 * 1024 * 1024,
  PublicationReceipts: 10000,
  ReceiptBytes: 64 * 1024,
} as const;

export const KnowledgeFile = {
  Directory: "knowledge",
  Database: "knowledge.db",
  Lease: "knowledge-writer.db",
  SqliteSidecars: ["", "-wal", "-shm", "-journal"],
  Index: "INDEX.md",
  History: ".history",
  Journal: ".change.json",
  Publications: ".publications",
  Json: ".json",
  Markdown: ".md",
  Yaml: ".yaml",
  Header: "---\n",
  HeaderEnd: "\n---\n",
  Newlines: /\r\n?/g,
} as const;

export enum KnowledgePublicationStage {
  Journal = "journal",
  History = "history",
  File = "file",
  Index = "index",
  Receipt = "receipt",
}

export const KnowledgePattern = {
  Words: /[\p{L}\p{N}_]+/gu,
  Whitespace: /\s+/g,
  Markdown: /[\\`*_[\]<>|]/g,
  EntryId: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
} as const;

export const KnowledgeRelation = { Mentions: "mentions", Copy: "copy" } as const;

export enum KnowledgeExploreCase {
  ListScope = "list-scope",
  ListKind = "list-kind",
  ListTag = "list-tag",
  ListState = "list-state",
  ListBoth = "list-both",
  ListBadScope = "list-bad-scope",
  ListBadState = "list-bad-state",
  Stats = "stats",
  StatsNeverRead = "stats-never-read",
  StatsAfterGet = "stats-after-get",
  StatsEmpty = "stats-empty",
  Show = "show",
  ShowCopy = "show-copy",
  ShowMissing = "show-missing",
  Dashboard = "dashboard",
  DashboardAnonymous = "dashboard-anonymous",
}

export const KnowledgeExploreFixture = {
  Lessons: 3,
  Facts: 1,
  Marker: "marker",
  Other: "other",
  ProjectLesson: "project lesson",
  HomeLesson: "home lesson",
  Body: "learned something",
  Joiner: ":",
  Rows: "|",
  Nothing: "none",
  Missing: "zebra",
} as const;

export const KnowledgeSql = {
  InspectionBegin: "BEGIN",
  Claim: "BEGIN EXCLUSIVE",
  Initialize: [
    "PRAGMA busy_timeout=5000",
    "PRAGMA journal_mode=WAL",
    "PRAGMA synchronous=FULL",
    "CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, tags TEXT NOT NULL, version INTEGER NOT NULL, path TEXT NOT NULL, summary TEXT NOT NULL, bytes INTEGER NOT NULL, hash TEXT NOT NULL)",
    "CREATE VIRTUAL TABLE IF NOT EXISTS entry_search USING fts5(id UNINDEXED, title, body)",
    "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS entry_reads (id TEXT PRIMARY KEY, reads INTEGER NOT NULL, last_read INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS hidden_personas (id TEXT PRIMARY KEY)",
  ],
  MarkRead:
    "INSERT INTO entry_reads (id, reads, last_read) VALUES (?, 1, ?) ON CONFLICT(id) DO UPDATE SET reads = reads + 1, last_read = excluded.last_read",
  ReadCount: "SELECT reads FROM entry_reads WHERE id = ?",
  Kinds:
    "SELECT e.kind AS kind, count(*) AS entries, coalesce(sum(e.bytes),0) AS bytes, coalesce(sum(r.id IS NULL),0) AS never_read FROM entries e LEFT JOIN entry_reads r ON r.id = e.id GROUP BY e.kind ORDER BY e.kind",
  MetaGet: "SELECT value FROM meta WHERE key = ?",
  MetaSet: "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
  Clear: "DELETE FROM entries",
  ClearSearch: "DELETE FROM entry_search",
  ClearHidden: "DELETE FROM hidden_personas",
  InsertHidden: "INSERT INTO hidden_personas (id) VALUES (?)",
  DeleteHidden: "DELETE FROM hidden_personas WHERE id = ?",
  Hidden: "SELECT id FROM hidden_personas WHERE id = ?",
  Insert: "INSERT INTO entries VALUES (?,?,?,?,?,?,?,?,?)",
  InsertSearch: "INSERT INTO entry_search (id,title,body) VALUES (?,?,?)",
  Delete: "DELETE FROM entries WHERE id = ?",
  DeleteSearch: "DELETE FROM entry_search WHERE id = ?",
  Get: "SELECT * FROM entries WHERE id = ?",
  Page: "SELECT * FROM entries WHERE id > ? ORDER BY id LIMIT ?",
  Usage: "SELECT count(*) AS entries, coalesce(sum(bytes),0) AS bytes FROM entries",
  Search:
    "SELECT e.*, substr(snippet(entry_search,2,'[',']','…',32),1,?) AS matched, bm25(entry_search) AS rank FROM entry_search JOIN entries e ON e.id=entry_search.id WHERE entry_search MATCH ? AND (? IS NULL OR e.kind=?) AND e.id NOT IN (SELECT value FROM json_each(?)) AND (? OR e.id NOT IN (SELECT id FROM hidden_personas)) ORDER BY rank,e.id LIMIT ?",
  Kind: "SELECT *, summary AS matched, 0 AS rank FROM entries WHERE kind=? AND id NOT IN (SELECT value FROM json_each(?)) AND (? OR id NOT IN (SELECT id FROM hidden_personas)) ORDER BY id LIMIT ?",
} as const;

export const KnowledgeQueueKey = "knowledge";

export const KnowledgeVisibilityFixture = {
  DropIndex: "DROP TABLE hidden_personas",
} as const;

export const KnowledgeWriterFixture = {
  Processes: 8,
  Updates: 300,
  TimeoutMilliseconds: 30000,
  ObserveAttempts: 1000,
  Source: "testing/fixtures/knowledge-writer.mjs",
  Home: "home",
  StaleImport: "stale.md",
  InputSuffix: ".json",
  ReadySuffix: ".ready",
  ImportSuffix: ".md",
  ProjectSuffix: "-project",
  StaleProject: "stale-project",
  Gate: "1",
} as const;

export enum KnowledgeCommitFixture {
  Add = "add",
  Update = "update",
  Mixed = "mixed",
  Duplicate = "duplicate",
  Conflict = "conflict",
  Missing = "missing",
  Kind = "kind",
  Persona = "persona",
  Receipt = "receipt",
  ReceiptShape = "receipt_shape",
  ReceiptId = "receipt_id",
  ReceiptChanges = "receipt_changes",
  Digest = "digest",
  Before = "before",
  Current = "current",
  ReceiptCollision = "receipt_collision",
  Directory = "directory",
  LinkedDirectory = "linked_directory",
  LinkedReceipt = "linked_receipt",
  SharedReceipt = "shared_receipt",
}

export const KnowledgeMemoryDatabase = ":memory:";

export const KnowledgeMeaningLocal = {
  SqliteVec: "sqlite-vec",
  VectorFile: "knowledge-vectors.db",
  DropSql: "DROP TABLE IF EXISTS entry_vectors",
  CreateSql:
    "CREATE VIRTUAL TABLE entry_vectors USING vec0(id TEXT PRIMARY KEY, embedding float[384])",
  InsertSql: "INSERT INTO entry_vectors (id, embedding) VALUES (?, ?)",
  DeleteSql: "DELETE FROM entry_vectors WHERE id = ?",
  NearestSql:
    "SELECT id, distance FROM entry_vectors WHERE embedding MATCH ? AND k = ? ORDER BY distance",
  HalfSquare: 0.5,
  Full: 1,
} as const;

export enum KnowledgeMeaningSetup {
  Ready = "ready",
  Unloadable = "unloadable",
  BrokenEmbedder = "broken_embedder",
  Updated = "updated",
  Deleted = "deleted",
  Ghost = "ghost",
}

export const KnowledgeMeaningFixture = {
  Title: "Check time zones first",
  Body: "Check time zones first",
  Related: "the clock is in UTC",
  Words: "time zones",
  Food: "pasta recipe for dinner",
  UpdatedTitle: "Pasta dinner",
  UpdatedBody: "Cook pasta with tomato sauce",
  Broken: "embedder unavailable",
  EmbedderName: "@titan/embedder-concepts",
  Time: /time|zone|clock|utc/i,
  Cooking: /pasta|recipe|dinner|cook/i,
} as const;
