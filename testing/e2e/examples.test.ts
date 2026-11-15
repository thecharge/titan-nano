import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { workflowExampleCases, workflowExamplesCheckCases } from "../cases/examples.ts";
import { automaticWorkflowExample, workflowExample } from "../factories/examples.ts";

unit(workflowExample, workflowExampleCases, undefined, TestSchedule.Concurrent);

import { workflowExamplesCheck } from "../factories/example-check.ts";

unit(workflowExamplesCheck, workflowExamplesCheckCases, undefined, TestSchedule.Concurrent);

unit(automaticWorkflowExample, workflowExampleCases, undefined, TestSchedule.Concurrent);
