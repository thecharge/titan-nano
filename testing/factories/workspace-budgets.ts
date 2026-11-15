import { expect } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import { AgentTool, Backend, RunEventKind, RunStatus } from "@titan/constants";
import { Engine } from "@titan/runner";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type FileMap, ObjectSchema, type WorkspaceLimitsInput } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { createWorkspace, exists, readTree, writeTree } from "@titan/workspace";

async function prepareBudgetFile(root: string, path: string, bytes: number): Promise<void> {
  if (path.endsWith("/")) await mkdir(resolve(root, path), { recursive: true });
  else {
    await mkdir(dirname(resolve(root, path)), { recursive: true });
    await writeFile(resolve(root, path), Buffer.alloc(bytes, 1));
  }
}

async function copyBudget(
  source: string,
  target: string,
  files: FileMap,
  limits: WorkspaceLimitsInput,
  workspace: boolean,
) {
  try {
    if (workspace) await createWorkspace(source, target, files, limits);
    else await writeTree(target, files, limits);
    return Object.keys(await readTree(target, limits));
  } catch (error) {
    expect(await exists(target)).toBe(false);
    throw error;
  }
}

export async function workspaceBudget(
  entries: Record<string, number>,
  limits: WorkspaceLimitsInput,
  write = false,
  workspace = false,
) {
  return withTemporaryDirectory(async (root) => {
    const source = resolve(root, "source");
    const target = resolve(root, "target");
    await mkdir(source);
    for (const [path, bytes] of Object.entries(entries))
      await prepareBudgetFile(source, path, bytes);
    if (!write) return Object.keys(await readTree(source, limits));
    return copyBudget(source, target, await readTree(source), limits, workspace);
  });
}

export async function configuredWorkspaceBudget(owner: unknown, workflow: unknown) {
  return withTemporaryDirectory(async (root) => {
    await writeFile(resolve(root, "config.yaml"), Buffer.from(JSON.stringify({ limits: owner })));
    const config = await resolveConfig({
      home: root,
      project: root,
      workflow: { limits: workflow },
    });
    return {
      entries: config.value.limits.max_workspace_entries,
      bytes: config.value.limits.max_workspace_bytes,
      depth: config.value.limits.max_workspace_depth,
    };
  });
}

function budgetBackend(): FakeBackend {
  return new FakeBackend(async (spec) => {
    if (spec.writable) {
      const name = spec.invocation_id.split("/")[0] ?? "missing";
      await mkdir(resolve(spec.cwd, "nested"), { recursive: true });
      await writeFile(resolve(spec.cwd, "nested", name), Buffer.alloc(4, 1));
    }
    return { json: spec.writable ? { ok: true } : { verdict: "survived", evidence: "Checked" } };
  });
}

function budgetPlan(parallel: boolean) {
  const steps = ["left", ...(parallel ? ["right"] : [])].map((id) => ({
    id,
    do: { persona: "worker", task: "Write candidate" },
    falsify: [{ persona: "checker", task: "Check candidate" }],
  }));
  const personas = {
    worker: { description: "Writer", role: "Write", tools: [AgentTool.Write] },
    checker: { description: "Checker", role: "Check" },
  };
  return validateWorkflow({
    name: "Workspace budgets",
    goal: "Bound candidate and assembled files",
    personas,
    steps: parallel ? [{ parallel: steps }] : steps,
  });
}

export async function engineWorkspaceBudget(limits: WorkspaceLimitsInput, parallel = false) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(project);
    await writeFile(resolve(project, "source"), Buffer.from("base"));
    const engine = new Engine(() => budgetBackend());
    const run = await engine.create({
      project,
      plan: budgetPlan(parallel),
      config: await resolveConfig({ home, project, workflow: { limits } }),
      backend: Backend.Fake,
      client_id: "budgets",
      submission_id: "candidate",
    });
    await engine.start(run.run_id);
    const events = await engine.events(run.run_id);
    const interrupted = events.events.find((event) => event.type === RunEventKind.StepBlocked);
    for (const node of Object.values(run.nodes)) expect(node.evidence).toEqual([]);
    return {
      passed: run.state === RunStatus.Passed,
      blocked: run.state === RunStatus.Blocked,
      reason: run.error ?? ObjectSchema.parse(interrupted?.data ?? {}).error ?? null,
      refutations: Object.values(run.nodes).reduce((sum, node) => sum + node.refutations, 0),
      original: (await readFile(resolve(project, "source"))).equals(Buffer.from("base")),
      files: run.artifacts ? Object.keys(await readTree(run.artifacts)) : [],
    };
  });
}
