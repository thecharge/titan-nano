import { unit } from "@titan/test-factories";
import {
  answerCases,
  workflowCases,
  workflowCheckCases,
  workflowInputCases,
  workflowSourceCreationCases,
} from "../cases/workflow.ts";
import {
  compiledWorkflow,
  validatedAnswer,
  workflowCheck,
  workflowInputs,
  workflowSourceCreation,
} from "../factories/workflow.ts";

unit(validatedAnswer, answerCases);
unit(compiledWorkflow, workflowCases);
unit(workflowCheck, workflowCheckCases);
unit(workflowInputs, workflowInputCases);

unit(workflowSourceCreation, workflowSourceCreationCases);
