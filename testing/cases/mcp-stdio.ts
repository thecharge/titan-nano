import { McpIdentity, McpStdioFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";
import { checkedWorkflow } from "../factories/hardening.ts";

const check = { name: McpIdentity.Check, arguments: { workflow: checkedWorkflow() } };
const missing = { name: McpIdentity.Check, arguments: {} };

export const mcpStdioFramesCases = {
  positive: [
    positive(
      "tool inventory retains pure protocol frames",
      [McpStdioFixture.ToolsList, {}, false],
      true,
    ),
    positive(
      "workflow checking retains pure protocol frames",
      [McpStdioFixture.ToolCall, check, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "unknown method returns a protocol error",
      [McpStdioFixture.UnknownMethod, {}, true],
      true,
    ),
    rejected(
      "missing workflow returns a protocol error",
      [McpStdioFixture.ToolCall, missing, true],
      true,
    ),
  ],
};
