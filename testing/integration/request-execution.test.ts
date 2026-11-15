import { unit } from "@titan/test-factories";
import { requestExecutionCases } from "../cases/request-execution.ts";
import { requestExecution } from "../factories/request-execution.ts";

unit(requestExecution, requestExecutionCases);
