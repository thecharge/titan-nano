import { strict as assert } from "node:assert";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  LongGraphFixture,
  LongGraphMode,
  RunEventKind,
  RunStatus,
  StepStatus,
  Verdict,
  WorkspaceModeSetting,
} from "@titan/constants";
import { Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { NodeState, Plan, Run } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { readTree } from "@titan/workspace";

function longPlan(reverse: boolean): Plan {
  const workflow = vendorRecoveryWorkflow();
  const target = workflow.steps[0];
  assert.ok(target);
  const nodes = Array.from({ length: LongGraphFixture.Waves }, (_, wave) => {
    const id = (part: string) => `wave-${wave}-${part}`;
    const dependencies = [
      wave ? [`wave-${wave - 1}-tail`] : [],
      [id("seed")],
      [id("seed")],
      [id("left"), id("right")],
      [id("join")],
    ];
    return LongGraphFixture.Parts.map((part, index) => ({
      ...target,
      id: id(part),
      needs: dependencies[index] ?? [],
    }));
  }).flat();
  const { steps, ...base } = workflow;
  return validateWorkflow({ ...base, graph: { nodes: reverse ? nodes.reverse() : nodes } });
}

function ancestors(plan: Plan, id: string): string[] {
  const selected = new Set<string>();
  const pending = [...(plan.nodes.find((node) => node.id === id)?.needs ?? [])];
  while (pending.length) {
    const next = pending.pop();
    if (!next || selected.has(next)) continue;
    selected.add(next);
    pending.push(...(plan.nodes.find((node) => node.id === next)?.needs ?? []));
  }
  return [...selected];
}

export async function longGraph(mode: LongGraphMode, reverse: boolean): Promise<boolean> {
  return withTemporaryDirectory(async (project) => {
    const plan = longPlan(reverse);
    assert.equal(plan.nodes.length, LongGraphFixture.Nodes);
    const paired = new Set<string>();
    const started = new Set<string>();
    let active = 0;
    let peak = 0;
    let current: Run | null = null;
    const failed =
      mode === LongGraphMode.Complete
        ? null
        : `wave-${LongGraphFixture.RefutationWave}-${mode === LongGraphMode.RefuteLeft ? "left" : "right"}`;
    const backend = new FakeBackend(async (spec, _prompt, signal) => {
      const id = spec.invocation_id.split("/")[0];
      assert.ok(id);
      assert.ok(current);
      assert.ok(!started.has(spec.invocation_id), "A physical phase cannot run twice");
      started.add(spec.invocation_id);
      const node = plan.nodes.find((entry) => entry.id === id);
      assert.ok(node);
      for (const dependency of node.needs ?? [])
        assert.equal(current.nodes[dependency]?.state, StepStatus.Passed);
      for (const parent of ancestors(plan, id))
        assert.deepEqual(await readFile(resolve(spec.cwd, `${parent}.txt`)), Buffer.from(parent));
      active++;
      peak = Math.max(peak, active);
      try {
        if (!spec.writable) {
          assert.deepEqual(await readFile(resolve(spec.cwd, `${id}.txt`)), Buffer.from(id));
          return {
            json: {
              verdict: id === failed ? Verdict.Refuted : Verdict.Survived,
              evidence: "Independent graph check",
            },
          };
        }
        if (id.endsWith("-left") || id.endsWith("-right")) {
          paired.add(id);
          const peer = id.endsWith("-left")
            ? id.replace(/-left$/, "-right")
            : id.replace(/-right$/, "-left");
          assert.ok(
            await waitUntil(async () => paired.has(peer)),
            "Parallel peer must enter before release",
          );
        }
        signal.throwIfAborted();
        await writeFile(resolve(spec.cwd, `${id}.txt`), Buffer.from(id));
        return { json: { ok: true, marker: id, turn: 1 } };
      } finally {
        active--;
      }
    });
    const factory = () => backend;
    const engine = new Engine(factory, { max_active_agents: LongGraphFixture.Width });
    current = await engine.create({
      project,
      plan,
      backend: Backend.Fake,
      client_id: "long-graph",
      submission_id: "mixed-plan",
      config: await resolveConfig({
        home: resolve(project, "home"),
        project,
        overrides: {
          workspace: { mode: WorkspaceModeSetting.Isolated },
          defaults: { max_attempts: 1 },
          limits: { max_parallel: LongGraphFixture.Width },
        },
      }),
    });
    const initial = structuredClone(current);
    await completeGraph(engine, current);
    assert.equal(active, 0);
    assert.deepEqual(await readTree(project), {});
    assert.equal(peak, LongGraphFixture.Width);
    assert.equal(current.state, failed ? RunStatus.Failed : RunStatus.Passed);
    assertGraphNodes(current, initial, failed);
    assert.equal(
      started.size,
      failed ? LongGraphFixture.RefutedStarts : LongGraphFixture.CompletedStarts,
    );
    await assertGraphDelivery(current, failed);
    const recovered = await new Engine(factory).load(current.root);
    assert.equal(recovered.version, current.version);
    assert.deepEqual(recovered.nodes, current.nodes);
    assert.equal(
      started.size,
      failed ? LongGraphFixture.RefutedStarts : LongGraphFixture.CompletedStarts,
    );
    return true;
  });
}

export async function completeGraph(
  engine: Engine,
  run: Run,
  maximum: number = LongGraphFixture.ExecutionMilliseconds,
): Promise<void> {
  const budget = Promise.withResolvers<void>();
  const timer = setTimeout(
    () => budget.reject(new Error("Mixed graph exceeded its execution budget")),
    maximum,
  );
  const work = engine.start(run.run_id);
  let completed = false;
  try {
    await Promise.race([work, budget.promise]);
    completed = true;
  } finally {
    clearTimeout(timer);
    if (!completed) await engine.cancel(run.run_id);
    await work;
  }
}

function assertGraphNodes(run: Run, initial: Run, failed: string | null): void {
  for (const node of run.plan.nodes) {
    const wave = Number(node.id.split("-")[1]);
    const skipped =
      failed !== null &&
      (wave > LongGraphFixture.RefutationWave ||
        (wave === LongGraphFixture.RefutationWave &&
          (node.id.endsWith("-join") || node.id.endsWith("-tail"))));
    const state: NodeState | undefined = run.nodes[node.id];
    assert.ok(state);
    assert.equal(
      state.state,
      skipped
        ? StepStatus.SkippedDependency
        : node.id === failed
          ? StepStatus.Failed
          : StepStatus.Passed,
    );
    if (skipped)
      assert.deepEqual(state, { ...initial.nodes[node.id], state: StepStatus.SkippedDependency });
    else assert.equal(state.attempt, 1);
    assert.equal(state.refutations, node.id === failed ? 1 : 0);
    if (node.id === failed) {
      assert.deepEqual(state.evidence, ["Independent graph check"]);
      assert.deepEqual(state.phases["falsifier-0"]?.answer, {
        verdict: Verdict.Refuted,
        evidence: "Independent graph check",
      });
    }
    if (skipped) {
      assert.deepEqual(state.phases, {});
      assert.deepEqual(state.evidence, []);
    }
  }
}

async function assertGraphDelivery(run: Run, failed: string | null): Promise<void> {
  let retries = 0;
  let failures = 0;
  const store = new RunStore(run.root);
  for await (const event of store.events(run.version)) {
    if (event.type === RunEventKind.ResultRefuted) retries++;
    if (event.type === RunEventKind.StepFailed) {
      assert.deepEqual(event.data, { step_id: failed });
      failures++;
    }
  }
  assert.equal(retries, 0);
  assert.equal(failures, failed ? 1 : 0);
  if (failed) assert.equal(run.artifacts, null);
  else {
    assert.ok(run.artifacts);
    const files = await readTree(run.artifacts);
    assert.equal(Object.keys(files).length, LongGraphFixture.Nodes);
    for (const node of run.plan.nodes)
      assert.deepEqual(
        await readFile(resolve(run.artifacts, `${node.id}.txt`)),
        Buffer.from(node.id),
      );
  }
}
