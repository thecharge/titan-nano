import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { mcpStdioFramesCases } from "../cases/mcp-stdio.ts";
import { mcpStdioFrames } from "../factories/mcp-stdio.ts";

unit(mcpStdioFrames, mcpStdioFramesCases, undefined, TestSchedule.Concurrent);
