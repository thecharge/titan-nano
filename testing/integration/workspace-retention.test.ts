import { unit } from "@titan/test-factories";
import {
  retainedImproverExecutionCases,
  retainedScriptExecutionCases,
  retainedSkillExecutionCases,
  workspaceRunInspectionCases,
} from "../cases/workspace-retention.ts";
import {
  retainedImproverExecution,
  retainedScriptExecution,
  retainedSkillExecution,
  workspaceRunInspection,
} from "../factories/workspace-retention.ts";

unit(retainedSkillExecution, retainedSkillExecutionCases);

unit(workspaceRunInspection, workspaceRunInspectionCases);

unit(retainedScriptExecution, retainedScriptExecutionCases);

unit(retainedImproverExecution, retainedImproverExecutionCases);
