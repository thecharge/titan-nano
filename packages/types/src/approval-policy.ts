import { ApprovalLevel, FixedApprovalKinds, RequestDefaults, RequestKind } from "@titan/constants";
import { fixedApprovalLevel } from "@titan/messages";
import { z } from "zod";

function field(kind: RequestKind): z.ZodDefault<z.ZodType<ApprovalLevel>> {
  if (FixedApprovalKinds.some((fixed) => fixed === kind))
    return z
      .literal(ApprovalLevel.Human, { error: fixedApprovalLevel(kind) })
      .default(ApprovalLevel.Human);
  return z.enum(ApprovalLevel).default(RequestDefaults[kind]);
}
export const ApprovalPolicySchema = z.strictObject({
  [RequestKind.Ask]: field(RequestKind.Ask),
  [RequestKind.AddStep]: field(RequestKind.AddStep),
  [RequestKind.Replan]: field(RequestKind.Replan),
  [RequestKind.NewPersona]: field(RequestKind.NewPersona),
  [RequestKind.ImprovePersona]: field(RequestKind.ImprovePersona),
  [RequestKind.MergePersonas]: field(RequestKind.MergePersonas),
  [RequestKind.RetirePersona]: field(RequestKind.RetirePersona),
  [RequestKind.DeletePersona]: field(RequestKind.DeletePersona),
  [RequestKind.Tool]: field(RequestKind.Tool),
  [RequestKind.Skill]: field(RequestKind.Skill),
  [RequestKind.ToolServer]: field(RequestKind.ToolServer),
  [RequestKind.Resource]: field(RequestKind.Resource),
  [RequestKind.Action]: field(RequestKind.Action),
  [RequestKind.RaiseLimit]: field(RequestKind.RaiseLimit),
  [RequestKind.PaidCompute]: field(RequestKind.PaidCompute),
  [RequestKind.LockStatement]: field(RequestKind.LockStatement),
});
export type ApprovalPolicy = z.infer<typeof ApprovalPolicySchema>;
