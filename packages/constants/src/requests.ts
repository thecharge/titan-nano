import { IoLimit } from "./io.ts";
export enum RequestKind {
  Ask = "ask",
  AddStep = "add_step",
  Replan = "replan",
  NewPersona = "new_persona",
  ImprovePersona = "improve_persona",
  MergePersonas = "merge_personas",
  RetirePersona = "retire_persona",
  DeletePersona = "delete_persona",
  Tool = "tool",
  Skill = "skill",
  ToolServer = "tool_server",
  Resource = "resource",
  Action = "action",
  RaiseLimit = "raise_limit",
  PaidCompute = "paid_compute",
  LockStatement = "lock_statement",
}
export enum ApprovalLevel {
  Auto = "auto",
  Main = "main",
  Human = "human",
}
export enum RequestDecision {
  Approve = "approve",
  Deny = "deny",
}
export const ApprovalRank = {
  [ApprovalLevel.Auto]: 0,
  [ApprovalLevel.Main]: 1,
  [ApprovalLevel.Human]: 2,
} as const;
export const RequestDefaults = {
  [RequestKind.Ask]: ApprovalLevel.Auto,
  [RequestKind.AddStep]: ApprovalLevel.Auto,
  [RequestKind.Replan]: ApprovalLevel.Main,
  [RequestKind.NewPersona]: ApprovalLevel.Main,
  [RequestKind.ImprovePersona]: ApprovalLevel.Main,
  [RequestKind.MergePersonas]: ApprovalLevel.Main,
  [RequestKind.RetirePersona]: ApprovalLevel.Main,
  [RequestKind.DeletePersona]: ApprovalLevel.Human,
  [RequestKind.Tool]: ApprovalLevel.Main,
  [RequestKind.Skill]: ApprovalLevel.Main,
  [RequestKind.ToolServer]: ApprovalLevel.Human,
  [RequestKind.Resource]: ApprovalLevel.Main,
  [RequestKind.Action]: ApprovalLevel.Human,
  [RequestKind.RaiseLimit]: ApprovalLevel.Human,
  [RequestKind.PaidCompute]: ApprovalLevel.Human,
  [RequestKind.LockStatement]: ApprovalLevel.Human,
} as const;
export const RequestLimit = {
  InputBytes: 512 * 1024,
  PerRun: 256,
  PendingOperations: 256,
  TextCharacters: 4096,
  ScopeEntries: 64,
  HashPattern: /^[a-f0-9]{64}$/,
} as const;

export const RequestVersion = { Open: 1, Answered: 2, Escalated: 2, EscalatedAnswered: 3 } as const;
export const RequestFormat = { Legacy: 1, Execution: 2, Persona: 3 } as const;
export const RequestExecutionPattern = /^(worker|falsifier-(0|[1-9][0-9]*)|helper-[a-zA-Z0-9_-]+)$/;

export enum RequestExecutionCheck {
  History = "history",
  Admission = "admission",
  Waiting = "waiting",
}

export const RequestTurnField = { Result: "result", Requests: "requests" } as const;

export const RequestProjection = {
  File: "requests.json",
  Version: 1,
  MaximumBytes: RequestLimit.PerRun * RequestLimit.InputBytes + IoLimit.AddressBytes,
} as const;
