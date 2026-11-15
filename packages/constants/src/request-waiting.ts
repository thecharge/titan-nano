export enum ToolWaitFixture {
  Waiting = "waiting",
  Human = "human",
  Answered = "answered",
  Unanswered = "unanswered",
  InvalidScope = "invalid_scope",
}

export const ToolWait = {
  LimitMs: 1000,
  RequestId: "wait-request",
  Operation: "start",
  Resource: "candidate",
  Client: "origin",
  Session: "session",
  ExpiresMs: 60000,
  Error: "error",
  ClientName: "tool-waits",
  ClientVersion: "1",
} as const;

export enum AutomaticDecisionFixture {
  WithinLimits = "within_limits",
  Route = "route",
  OutsideLimits = "outside_limits",
  WrongKind = "wrong_kind",
  Missing = "missing",
  Repeated = "repeated",
}

export const AutomaticDecision = {
  RequestId: "step-request",
  Client: "worker-client",
  Operation: "add",
  Resource: "extra-step",
  Task: "Check the parser",
  ExpiresMs: 60000,
  Other: "other-request",
  MaxSteps: 1,
} as const;
