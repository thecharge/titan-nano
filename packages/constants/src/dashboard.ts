export const DashboardRoute = {
  Page: "/",
  Login: "/login",
  Code: "/dashboard-code",
  Knowledge: "/ui/api/knowledge",
  Query: "?",
  KnowledgeRunParameter: "run_id",
  KnowledgeEntryParameter: "id",
  KnowledgeScopeParameter: "scope",
  KnowledgeKindParameter: "kind",
  KnowledgeTagParameter: "tag",
  KnowledgeStateParameter: "state",
  Runs: "/ui/api/runs",
  BeforeParameter: "before",
  RunPrefix: "/ui/api/runs/",
  EventsSuffix: "/events",
  ArtifactsSuffix: "/artifacts",
  ConfigurationSuffix: "/config",
  ConfigurationPattern: /^\/ui\/api\/runs\/([^/]+)\/config$/,
  ArtifactPattern: /^\/ui\/api\/runs\/([^/]+)\/artifacts(?:\/([a-f0-9]{64}))?$/,
  AssetPattern: /^\/[A-Za-z0-9._-]+\.(?:js|css|map)$/,
  RunPattern: /^\/ui\/api\/runs\/([^/]+)(\/events)?$/,
} as const;

export const DashboardSession = {
  CookieName: "titan_session",
  CodeParameter: "code",
  CodeBytes: 32,
  CodePattern: /^[0-9a-f]{64}$/,
  CodeLifetimeMilliseconds: 60_000,
  MaximumCodes: 16,
  MaximumSessions: 64,
  SessionBytes: 32,
  CookieFlags: "HttpOnly; SameSite=Strict; Path=/",
  CookieSeparator: "; ",
  CookieAssignment: "=",
} as const;

export const DashboardHeader = {
  ContentSecurityPolicy: "content-security-policy",
  ReferrerPolicy: "referrer-policy",
  CacheControl: "cache-control",
  Cookie: "cookie",
  SetCookie: "set-cookie",
  Location: "location",
  ContentType: "content-type",
  LastEventId: "last-event-id",
  Allow: "allow",
} as const;

export const DashboardPolicy = {
  ContentSecurityPolicy: "default-src 'self'",
  ReferrerPolicy: "no-referrer",
  CacheControl: "no-store",
  Allow: "GET",
  Html: "text/html; charset=utf-8",
  Script: "text/javascript; charset=utf-8",
  Style: "text/css; charset=utf-8",
  EventStream: "text/event-stream",
  Plain: "text/plain; charset=utf-8",
  Entry: "./dashboard/index.html",
} as const;

export const DashboardStream = {
  PollMilliseconds: 200,
  PageSize: 50,
  KeepAliveMilliseconds: 15_000,
  KeepAlive: ": keep-alive\n\n",
  EventName: "run-event",
  IdPattern: /^(?:0|[1-9]\d{0,15})$/,
} as const;

export const DashboardLimit = {
  RunPageSize: 200,
  ListedBoardMessages: 200,
} as const;

export const DashboardListFixture = {
  LimitMilliseconds: 2000,
  Persona: "builder",
  Flow: "flow",
  Client: "client",
  StepPrefix: "step-",
  RunPrefix: "run-",
  Project: "project",
  Journal: "{}",
  Separator: " ",
} as const;

export const DashboardListFailure = {
  EventsRead: "the list read the events of a run",
  UsageRead: "the list read the usage of a run",
} as const;

export enum ProofAnswer {
  Proven = "proven",
  Refuted = "refuted",
  NotProven = "not proven",
}

export const DashboardProof = { EventType: "check_answered" } as const;

export enum MeasureState {
  NotReported = "not_reported",
  Partial = "partial",
  Complete = "complete",
}

export enum AttemptVerdict {
  Open = "open",
  Survived = "survived",
  Refuted = "refuted",
}

export enum DashboardScenario {
  Login = "login",
  SecondLogin = "second-login",
  WrongCode = "wrong-code",
  NoCookie = "no-cookie",
  ForeignOrigin = "foreign-origin",
  ListWithCookie = "list-with-cookie",
  PageHeaders = "page-headers",
  PageAssets = "page-assets",
  PostWithCookie = "post-with-cookie",
  CookieOnRuns = "cookie-on-runs",
  CookieOnAnswer = "cookie-on-answer",
  AgentTokenOnDashboard = "agent-token-on-dashboard",
  PersonTokenOnDashboard = "person-token-on-dashboard",
  AgentTokenMint = "agent-token-mint",
  Numbers = "numbers",
  Steps = "steps",
  Replay = "replay",
  BadCursor = "bad-cursor",
  UnknownRun = "unknown-run",
  NoLeak = "no-leak",
  ProofCounts = "proof-counts",
}

export enum DashboardCommandScenario {
  StartsServer = "starts-server",
  TextLine = "text-line",
  JsonObject = "json-object",
  MismatchedUrl = "mismatched-url",
  StaleAddress = "stale-address",
  OnceThenRefused = "once-then-refused",
  ExtraArgument = "extra-argument",
  WatchFlag = "watch-flag",
  WrongPersonToken = "wrong-person-token",
  NoLeak = "command-no-leak",
}

