import { test } from "bun:test";
import { mcpDurableControls } from "../factories/mcp-control.ts";

test("MCP tools validate, submit and control the same durable HTTP run", mcpDurableControls);
