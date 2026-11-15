export enum RequestState {
  Waiting = "waiting",
  Answered = "answered",
}

export enum RequestMcpFixture {
  OpenTool = "open_tool",
  OpenHuman = "open_human",
  Read = "read",
  Approve = "approve",
  Deny = "deny",
  Restart = "restart",
  Retry = "retry",
  AnsweredRetry = "answered_retry",
  HumanAnswer = "human_answer",
  ForgedAuthority = "forged_authority",
  Stale = "stale",
  Repeated = "repeated",
  MissingReason = "missing_reason",
  WrongRun = "wrong_run",
  InvalidScope = "invalid_scope",
  Missing = "missing",
}
