export enum PersonaState {
  Proposed = "proposed",
  Trial = "trial",
  Proven = "proven",
  NeedsUpdate = "needs_update",
  Retired = "retired",
  Deleted = "deleted",
}

export enum PersonaBound {
  Lower = "lower",
  Upper = "upper",
}

export const PersonaRule = {
  Z: 1.96,
  Bar: 0.6,
  MergeScore: 0.9,
  Fade: 0.98,
  FloorShare: 0.1,
  VersionMark: "@",
  PickRule: "thompson",
  TagSeparator: ",",
  Callable: [PersonaState.Trial, PersonaState.Proven, PersonaState.NeedsUpdate],
  CandidatesLabel: "candidates: ",
  ListSeparator: ", ",
  PairSeparator: "+",
  Digits: 3,
  Ineligible: [PersonaState.Retired, PersonaState.Deleted, PersonaState.Proposed],
  Hidden: [PersonaState.Retired, PersonaState.Deleted],
  Mergeable: [PersonaState.Trial, PersonaState.Proven],
  Moving: [PersonaState.Trial, PersonaState.Proven],
} as const;

export const UuidLayout = {
  Groups: [
    [0, 8],
    [8, 12],
    [13, 16],
    [17, 20],
    [20, 32],
  ],
  Version: "5",
  Variant: "8",
  Separator: "-",
} as const;

export enum PersonaHomeSource {
  Environment = "environment",
  Option = "option",
}

export const PersonaRegister = {
  HistoryResults: 4096,
  FirstVersion: 1,
  RunFile: "personas.json",
  Workflow: "workflow.yaml",
  Project: "project",
  Strays: "stray-home",
  Backend: "fake",
  NoRecord: "none",
  Broken: "not: a persona entry\n",
  WorkflowName: "Register",
  Goal: "Register personas",
  Description: "A persona",
  Task: "Do the work",
  Check: "Check the work",
  Checker: "checker",
  CheckerDescription: "Checker",
  CheckerRole: "Refute",
  StepId: "one",
  Note: "Registered worker",
  Evidence: "Register check",
  HomeVariable: "HOME",
  RoleFirst: "Judge fairly",
  RoleSecond: "Judge strictly",
  RoleMutated: "Judge with new role",
  Latest: "skeptic@5",
  First: "skeptic@1",
  Missing: "skeptic@9",
  Beyond: "skeptic@6",
  JudgeFirst: "judge@1",
  JudgeSecond: "judge@2",
  JudgeMissing: "judge@9",
  Versions: 5,
  Skeptic: "skeptic",
  Fixer: "fixer",
  Judge: "judge",
} as const;

export const PersonaPickRun = {
  Seed: 42,
  OtherSeed: 7,
  Timeout: 120000,
  Repeats: 2000,
  FewRepeats: 500,
  SwapPicks: 200,
  FloorPicks: 400,
  FloorLimit: 0.01,
  ShareLimit: 0.1,
  HalfShare: 0.5,
  Step: 0x6d2b79f5,
  ShiftFirst: 15,
  ShiftSecond: 7,
  ShiftThird: 14,
  OrMask: 61,
  Range: 4294967296,
  TwoPi: 2 * Math.PI,
  GammaShift: 1 / 3,
  GammaScale: 9,
  HalfCurve: 0.5,
  Cube: 3,
} as const;

export enum WilsonCheck {
  Holds = "holds",
  Reversed = "reversed",
}

export const WilsonRun = {
  Seed: 42,
  Runs: 1000,
  MaxTotal: 10000,
  SampleScale: 4,
  Multiplier: 16807,
  Modulus: 2147483647,
  Digits: 3,
  Tolerance: 1e-12,
  Pair: " ",
} as const;

export const OpenCallFixture = {
  Chemistry: "chemistry",
  TaxLaw: "tax-law",
  Task: "Check the reaction",
  StepId: "ask-chemist",
  ClientId: "open-call-owner",
  Chemist: "chemist",
  Lawyer: "lawyer",
  Role: "Check chemistry",
  Description: "Chemistry checker",
  Marker: "done",
  Survived: 9,
  Refuted: 1,
  Seed: 42,
  Multiplier: 16807,
  Modulus: 2147483647,
  Empty: "none",
  Turn: 1,
  Version: 2,
  Join: "|",
  ListJoin: ",",
  PickJoin: ":",
} as const;

export const OpenCallTamper = {
  None: "none",
  UnknownStep: "unknown_step",
  OtherPersona: "other_persona",
  OtherTask: "other_task",
  GhostPersona: "ghost_persona",
  Ghost: "ghost",
  Ok: "ok",
  State: "proven",
  Event: "tampered",
} as const;

export const PersonaSearchFixture = {
  Prove: "prove a claim wrong",
  Unrelated: "write a poem",
  None: "none",
  Separator: " ",
  Described: "description: Tries to prove a claim wrong\nstate: proven\nsurvived: 8\nrefuted: 2\n",
  Plain: "description: Tries to prove a claim wrong\n",
  PlainText: "Tries to prove a claim wrong",
  Unknown: "description: Tries to prove a claim wrong\nstate: bogus\nsurvived: 8\n",
} as const;

export const PersonaFixture = {
  Subject: "subject",
  Skeptic: "skeptic",
  Doubter: "doubter",
  RunOne: "run-1",
  RunTwo: "run-2",
  Judge: "judge",
  Investigator: "investigator",
  OldCoder: "5b1f0c1e-2a3d-4e5f-8a6b-7c8d9e0f1a21",
  NewCoder: "6c2a1d2f-3b4e-4f60-9b7c-8d9e0f1a2b32",
  Ghost: "7d3b2e30-4c5f-4071-8c8d-9e0f1a2b3c43",
  GhostTwo: "8e4c3f41-5d60-4182-9d9e-0f1a2b3c4d54",
  RoleOld: "role: old coder\n",
  RoleOther: "role: new coder\n",
  Rates: {
    Good: 0.75,
    Mid: 0.55,
    Near: 0.62,
    Close: 0.6,
    High: 0.9,
    Low: 0.1,
    Top: 0.95,
    Bottom: 0.05,
  },
  Scores: { Match: 0.93, Edge: 0.9, Under: 0.89, Same: 0.95 },
} as const;
export enum PersonaDecisionStage {
  Validate = "validate",
  Publish = "publish",
}
