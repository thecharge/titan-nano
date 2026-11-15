import { unit } from "@titan/test-factories";
import { requestMcpCases } from "../cases/request-mcp.ts";
import { requestMcp } from "../factories/request-mcp.ts";

unit(requestMcp, requestMcpCases);
