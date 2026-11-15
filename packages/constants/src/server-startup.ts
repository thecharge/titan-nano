import { DashboardSession } from "./dashboard.ts";

export enum ServerStartCheck {
  AddressMode = "address-mode",
  PersonMode = "person-mode",
  Content = "content",
  Loopback = "loopback",
  OtherLoopback = "other-loopback",
  Ipv6 = "ipv6",
  GroupOther = "group-other",
}

export enum ServerTokenCheck {
  Agent = "agent",
  Person = "person",
  None = "none",
  Wrong = "wrong",
  Bare = "bare",
  Short = "short",
}

export enum ServerHolder {
  Agent = "agent",
  Person = "person",
}

export enum ServerSecondCheck {
  Refused = "refused",
  Dotted = "dotted",
  Preserved = "preserved",
  OtherHome = "other-home",
  Restarted = "restarted",
}

export enum ServerRestartCheck {
  State = "state",
  Project = "project",
  Agents = "agents",
  Result = "result",
  Missing = "missing",
  OtherHome = "other-home",
}

export enum ServerFolderCheck {
  Home = "home",
  Project = "project",
  Backends = "backends",
  Result = "result",
  Journal = "journal",
  Moved = "moved",
  Missing = "missing",
  OtherHome = "other-home",
}

export const ServerFolderFixture = {
  Home: "home",
  Project: "project",
  First: "first",
  Second: "second",
  FirstLog: "first.stderr",
  SecondLog: "second.stderr",
  Client: "folder-restart",
  Submission: "folder-kept",
  MissingRun: "run-missing",
  OtherHome: "other-home",
  Worker: "worker",
  Checker: "checker",
  Solve: "Solve",
  Refute: "Refute",
  Both: "true true",
  Proc: "/proc",
  Cwd: "cwd",
  SettleMs: 400,
  ScriptedAnswers: 2,
} as const;

export enum ServerRunCheck {
  RunId = "run-id",
  State = "state",
  NoToken = "no-token",
  Invalid = "invalid",
}

export enum ServerStreamCheck {
  Continuous = "continuous",
  Duplicates = "duplicates",
  Count = "count",
  BadCursor = "bad-cursor",
  FutureCursor = "future-cursor",
  NoToken = "no-token",
}

export enum ServerKillCheck {
  Steps = "steps",
  Restarted = "restarted",
  Attempt = "attempt",
  NoRerun = "no-rerun",
  OtherStep = "other-step",
  AttemptReset = "attempt-reset",
}

export const ServerRunFixture = {
  Example: "examples/code-fix.yaml",
  Client: "http-run",
  Submission: "http-run-first",
  SeenEvents: 5,
  MinimumLater: 10,
  FutureOffset: 1000,
  BadCursor: "abc",
  KilledStep: "fix",
  EarlierStep: "cause",
  WriterCalls: 2,
  IdLine: /^id: (\d+)$/m,
  FrameBoundary: "\n\n",
} as const;

export enum ServerTornCheck {
  State = "state",
  Restored = "restored",
  Replayed = "replayed",
  Partial = "partial",
  Corrupt = "corrupt",
  Reordered = "reordered",
  Empty = "empty",
  Unchanged = "unchanged",
}

export enum ApiCredential {
  Cookie = "cookie",
  CookieAgent = "cookie-agent",
  Agent = "agent",
  Person = "person",
}

export enum CookieCredential {
  Cookie = "cookie",
  Wrong = "wrong",
  None = "none",
  Agent = "agent",
  Person = "person",
  Foreign = "foreign",
}

export const ServerStartupFixture = {
  Home: "home",
  Project: "project",
  Elsewhere: "elsewhere",
  Other: "other",
  Client: "startup",
  Submission: "first",
  OtherLoopback: "127.0.0.2",
  Ipv6: "[::1]",
  Answered: "answered",
  Refused: "refused",
  OwnerMask: 0o777,
  GroupOtherMask: 0o077,
  Octal: 8,
  Foreign: "https://example.com",
  Opaque: "null",
  NoOrigin: "",
  WrongToken: "0".repeat(64),
  ShortToken: "abc",
  WrongCookie: `${DashboardSession.CookieName}${DashboardSession.CookieAssignment}${"0".repeat(64)}`,
  Dotted: "/.",
  MissingRun: "missing-run",
  ProjectField: "project",
  RequestsRoute: "/requests",
  LineBreak: "\n",
  Torn: '{"torn":',
  Garbage: "not json",
  Answer: "answer",
} as const;

export const ServerTornWorkflow = {
  name: "Torn",
  goal: "Deliver files with independent checks",
  personas: {
    writer: { description: "Writes", role: "Solve", tools: ["Write"] },
    skeptic: { description: "Checks", role: "Refute" },
  },
  steps: [
    {
      id: "a",
      do: { persona: "writer", task: "Solve" },
      falsify: [{ persona: "skeptic", task: "Refute" }],
    },
  ],
};

export const ServerTornVerdict = { verdict: "survived", evidence: "Checked the candidate" };
