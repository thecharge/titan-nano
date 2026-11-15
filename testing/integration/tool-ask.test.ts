import { unit } from "@titan/test-factories";
import { toolAskCases } from "../cases/tool-request.ts";
import { toolAsk } from "../factories/tool-request.ts";

unit(toolAsk, toolAskCases);
