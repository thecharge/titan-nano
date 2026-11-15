import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  ErrorCode,
  ExecutionPhase,
  RunEventKind,
  RunStatus,
  Verdict,
  WorkspaceModeSetting,
} from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { RunnerMessage } from "@titan/messages";
import { Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { ObjectSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

export function attemptInputAdmission(checker: boolean, saturated: boolean) {
  return withTemporaryDirectory((project) => observeInputAdmission(project, checker, saturated));
}

async function observeInputAdmission(project: string, checker: boolean, saturated: boolean) {
  await writeFile(resolve(project, "source.txt"), Buffer.from("Original input"));
  const key = checker ? `${ExecutionPhase.FalsifierPrefix}0` : ExecutionPhase.Worker;
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let interrupted = false;
  const backend = new FakeBackend(async (spec) => {
    if (spec.model === "held") {
      entered.resolve();
      await release.promise;
    }
    if (spec.invocation_id === `deliver/1/${key}` && !interrupted) {
      interrupted = true;
      throw new OperationalError(ErrorCode.CodexExecution, "Controlled interruption");
    }
    const worker = { ok: true, marker: "candidate", turn: 1 };
    const reviewed = { verdict: Verdict.Survived, evidence: "Independent review" };
    return { json: spec.writable ? worker : reviewed };
  });
  const engine = new Engine(() => backend, { max_active_agents: 1, max_pending_agents: 0 });
  const overrides = {
    workspace: { mode: WorkspaceModeSetting.Isolated },
    recovery: { max_retries: 1 },
  };
  const config = await resolveConfig({ home: resolve(project, "home"), project, overrides });
  const base = vendorRecoveryWorkflow("Review admitted input");
  const plan = validateWorkflow(base);
  const run = await engine.create({
    project,
    config,
    plan,
    backend: Backend.Fake,
    client_id: "input-admission",
    submission_id: "target",
  });
  await engine.start(run.run_id);
  const before = await engine.snapshot(run.run_id);
  assert.equal(before.state, RunStatus.Blocked);
  const node = before.nodes.deliver;
  assert.ok(node?.input);
  await writeFile(resolve(node.input, "source.txt"), Buffer.from("Changed input"));
  const worker = { ...base.personas.worker, model: "held" };
  const personas = { ...base.personas, worker };
  const peer = await engine.create({
    project,
    config,
    plan: validateWorkflow({ ...base, personas }),
    backend: Backend.Fake,
    client_id: "input-admission",
    submission_id: "peer",
  });
  const running = saturated ? engine.start(peer.run_id) : Promise.resolve();
  try {
    if (saturated) await entered.promise;
    await engine.resume(run.run_id);
    const after = await engine.snapshot(run.run_id);
    assert.equal(after.state, RunStatus.Blocked);
    assert.equal(after.artifacts, null);
    assert.deepEqual(after.nodes.deliver?.phases, node.phases);
    assert.equal(after.nodes.deliver?.attempt, 1);
    assert.equal(after.nodes.deliver?.refutations, 0);
    const expected = saturated ? RunnerMessage.PendingCapacity : RunnerMessage.InputCheckpoint;
    const events = await engine.events(run.run_id);
    assert.ok(
      events.events.some(
        (event) =>
          event.id > before.version &&
          event.type === RunEventKind.StepBlocked &&
          ObjectSchema.parse(event.data).error === expected,
      ),
    );
    return true;
  } finally {
    release.resolve();
    await running;
  }
}