export const DashboardCommandFixture = {
  Token: "a".repeat(64),
  AgentToken: "b".repeat(64),
  WrongToken: "c".repeat(64),
  Watch: "--watch",
  Elapsed: 0,
  OtherOrigin: "http://127.0.0.1:1",
  LinkPattern: /^http:\/\/127\.0\.0\.1:\d+\/login\?code=[0-9a-f]{64}$/,
  Expired: 60_001,
  Alive: 59_999,
  Clean: "clean",
  Leaked: "leaked",
  Started: "started",
  ExtraWord: "extra",
  HomeDirectory: "home",
  Nothing: "none",
} as const;

export enum DashboardUsageFixture {
  Reported = "reported",
  NoCost = "no-cost",
  Mixed = "mixed",
}

export const DashboardFixture = {
  InputTokens: 1050,
  OutputTokens: 500,
  Cost: 0.015,
  MixedCost: 0.03,
  ReplayAfter: 3,
  RequestId: "missing-request",
  Home: "home",
  Project: "project",
  Client: "dashboard-owner",
  Submission: "dashboard-one",
  ForeignOrigin: "https://example.com",
  WrongCode: "not-a-code",
  UnknownRun: "no-such-run",
  BadCursor: "abc",
  Bearer: "Bearer ",
  ProofStep: "deliver",
} as const;

export const DashboardLiveFixture = {
  ArrivalLimitMilliseconds: 2000,
  PublishDelayMilliseconds: 50,
  SilenceMilliseconds: 300,
  FramePattern: /^id: (\d+)$/m,
} as const;

export const DashboardHtmlSource = {
  SourcePattern: /(?:src|href)="([^"]+)"/g,
  Origin: "/",
} as const;

export const DashboardProbe = {
  InvalidConfigurationQuery: "?scope=user",
  Redirect: "manual",
  InvalidQueries: ["limit=0", "limit=201", "before=bad", "limit=1&limit=2", "unknown=1"],
} as const;

export const DashboardTag = {
  Root: "app",
  Details: "details",
  Summary: "summary",
  Form: "form",
  Label: "label",
  Input: "input",
  Table: "table",
  Button: "button",
  Caption: "caption",
  DescriptionList: "dl",
  Term: "dt",
  Description: "dd",
  Group: "div",
  Row: "tr",
  Header: "th",
  Cell: "td",
  Link: "a",
  Section: "section",
  ThirdHeading: "h3",
  FourthHeading: "h4",
  SecondHeading: "h2",
  Paragraph: "p",
  Preformatted: "pre",
  List: "ul",
  Item: "li",
} as const;

export const DashboardText = {
  RunFilterFields: ["client_id", "harness_session_id", "project_path"],
  SubmitEvent: "submit",
  MeasurementsIdPrefix: "run-measurements-",
  RunListClass: "run-list",
  TableViewportClass: "table-viewport",
  RunContextClass: "run-context",
  Columns: ["run", "workflow", "state", "stage", "persona", "started", "cost USD"],
  NumberColumns: [
    "started",
    "elapsed ms",
    "attempts",
    "agents at once",
    "input tokens",
    "output tokens",
    "cost USD",
    "survived",
    "refuted",
    "proven",
    "refuted checks",
    "not proven",
  ],
  Empty: "",
  HashEvent: "hashchange",
  Steps: "steps",
  Requests: "open requests",
  Board: "board",
  HomeHash: "#/",
  ListHash: "#/runs?",
  ListHashPattern: /^#\/runs\?(.*)$/,
  KnowledgeHash: "#/knowledge/",
  KnowledgeHashPattern: /^#\/knowledge\/(.*)$/,
  RunHash: "#/run/",
  ArtifactHash: "#/artifacts/",
  ConfigurationHash: "#/config/",
  ConfigurationHashPattern: /^#\/config\/([^/?]+)$/,
  ArtifactHashPattern: /^#\/artifacts\/([^/?]+)(?:\/([a-f0-9]{64}))?(?:\?(.*))?$/,
  RunHashPattern: /^#\/run\/(.+)$/,
  RefreshMilliseconds: 2000,
  RequestTimeoutMilliseconds: 10000,
  AfterParameter: "?after=",
  ClickEvent: "click",
  StreamErrorEvent: "error",
  StreamOpenEvent: "open",
} as const;

export const ScriptWord = "script";

export const DashboardField = {
  Step: "step_id",
  Attempt: "attempt",
  Phase: "phase",
  Answer: "answer",
  Pending: "pending",
  Empty: "",
} as const;

export enum DashboardType {
  String = "string",
  Number = "number",
}

export const DashboardBuild = {
  PackedAssets: "assets/dashboard.json",
  Source: "packages/server/src/dashboard/index.html",
  MaximumAssets: 32,
  Target: "browser",
  HtmlExtension: ".html",
  FirstCursor: "0",
} as const;

export enum DashboardPageExercise {
  ApplyFilters = "apply-filters",
  PreserveFilters = "preserve-filters",
  ClearRunFilters = "clear-run-filters",
  FocusedFilters = "focused-filters",
  None = "none",
  Retry = "retry",
  RefreshFailure = "refresh-failure",
  InvalidEvent = "invalid-event",
  Reconnect = "reconnect",
  BoundedEvents = "bounded-events",
  BoundedCursors = "bounded-cursors",
  DelayedRun = "delayed-run",
  DelayedList = "delayed-list",
  DelayedKnowledge = "delayed-knowledge",
  DelayedFailure = "delayed-failure",
  Navigation = "navigation",
  EmptyRuns = "empty-runs",
  EmptySteps = "empty-steps",
}
