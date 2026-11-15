import { strict as assert } from "node:assert";
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
} from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { validateWorkflow } from "@titan/workflow";

export async function finalAttempt(checker: boolean, reload: boolean, allowance = 1) {
  return withTemporaryDirectory(async (project) => {
    const selected = checker ? `${ExecutionPhase.FalsifierPrefix}0` : ExecutionPhase.Worker;
    const calls = new Map<string, number>();
    const backend = new FakeBackend(async (spec) => {
      const count = (calls.get(spec.invocation_id) ?? 0) + 1;
      calls.set(spec.invocation_id, count);
      if (spec.invocation_id === `deliver/3/${selected}` && count === 1)
        throw new OperationalError(ErrorCode.ExecutionInterrupted, "Final attempt interrupted");
      return {
        json: spec.writable
          ? { ok: true, marker: "candidate", turn: 1 }
          : {
              verdict: spec.invocation_id.includes("/3/") ? Verdict.Survived : Verdict.Refuted,
              evidence: spec.invocation_id,
            },
      };
    });
    const factory = () => backend;
    const engine = new Engine(factory);
    const workflow = vendorRecoveryWorkflow();
    const run = await engine.create({
      project,
      config: await resolveConfig({
        home: resolve(project, "home"),
        project,
        overrides: { defaults: { max_attempts: 3 }, recovery: { max_retries: allowance } },
      }),
      plan: validateWorkflow(workflow),
      backend: Backend.Fake,
      client_id: "final-attempt",
      submission_id: "final-attempt",
    });
    await engine.start(run.run_id);
    assert.equal(run.state, RunStatus.Blocked);
    const before = structuredClone(run.nodes.deliver);
    assert.ok(before);
    assert.equal(before.attempt, 3);
    assert.equal(before.refutations, 2);
    assert.deepEqual(before.evidence, [
      `deliver/1/${ExecutionPhase.FalsifierPrefix}0`,
      `deliver/2/${ExecutionPhase.FalsifierPrefix}0`,
    ]);
    const interrupted = before.phases[selected];
    assert.ok(interrupted?.session_id && interrupted.execution_id);
    const recovered = reload ? new Engine(factory) : engine;
    const restored = reload ? await recovered.load(run.root) : run;
    await recovered.resume(run.run_id);
    const after = restored.nodes.deliver;
    assert.ok(after);
    assert.equal(restored.state, allowance ? RunStatus.Passed : RunStatus.Blocked);
    assert.equal(after.attempt, 3);
    assert.equal(after.refutations, 2);
    assert.deepEqual(after.evidence, before.evidence);
    assert.equal(after.work, before.work);
    assert.equal(after.input, before.input);
    const resumed = after.phases[selected];
    assert.ok(resumed);
    assert.equal(resumed.session_id, interrupted.session_id);
    assert.equal(resumed.executions, allowance ? 2 : 1);
    assert.equal(resumed.retries, allowance ? 1 : 0);
    assert.equal(resumed.completed, Boolean(allowance));
    assert.equal(resumed.execution_id === interrupted.execution_id, !allowance);
    if (checker)
      assert.deepEqual(after.phases[ExecutionPhase.Worker], before.phases[ExecutionPhase.Worker]);
    const events = (await recovered.events(run.run_id)).events;
    assert.equal(events.filter((event) => event.type === RunEventKind.AttemptStarted).length, 3);
    assert.equal(events.filter((event) => event.type === RunEventKind.ResultRefuted).length, 2);
    assert.ok([...calls.keys()].every((id) => !id.includes("/4/")));
    for (const attempt of [1, 2]) {
      assert.equal(calls.get(`deliver/${attempt}/${ExecutionPhase.Worker}`), 1);
      assert.equal(calls.get(`deliver/${attempt}/${ExecutionPhase.FalsifierPrefix}0`), 1);
    }
    assert.equal(calls.get(`deliver/3/${selected}`), allowance ? 2 : 1);
    const verified = await new Engine(factory).load(run.root);
    assert.deepEqual(verified.nodes.deliver, after);
    return true;
  });
}
