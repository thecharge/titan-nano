import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import { Backend, HiveFixture, RunStatus, StepStatus, Verdict } from "@titan/constants";
import { Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { StepListingSchema, type WorkerPrompts } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

function chain(ids: readonly string[]) {
  const base = vendorRecoveryWorkflow(HiveFixture.CheckTask);
  return validateWorkflow({
    ...base,
    steps: ids.map((id) => ({
      id,
      do: { persona: HiveFixture.Worker, task: HiveFixture.WorkTask },
      falsify: [{ persona: HiveFixture.Checker, task: HiveFixture.CheckTask }],
    })),
  });
}

async function observePrompts(
  root: string,
  ids: readonly string[],
  target: string,
): Promise<WorkerPrompts> {
  const config = await resolveConfig({ home: resolve(root, "home"), project: root });
  const seen: WorkerPrompts = { worker: "", falsifier: "" };
  const backend = new FakeBackend(async (spec, prompt) => {
    if (spec.persona_id === HiveFixture.Checker) {
      if (spec.invocation_id.startsWith(`${target}/`)) seen.falsifier = prompt;
      return { json: { verdict: Verdict.Survived, evidence: HiveFixture.Evidence } };
    }
    if (spec.invocation_id.startsWith(`${target}/`)) seen.worker = prompt;
    return { json: { ok: true, marker: HiveFixture.Marker, turn: HiveFixture.Turn } };
  });
  const engine = new Engine(() => backend);
  const run = await engine.create({
    project: root,
    config,
    plan: chain(ids),
    backend: Backend.Fake,
    client_id: HiveFixture.ClientId,
    submission_id: HiveFixture.ClientId,
  });
  await engine.start(run.run_id);
  assert.equal(run.state, RunStatus.Passed);
  return seen;
}

function expectedState(index: number, targetIndex: number): StepStatus {
  if (index < targetIndex) return StepStatus.Passed;
  return index === targetIndex ? StepStatus.Running : StepStatus.Pending;
}

export async function workerStepList(ids: readonly string[], targetIndex: number): Promise<string> {
  const target = ids[targetIndex] ?? "";
  const seen = await withTemporaryDirectory((root) => observePrompts(root, ids, target));
  const listed = StepListingSchema.array().parse(
    Reflect.get(JSON.parse(seen.worker), HiveFixture.StepsField),
  );
  const listsAll = ids.every((id, index) => {
    const entry = listed.find((item) => item.id === id);
    return (
      entry?.state === expectedState(index, targetIndex) &&
      entry.task === HiveFixture.WorkTask &&
      entry.persona === HiveFixture.Worker
    );
  });
  const leaks = ids.some((id) => id !== target && seen.falsifier.includes(id));
  return `${listsAll} ${leaks}`;
}
