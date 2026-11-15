import { unit } from "@titan/test-factories";
import { programWorkflowCases } from "../cases/program-api.ts";
import { programWorkflow } from "../factories/program-api.ts";

unit(programWorkflow, programWorkflowCases);
