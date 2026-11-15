import { expect } from "bun:test";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import { Backend, RunStatus, WorkspaceModeSetting } from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { Capacity, Engine } from "@titan/runner";
import type { FakeHandler, SessionIdentity } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { readTree, writeTree } from "@titan/workspace";

const roots: string[] = [];
async function temporary(): Promise<string> {
  const path = await mkdtemp(resolve(tmpdir(), "titan-engine-"));
  roots.push(path);
  return path;
}
const personas = {
  writer: { description: "Writes", role: "Solve", tools: ["Write"] },
  skeptic: { description: "Checks", role: "Refute" },
};
const step = (id: string) => ({
  id,
  do: { persona: "writer", task: "Solve" },
  falsify: [{ persona: "skeptic", task: "Refute" }],
});
async function setup(handler: FakeHandler, steps: unknown[] = [step("a")], retries = 2) {
  const project = await temporary();
  const home = await temporary();
  const config = await resolveConfig({
    home,
    project,
    overrides: {
      workspace: { mode: WorkspaceModeSetting.Isolated },
      recovery: { max_retries: retries, base_delay_s: 0.001, max_delay_s: 0.002, jitter_ratio: 0 },
    },
  });
  const plan = validateWorkflow({
    name: "Engine",
    goal: "Deliver files with independent checks",
    personas,
    steps,
  });
  const backend = new FakeBackend(handler);
  const engine = new Engine(() => backend, { max_active_agents: 2 });
  const run = await engine.create({
    project,
    plan,
    config,
    backend: Backend.Fake,
    client_id: "test",
    submission_id: "one",
  });
  return { project, home, run, engine, backend };
}
const survived = { verdict: "survived", evidence: "Checked the candidate" };
export const engineContractCleanup = async () => {
  for (const path of roots.splice(0)) await rm(path, { recursive: true, force: true });
};
export const engineMixedArtifacts = async () => {
  const starts: string[] = [];
  const { engine, run, project } = await setup(
    async (spec) => {
      starts.push(spec.invocation_id);
      if (spec.writable)
        await writeFile(resolve(spec.cwd, `${spec.invocation_id.split("/")[0]}.txt`), "delivered");
      return { json: spec.writable ? { done: true } : survived };
    },
    [step("a"), { parallel: [step("b"), step("c")] }, step("d")],
  );
  await engine.start(run.run_id);
  expect(run.state).toBe(RunStatus.Passed);
  expect(Object.keys(await readTree(project))).toEqual([]);
  expect(Object.keys(await readTree(run.artifacts ?? ""))).toEqual([
    "a.txt",
    "b.txt",
    "c.txt",
    "d.txt",
  ]);
  expect(starts.indexOf("d/1/worker")).toBeGreaterThan(starts.indexOf("c/1/falsifier-0"));
  expect((await engine.events(run.run_id)).events.at(-1)?.type).toBe("run_passed");
};
export const engineSameSessionRecovery = async () => {
  let calls = 0;
  const { engine, run } = await setup(async (spec) => {
    if (spec.writable && calls++ === 0)
      throw new OperationalError("rate_limit", "Stub throttle", true);
    return { json: spec.writable ? { done: true } : survived };
  });
  await engine.start(run.run_id);
  expect(run.state).toBe(RunStatus.Passed);
  const node = run.nodes.a;
  expect(node?.attempt).toBe(1);
  expect(node?.refutations).toBe(0);
  expect(node?.phases.worker?.executions).toBe(2);
  expect(node?.phases.worker?.retries).toBe(1);
  expect(
    new Set(
      (await engine.events(run.run_id)).events
        .filter((event) => event.type === "agent_event")
        .map((event) => (event.data as SessionIdentity).session_id),
    ).size,
  ).toBe(2);
};
export const engineExhaustedRecovery = async () => {
  const { engine, run } = await setup(
    async () => {
      throw new OperationalError("rate_limit", "Still throttled", true);
    },
    undefined,
    1,
  );
  await engine.start(run.run_id);
  expect(run.state).toBe(RunStatus.Blocked);
  expect(run.nodes.a?.refutations).toBe(0);
  expect(run.nodes.a?.phases.worker?.executions).toBe(2);
  await engine.resume(run.run_id);
  expect(run.nodes.a?.phases.worker?.executions).toBe(2);
};
export const engineQualityEvidence = async () => {
  let checks = 0;
  const prompts: string[] = [];
  const { engine, run } = await setup(async (spec, prompt) => {
    if (spec.writable) {
      prompts.push(prompt);
      return { json: { answer: "revision" } };
    }
    return {
      json: checks++ === 0 ? { verdict: "refuted", evidence: "Counterexample 7" } : survived,
    };
  });
  await engine.start(run.run_id);
  expect(run.state).toBe(RunStatus.Passed);
  expect(run.nodes.a?.attempt).toBe(2);
  expect(run.nodes.a?.refutations).toBe(1);
  expect(prompts[1]).toContain("Counterexample 7");
};
export const engineMalformedChecker = async () => {
  const { engine, run } = await setup(async (spec) => ({
    json: spec.writable ? "answer" : { verdict: "refuted", evidence: "" },
  }));
  await engine.start(run.run_id);
  expect(run.state).toBe(RunStatus.Blocked);
  expect(run.nodes.a?.refutations).toBe(0);
};
export const engineParallelConflicts = async () => {
  const { engine, run } = await setup(
    async (spec) => {
      if (spec.writable) await writeFile(resolve(spec.cwd, "shared.txt"), spec.invocation_id);
      return { json: spec.writable ? "answer" : survived };
    },
    [{ parallel: [step("a"), step("b")] }],
  );
  await engine.start(run.run_id);
  expect(run.state).toBe(RunStatus.Blocked);
  expect(run.error).toContain("conflict");
};
export const engineTornJournal = async () => {
  const { engine, run } = await setup(async (spec) => ({
    json: spec.writable ? "answer" : survived,
  }));
  await engine.start(run.run_id);
  await appendFile(resolve(run.root, "board.jsonl"), '{"torn":');
  const recovered = await new RunStore(run.root).read();
  expect(recovered.state).toBe(RunStatus.Passed);
  expect((await readFile(resolve(run.root, "board.jsonl"), "utf8")).endsWith("\n")).toBe(true);
};
export const engineRestartedChecker = async () => {
  let fail = true;
  let worker = 0;
  const { engine, backend, run } = await setup(async (spec) => {
    if (spec.writable) {
      worker++;
      return { json: "answer" };
    }
    if (fail) throw new OperationalError("offline", "Stub unavailable");
    return { json: survived };
  });
  await engine.start(run.run_id);
  expect(run.state).toBe(RunStatus.Blocked);
  fail = false;
  const restarted = new Engine(() => backend);
  const restored = await restarted.load(run.root);
  await restarted.resume(run.run_id);
  expect(restored.state).toBe(RunStatus.Passed);
  expect(worker).toBe(1);
  expect(restored.nodes.a?.attempt).toBe(1);
};
export const engineCapacityCancellation = async () => {
  const capacity = new Capacity(1);
  const first = new AbortController();
  const second = new AbortController();
  const { promise, resolve: release } = Promise.withResolvers<void>();
  let ran = false;
  const holding = capacity.use("first", first.signal, () => promise);
  await Bun.sleep(1);
  const execute = async () => {
    ran = true;
  };
  const waiting = capacity.use("second", second.signal, execute);
  second.abort(new Error("paused"));
  await expect(waiting).rejects.toThrow("paused");
  expect(ran).toBe(false);
  release();
  await holding;
  await capacity.use("third", first.signal, execute);
  expect(ran).toBe(true);
};
export const engineUnsafeSnapshot = async () => {
  await expect(
    writeTree(await temporary(), {
      "../escape": { source: "/never-read", hash: "unused", bytes: 0, executable: false },
    }),
  ).rejects.toThrow("Unsafe");
};
