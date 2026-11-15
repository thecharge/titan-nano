import { unit } from "@titan/test-factories";
import {
  mcpRunResponseCases,
  runControlResponseCases,
  runStatusResponseCases,
} from "../cases/run-response.ts";
import { cliRunResponse, mcpRunResponse, runResponse } from "../factories/run-response.ts";

unit(runResponse, runStatusResponseCases);
unit(runResponse, runControlResponseCases);

unit(cliRunResponse, runStatusResponseCases);
unit(cliRunResponse, runControlResponseCases);

unit(mcpRunResponse, mcpRunResponseCases);
