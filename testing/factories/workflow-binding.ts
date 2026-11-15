import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { type AgentTool, CliCommand } from "@titan/constants";
import { startMcp } from "@titan/server/mcp";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type BackendId, EffectiveConfigSchema, ObjectSchema, PlanSchema } from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";

export async function cliWorkflowBinding(command: CliCommand, first: unknown, second: unknown) {
  return withTemporaryDirectory(async (root) => {
    let reads = 0;
    const output: unknown[] = [];
    const main = createCli({
      ...defaultServices,
      async loadData() {
        reads++;
        return reads === 1 ? first : second;
      },
      output: (value) => output.push(value),
    });
    const exit = await main([
      command,
      "workflow.yaml",
      "--json",
      "--home",
      root,
      "--project",
      root,
      ...(command === CliCommand.Run ? ["--dry-run"] : []),
    ]);
    const response = ObjectSchema.parse(output[0]);
    return {
      exit,
      reads,
      ids: PlanSchema.shape.nodes.parse(response.nodes).map((node) => node.id),
      backend: EffectiveConfigSchema.parse(response.config).value.defaults.backend,
    };
  });
}

export async function mcpConfiguredCheck(
  owner: unknown,
  projectSettings: unknown,
  tools: AgentTool[],
  backend?: BackendId,
  nested = false,
) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(home);
    await mkdir(resolve(project, ".titan"), { recursive: true });
    await writeFile(resolve(home, "config.yaml"), Buffer.from(JSON.stringify(owner)));
    await writeFile(
      resolve(project, ".titan/config.yaml"),
      Buffer.from(JSON.stringify(projectSettings)),
    );
    const base = vendorRecoveryWorkflow();
    base.personas.checker.tools = tools;
    const first = base.steps[0];
    const steps = [first, { ...first, id: "second" }];
    const inner = { sequential: steps };
    const outer = { sequential: [inner] };
    const workflow = { ...base, steps: nested ? [outer] : steps };
    const client = new Client({ name: "configuration-contract", version: "1" });
    const [left, right] = InMemoryTransport.createLinkedPair();
    const server = await startMcp(home, left);
    try {
      await client.connect(right);
      const arguments_ = { workflow, project, ...(backend ? { backend } : {}) };
      const result = await client.callTool({ name: "titan_check", arguments: arguments_ });
      return !result.isError;
    } finally {
      await client.close();
      await server.close();
    }
  });
}
