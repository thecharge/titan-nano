import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import { Backend, ErrorCode, RunStatus, StepStatus, TaskOutcome } from "@titan/constants";
import { settle } from "@titan/core";
import { TitanError } from "@titan/errors";
import { Capacity, Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { AgentCapacitySchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { isolatedWorkspace } from "../support/isolated.ts";

export async function capacitySettings(active: number, pending: number) {
  new Capacity(active, pending);
  return true;
}

export async function capacityAdmission(key: string, aborted: boolean) {
  const controller = new AbortController();
  if (aborted)
    controller.abort(new TitanError(ErrorCode.ExecutionInterrupted, "Already cancelled"));
  let calls = 0;
  await new Capacity(1).use(key, controller.signal, async () => {
    calls++;
  });
  return calls;
}

export async function capacityFairness(reverse: boolean, cancel: boolean) {
  const capacity = new Capacity(1, 4);
  const controller = new AbortController();
  const cancelled = new AbortController();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const order: string[] = [];
  const owner = capacity.use("owner", controller.signal, async () => {
    entered.resolve();
    await release.promise;
  });
  await entered.promise;
  const keys = reverse ? ["second", "first"] : ["first", "second"];
  const observe = (key: string, label: string, signal: AbortSignal) =>
    capacity.use(key, signal, async () => {
      order.push(label);
    });
  try {
    const first = observe(keys[0] ?? "first", "first", controller.signal);
    const sibling = observe(keys[0] ?? "first", "sibling", cancelled.signal).catch(() => {
      order.push("cancelled");
    });
    const second = observe(keys[1] ?? "second", "second", controller.signal);
    if (cancel) cancelled.abort();
    release.resolve();
    await owner;
    await settle([() => first, () => sibling, () => second]);
    return order;
  } finally {
    release.resolve();
    await owner;
  }
}

export async function capacityBudget(maximum: number, cancel: boolean, sameKey: boolean) {
  const capacity = new Capacity(1, maximum);
  const signal = new AbortController();
  const queued = new AbortController();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const calls: string[] = [];
  const first = capacity.use("owner", signal.signal, async () => {
    entered.resolve();
    await release.promise;
    calls.push("owner");
  });
  await entered.promise;
  const observe = (key: string, controller: AbortController, label: string) =>
    capacity
      .use(key, controller.signal, async () => {
        calls.push(label);
        return "started";
      })
      .catch((error) => (error instanceof TitanError ? error.code : "cancelled"));
  try {
    const waiting = observe("first", queued, "first");
    const other = observe(sameKey ? "first" : "second", signal, "second");
    if (cancel) queued.abort(new Error("Cancelled queued task"));
    const replacement = observe("replacement", signal, "replacement");
    release.resolve();
    await first;
    const outcomes = await settle([() => waiting, () => other, () => replacement]);
    assert.ok(outcomes.every((outcome) => outcome.status === TaskOutcome.Fulfilled));
    return {
      outcomes: outcomes.map((outcome) =>
        outcome.status === TaskOutcome.Fulfilled ? outcome.value : null,
      ),
      calls,
    };
  } finally {
    release.resolve();
    await first;
  }
}

export async function capacityOverlap(limit: number, failure: boolean) {
  const capacity = new Capacity(limit, 4);
  const controller = new AbortController();
  let active = 0;
  let peak = 0;
  let completed = 0;
  const results = await settle(
    [0, 1, 2, 3].map(
      (index) => () =>
        capacity.use("run", controller.signal, async () => {
          active++;
          peak = Math.max(peak, active);
          try {
            await Bun.sleep(10);
            if (failure && index === 0) throw new Error("Deliberate worker failure");
            return index;
          } finally {
            active--;
            completed++;
          }
        }),
    ),
  );
  return {
    peak,
    active,
    completed,
    failures: results.filter((result) => result.status === TaskOutcome.Rejected).length,
  };
}

export async function configuredAgentCapacity(settings: unknown, owner: boolean) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    await mkdir(project);
    const file = resolve(owner ? root : project, "config.yaml");
    await writeFile(file, Buffer.from(JSON.stringify({ server: settings })));
    const config = await resolveConfig({
      home: root,
      project,
      overrides: isolatedWorkspace,
      ...(owner ? {} : { configFile: file }),
    });
    return AgentCapacitySchema.parse({
      max_active_agents: config.value.server.max_active_agents,
      max_pending_agents: config.value.server.max_pending_agents,
    });
  });
}

export async function capacityRunRecovery(recover: boolean, reload: boolean) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    const home = resolve(root, "home");
    await mkdir(project);
    await mkdir(home);
    await writeFile(
      resolve(home, "config.yaml"),
      Buffer.from(JSON.stringify({ server: { max_active_agents: 1, max_pending_agents: 0 } })),
    );
    const config = await resolveConfig({ home, project, overrides: isolatedWorkspace });
    const release = Promise.withResolvers<void>();
    const calls = new Map<string, number>();
    let held: string | null = null;
    const backend = new FakeBackend(async (spec) => {
      if (spec.writable) calls.set(spec.invocation_id, (calls.get(spec.invocation_id) ?? 0) + 1);
      if (spec.writable && held === null) {
        held = spec.invocation_id;
        await release.promise;
      }
      return {
        json: spec.writable
          ? { ok: true, marker: "capacity", turn: 1 }
          : { verdict: "survived", evidence: "Inspected candidate" },
      };
    });
    const base = vendorRecoveryWorkflow();
    const workflow = {
      ...base,
      limits: { max_parallel: 2 },
      steps: [
        {
          parallel: [
            { ...base.steps[0], id: "first" },
            { ...base.steps[0], id: "second" },
          ],
        },
      ],
    };
    let engine = new Engine(() => backend, { max_active_agents: 1, max_pending_agents: 0 });
    const run = await engine.create({
      plan: validateWorkflow(workflow),
      project,
      config,
      backend: Backend.Fake,
      client_id: "capacity",
      submission_id: "capacity",
    });
    const running = engine.start(run.run_id);
    try {
      assert.ok(
        await waitUntil(async () =>
          Object.values(engine.get(run.run_id).nodes).some(
            (node) => node.state === StepStatus.Blocked,
          ),
        ),
      );
      release.resolve();
      await running;
      const blocked = Object.values(run.nodes).find((node) => node.state === StepStatus.Blocked);
      assert.ok(blocked);
      const before = {
        attempt: blocked.attempt,
        refutations: blocked.refutations,
        executions: blocked.phases.worker?.executions,
        session: blocked.phases.worker?.session_id,
      };
      if (reload) {
        engine = new Engine(() => backend, { max_active_agents: 1, max_pending_agents: 0 });
        await engine.load(run.root);
      }
      if (recover) await engine.resume(run.run_id);
      const final = await engine.snapshot(run.run_id);
      assert.equal(final.state, recover ? RunStatus.Passed : RunStatus.Blocked);
      return {
        before,
        state: final.state,
        workerCalls: [...calls.values()],
        refutations: Object.values(final.nodes).map((node) => node.refutations),
        attempts: Object.values(final.nodes).map((node) => node.attempt),
      };
    } finally {
      release.resolve();
      await running;
    }
  });
}
