import { strict as assert } from "node:assert";
import type { RunAction, RunStatus } from "@titan/constants";
import { BoardLimit, CliCommand, DataKind, HttpStatus, McpIdentity } from "@titan/constants";
import { TransportMessage } from "@titan/messages";
import { createRunClient } from "@titan/server/client";
import { EventPageSchema, McpTextContentSchema, RunSnapshotSchema } from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { withClientAddress, withClientResponse } from "../support/client.ts";
import { withMemoryMcp } from "../support/mcp.ts";

export async function runResponse(action: RunAction | null, id: string, state: RunStatus) {
  return withClientResponse(
    Response.json({ run_id: id, state, root: "/kept/run", artifacts: null, nodes: {} }),
    async (client) => {
      const run = action
        ? await client.control("selected-run", action)
        : await client.get("selected-run");
      return { run_id: run.run_id, state: run.state };
    },
  );
}

export async function cliRunResponse(action: RunAction | null, id: string, state: RunStatus) {
  const events = async () =>
    EventPageSchema.parse({
      schema_version: BoardLimit.EventPageVersion,
      run_id: "selected-run",
      after: 0,
      events: [],
      next_cursor: 0,
      has_more: false,
    });
  return withClientAddress(
    Response.json({ run_id: id, state, root: "/kept/run", artifacts: null, nodes: {} }),
    async (home) => {
      const output: unknown[] = [];
      const cli = createCli({
        ...defaultServices,
        client: (home) => ({ ...createRunClient(home), events }),
        output: (value) => output.push(value),
      });
      try {
        await cli([action ?? CliCommand.Status, "selected-run", "--home", home, "--json"]);
      } catch (error) {
        assert.equal(output.length, 0);
        throw error;
      }
      assert.equal(output.length, 1);
      const run = RunSnapshotSchema.parse(output[0]);
      return { run_id: run.run_id, state: run.state };
    },
  );
}

export async function mcpRunResponse(action: RunAction | null, id: string, state: RunStatus) {
  return withClientAddress(
    Response.json({ run_id: id, state, root: "/kept/run", artifacts: null, nodes: {} }),
    async (home) =>
      withMemoryMcp(home, async (client) => {
        const result = await client.callTool({
          name: `${McpIdentity.Prefix}${action ?? CliCommand.Status}`,
          arguments: { run_id: "selected-run" },
        });
        const text = McpTextContentSchema.parse(result.content)[0]?.text;
        if (result.isError) {
          assert.equal(text, TransportMessage.InvalidRun);
          return false;
        }
        const run = RunSnapshotSchema.parse(JSON.parse(text ?? ""));
        assert.equal(run.run_id, "selected-run");
        assert.equal(run.state, state);
        return true;
      }),
  );
}

export async function rawRunResponse(body: unknown, status = HttpStatus.Ok) {
  const response =
    typeof body === DataKind.String
      ? new Response(String(body), { status })
      : Response.json(body, { status });
  return withClientResponse(response, async (client) => (await client.get("selected-run")).state);
}
