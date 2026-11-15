import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { nativeProjectWorkflowCases, nativeWorkflowCases } from "../cases/native-workflow.ts";
import { nativeProjectWorkflow, nativeWorkflow } from "../factories/native-workflow.ts";

unit(nativeWorkflow, nativeWorkflowCases, undefined, TestSchedule.Concurrent);

unit(nativeProjectWorkflow, nativeProjectWorkflowCases, undefined, TestSchedule.Concurrent);
