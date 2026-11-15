import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import {
  personaHelperCases,
  statementPathCases,
  workflowBuiltCases,
  workflowShapeCases,
} from "../cases/workflow-file.ts";
import {
  personaHelpers,
  statementCheck,
  workflowFileCheck,
  workflowFileShape,
} from "../factories/workflow-file.ts";

unit(workflowFileShape, workflowShapeCases, undefined, TestSchedule.Concurrent);
unit(workflowFileCheck, workflowBuiltCases, undefined, TestSchedule.Concurrent);
unit(personaHelpers, personaHelperCases, undefined, TestSchedule.Concurrent);
unit(statementCheck, statementPathCases, undefined, TestSchedule.Concurrent);
