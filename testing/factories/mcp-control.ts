import { expect } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { startServer } from "@titan/server";
import { startMcp } from "@titan/server/mcp";
import { McpTextContentSchema, RunIdentitySchema } from "@titan/types";
import { createFakeBackend } from "../support/backend.ts";

export const mcpDurableControls = async () => {
  const home = await mkdtemp(resolve(tmpdir(), "titan-mcp-home-"));
  const project = await mkdtemp(resolve(tmpdir(), "titan-mcp-project-"));
  const http = await startServer(home, () => createFakeBackend());
  const client = new Client({ name: "stub-harness", version: "1" });
  const [left, right] = InMemoryTransport.createLinkedPair();
  const mcp = await startMcp(home, left);
  const workflow = {
    name: "MCP result",
    goal: "Checked result",
    personas: {
      worker: { description: "Worker", role: "Solve" },
      checker: { description: "Checker", role: "Refute" },
    },
    steps: [
      {
        id: "one",
        do: { persona: "worker", task: "Solve" },
        falsify: [{ persona: "checker", task: "Refute" }],
      },
    ],
  };
  try {
    await client.connect(right);
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toContain("titan_run");
    await client.callTool({ name: "titan_schema", arguments: {} });
    expect(
      (await client.callTool({ name: "titan_check", arguments: { workflow } })).isError,
    ).not.toBe(true);
    const submitted = await client.callTool({
      name: "titan_run",
      arguments: { workflow, project, backend: "fake", client_id: "mcp", submission_id: "one" },
    });
    const content = McpTextContentSchema.parse(submitted.content);
    const run = RunIdentitySchema.parse(JSON.parse(content[0]?.text ?? ""));
    expect(run.run_id).toBeString();
    for (const action of ["runs", "status", "events", "pause", "resume", "cancel"]) {
      const answer = await client.callTool({
        name: `titan_${action}`,
        arguments: action === "runs" ? {} : { run_id: run.run_id },
      });
      expect(Array.isArray(answer.content)).toBe(true);
    }
    const invalid = await client.callTool({ name: "titan_check", arguments: { workflow: {} } });
    expect(invalid.isError).toBe(true);
  } finally {
    await client.close();
    await mcp.close();
    await http.stop();
    await rm(home, { recursive: true, force: true });
    await rm(project, { recursive: true, force: true });
  }
};
