import { AgentTool, ApprovalLevel, ErrorCode, RequestKind, ToolMode } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const toolAskCases = {
  positive: [
    positive(
      "tool request pauses its step and the parallel branch finishes both steps",
      [2, true],
      "waiting 3 1 tool WebSearch deliver 2",
    ),
    positive(
      "tool request with one side step leaves one finished step and exit code 3",
      [1, true],
      "waiting 3 1 tool WebSearch deliver 1",
    ),
  ],
  negative: [
    rejected(
      "run without a tool request passes with exit code 0 and an empty request list",
      [1, false],
      "passed 0 0 undefined undefined undefined 1",
    ),
    rejected(
      "tool request without side steps finishes no other step",
      [0, true],
      "waiting 3 1 tool WebSearch deliver 0",
    ),
  ],
};

export const toolGrantCases = {
  positive: [
    positive(
      "tool given then run resumed passes with the tool among the agent tools",
      [ToolMode.Granted],
      "passed 0 true false 2 false approve",
    ),
    positive(
      "denial reason reaches the next prompt of the asking agent",
      [ToolMode.Denied],
      "passed 0 false true 2 false deny",
    ),
  ],
  negative: [
    rejected(
      "resume with an open request exits with code 3 and lists the request",
      [ToolMode.Open],
      "waiting 3 false false 1 true undefined",
    ),
    rejected(
      "denied tool never joins the agent tools",
      [ToolMode.Denied],
      "passed 0 false true 2 false deny",
    ),
  ],
};

export const toolWriteGrantCases = {
  positive: [
    positive("approved Write enables its worker", [AgentTool.Write, true, true, false], true),
    positive("approved Edit survives restart", [AgentTool.Edit, true, true, true], true),
  ],
  negative: [
    rejected(
      "denied Write keeps its worker read only",
      [AgentTool.Write, true, false, false],
      true,
    ),
    rejected(
      "denied Edit stays read only after restart",
      [AgentTool.Edit, true, false, true],
      true,
    ),
    rejected(
      "approved Write keeps its checker read only",
      [AgentTool.Write, false, true, false],
      true,
    ),
    rejected(
      "approved Edit keeps its restarted checker read only",
      [AgentTool.Edit, false, true, true],
      true,
    ),
  ],
};

export const acceptAsSentCases = {
  positive: [
    positive(
      "main accepts a merge_personas request as sent",
      [RequestKind.MergePersonas, ApprovalLevel.Main],
      "approve main main true",
    ),
    positive(
      "main accepts a tool request as sent",
      [RequestKind.Tool, ApprovalLevel.Main],
      "approve main main true",
    ),
  ],
  negative: [
    rejected(
      "main cannot accept a human-level delete_persona request",
      [RequestKind.DeletePersona, ApprovalLevel.Main],
      ErrorCode.PermissionDenied,
    ),
    rejected(
      "auto level cannot accept a merge_personas request",
      [RequestKind.MergePersonas, ApprovalLevel.Auto],
      ErrorCode.PermissionDenied,
    ),
  ],
};
