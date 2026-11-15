import { RequestKind } from "./requests.ts";

export const FixedApprovalKinds = [
  RequestKind.DeletePersona,
  RequestKind.Action,
  RequestKind.RaiseLimit,
  RequestKind.PaidCompute,
] as const;

export enum ApprovalPolicyFixture {
  Defaults = "defaults",
  OwnerRaise = "owner_raise",
  OwnerLower = "owner_lower",
  WorkflowRaise = "workflow_raise",
  WorkflowInherited = "workflow_inherited",
  ProjectRaise = "project_raise",
  CliRaise = "cli_raise",
  WorkflowLower = "workflow_lower",
  WorkflowServerLower = "workflow_server_lower",
  ProjectLower = "project_lower",
  ExplicitLower = "explicit_lower",
  CliLower = "cli_lower",
  FixedAction = "fixed_action",
  FixedPaid = "fixed_paid",
  FixedDelete = "fixed_delete",
  FixedLimit = "fixed_limit",
  Unknown = "unknown",
  Invalid = "invalid",
  LoweredReplay = "lowered_replay",
  RaisedReplay = "raised_replay",
  Legacy = "legacy",
  ChangedPolicy = "changed_policy",
  ForgedLevel = "forged_level",
}
