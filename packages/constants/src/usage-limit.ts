export enum RunBlock {
  Limit = "limit",
}

export const UsageLimit = {
  Pattern:
    /hit your [^\n]*?limit[^\n]*?resets\s+(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)(?![a-z])/i,
  Afternoon: "pm",
  HalfDay: 12,
  MillisecondsPerMinute: 60_000,
  Query: "backend",
  NoHour: "",
  NoMinute: "0",
  NoMeridiem: "",
} as const;

export enum LimitFixture {
  Near,
  Far,
  Clear,
}

export enum LimitAction {
  None,
  Wait,
  Resume,
  Switch,
}

export const LimitTest = {
  Text: "You've hit your 5-hour limit · resets 10:50am",
  Plain: "Nothing to report",
  First: "first-task",
  Second: "second-task",
  Review: "review",
  Year: 2026,
  Month: 5,
  Day: 1,
  NearClock: [10, 49, 59, 700],
  FarClock: [9, 0, 0, 0],
  Worker: "worker",
  Checker: "checker",
  FirstStep: "first",
  SecondStep: "second",
  NearMilliseconds: 300,
  WaitAttempts: 300,
  FarWaitAttempts: 50,
  RetrySlackMilliseconds: 1000,
  Client: "limit-client",
  Submission: "limit-submission",
} as const;
