import { strict as assert } from "node:assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { AskMode, McpIdentity, RequestKind, ToolWait, ToolWaitFixture } from "@titan/constants";
import { startMcp } from "@titan/server/mcp";
import { McpRequestResultSchema, McpTextContentSchema, type Run } from "@titan/types";
import { withArtifactRun } from "./artifacts.ts";
import { askAnswer } from "./ask-answer.ts";

function openArguments(run: Run, mode: ToolWaitFixture) {
  return {
    run_id: run.run_id,
    input: {
      request_id: ToolWait.RequestId,
      kind: mode === ToolWaitFixture.Human ? RequestKind.Action : RequestKind.Tool,
      scope:
        mode === ToolWaitFixture.InvalidScope
          ? {}
          : {
              operation: ToolWait.Operation,
              resource: ToolWait.Resource,
              content_hashes: {},
              arguments: [],
              environment_names: [],
            },
      origin: { client_id: ToolWait.Client, harness_session_id: ToolWait.Session },
      expires_at: Date.now() + ToolWait.ExpiresMs,
    },
  };
}

async function toolReturn(mode: ToolWaitFixture): Promise<string> {
  return withArtifactRun(false, async (run, home) => {
    const [left, right] = InMemoryTransport.createLinkedPair();
    const server = await startMcp(home, left);
    const client = new Client({ name: ToolWait.ClientName, version: ToolWait.ClientVersion });
    try {
      await client.connect(right);
      const started = performance.now();
      const response = await client.callTool({
        name: McpIdentity.RequestOpen,
        arguments: openArguments(run, mode),
      });
      const quick = performance.now() - started < ToolWait.LimitMs;
      if (response.isError === true) return `${ToolWait.Error} ${quick}`;
      const payload = McpRequestResultSchema.parse(
        JSON.parse(McpTextContentSchema.parse(response.content)[0]?.text ?? ""),
      );
      assert.equal(payload.request.answer, null);
      return `${payload.state} ${quick}`;
    } finally {
      await client.close();
      await server.close();
    }
  });
}

export async function toolWaits(mode: ToolWaitFixture): Promise<string> {
  const returned = await toolReturn(mode);
  if (mode === ToolWaitFixture.Answered)
    return `${returned} ${await askAnswer(1, false, AskMode.Answered)}`;
  if (mode === ToolWaitFixture.Unanswered)
    return `${returned} ${await askAnswer(1, false, AskMode.Unanswered)}`;
  return returned;
}
