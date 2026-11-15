import { unit } from "@titan/test-factories";
import { toolGrantCases, toolWriteGrantCases } from "../cases/tool-request.ts";
import { toolAnswer, toolWriteGrant } from "../factories/tool-request.ts";

unit(toolAnswer, toolGrantCases);
unit(toolWriteGrant, toolWriteGrantCases);
