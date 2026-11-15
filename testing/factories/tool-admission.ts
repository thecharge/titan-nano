import { expect } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { resolveConfig } from "@titan/config";
import { type AgentTool, Backend, BoardFile } from "@titan/constants";
import { Engine } from "@titan/runner";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { startMcp } from "@titan/server/mcp";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { BackendId } from "@titan/types";
import { validatePlanTools, validateWorkflow } from "@titan/workflow";
import { exists } from "@titan/workspace";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { createFakeBackend } from "../support/backend.ts";

function toolPlan(
  worker: AgentTool[],
  checker: AgentTool[],
  backend?: BackendId,
  defaults?: BackendId,
) {
  return validateWorkflow({
    name: "Tool admission",
    goal: "Refuse unsupported permissions before execution",
    ...(defaults ? { defaults: { backend: defaults } } : {}),
    personas: {
      worker: {
        description: "Worker",
        role: "Deliver",
        tools: worker,
        ...(backend ? { backend } : {}),
      },
      checker: {
        description: "Checker",
        role: "Check",
        tools: checker,
        ...(backend ? { backend } : {}),
      },
    },
    steps: [
      {
        id: "deliver",
        do: { persona: "worker", task: "Deliver" },
        falsify: [{ persona: "checker", task: "Check" }],
      },
    ],
  });
}

export function planToolAdmission(
  worker: AgentTool[],
  checker: AgentTool[],
  backend?: BackendId,
  fallback?: BackendId,
  defaults?: BackendId,
  missing = false,
) {
  const plan = toolPlan(worker, checker, backend, defaults);
  if (missing) delete plan.workflow.personas.worker;
  validatePlanTools(plan, fallback);
  return true;
}

export async function cliToolAdmission(worker: AgentTool[], checker: AgentTool[]) {
  return withTemporaryDirectory(async (root) => {
    const file = resolve(root, "workflow.yaml");
    await writeFile(file, Bun.YAML.stringify(toolPlan(worker, checker, Backend.Claude).workflow));
    const main = createCli({ ...defaultServices, output() {} });
    return (await main(["check", file, "--home", root, "--project", root])) === 0;
  });
}

export async function engineToolAdmission(worker: AgentTool[], checker: AgentTool[]) {
  return withTemporaryDirectory(async (root) => {
    const config = await resolveConfig({ home: root, project: root });
    const engine = new Engine(() => createFakeBackend());
    engine.preflight(toolPlan(worker, checker, Backend.Claude), config, Backend.Fake);
    return true;
  });
}

export async function mcpToolAdmission(worker: AgentTool[], checker: AgentTool[]) {
  return withTemporaryDirectory(async (root) => {
    const client = new Client({ name: "permission-contract", version: "1" });
    const [left, right] = InMemoryTransport.createLinkedPair();
    const server = await startMcp(root, left);
    try {
      await client.connect(right);
      const result = await client.callTool({
        name: "titan_check",
        arguments: { workflow: toolPlan(worker, checker, Backend.Claude).workflow },
      });
      return !result.isError;
    } finally {
      await client.close();
      await server.close();
    }
  });
}

export async function cliFallbackToolAdmission(
  worker: AgentTool[],
  checker: AgentTool[],
  fallback: BackendId,
) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(home);
    await mkdir(project);
    const file = resolve(project, "workflow.yaml");
    await writeFile(file, Bun.YAML.stringify(toolPlan(worker, checker).workflow));
    const main = createCli({ ...defaultServices, output() {} });
    return (
      (await main(["check", file, "--home", home, "--project", project, "--backend", fallback])) ===
      0
    );
  });
}

export async function httpToolAdmission(worker: AgentTool[], checker: AgentTool[]) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(home);
    await mkdir(project);
    const server = await startServer(home, () => createFakeBackend());
    const client = createRunClient(home);
    try {
      const run = await client.submit({
        project,
        workflow: toolPlan(worker, checker, Backend.Claude).workflow,
        backend: Backend.Fake,
        client_id: "permission-contract",
        submission_id: "permission-contract",
      });
      return Boolean(run.run_id);
    } catch (error) {
      expect((await client.list()).runs).toHaveLength(0);
      expect(await exists(resolve(project, BoardFile.Runs))).toBe(false);
      throw error;
    } finally {
      await server.stop();
    }
  });
}
