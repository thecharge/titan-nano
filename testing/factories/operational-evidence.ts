import { strict as assert } from "node:assert";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  BoardLimit,
  ErrorCode,
  OperationalEvidenceFixture,
  RunEventKind,
  RunStatus,
  Verdict,
} from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { ObjectSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

export async function operationalEvidence(worker: boolean, reload: boolean, exhausted = false) {
  return withTemporaryDirectory(async (project) => {
    const home = resolve(project, "home");
    await mkdir(home);
    const config = await resolveConfig({
      home,
      project,
      overrides: { recovery: { max_retries: 1 } },
    });
    let interrupted = false;
    let checks = 0;
    const prompts: unknown[] = [];
    const backend = new FakeBackend(async (spec, prompt) => {
      if (worker === spec.writable && (!interrupted || exhausted)) {
        interrupted = true;
        throw new OperationalError(
          ErrorCode.ExecutionInterrupted,
          OperationalEvidenceFixture.Error,
        );
      }
      if (spec.writable) {
        prompts.push(ObjectSchema.parse(JSON.parse(prompt)).prior_refutations);
        return { json: { ok: true, marker: "candidate", turn: 1 } };
      }
      checks++;
      return {
        json: {
          verdict: checks === 1 ? Verdict.Refuted : Verdict.Survived,
          evidence:
            checks === 1
              ? OperationalEvidenceFixture.Refutation
              : OperationalEvidenceFixture.Survived,
        },
      };
    });
    const factory = () => backend;
    const engine = new Engine(factory);
    const run = await engine.create({
      project,
      config,
      backend: Backend.Fake,
      plan: validateWorkflow(vendorRecoveryWorkflow()),
      client_id: "evidence-owner",
      submission_id: "evidence-run",
    });
    await engine.start(run.run_id);
    assert.equal(run.state, RunStatus.Blocked);
    assert.equal(run.nodes.deliver?.attempt, 1);
    assert.equal(run.nodes.deliver?.refutations, 0);
    const initialEvidence = run.nodes.deliver?.evidence.slice();
    const recovered = reload ? new Engine(factory) : engine;
    const restored = reload ? await recovered.load(run.root) : run;
    await recovered.resume(run.run_id);
    const state = restored.nodes.deliver;
    assert.ok(state);
    const events = await recovered.events(run.run_id, { limit: BoardLimit.EventPageSize });
    assert.ok(
      events.events.some(
        (event) =>
          event.type === RunEventKind.StepBlocked &&
          ObjectSchema.parse(event.data).error === OperationalEvidenceFixture.Error,
      ),
    );
    if (exhausted) {
      assert.deepEqual(initialEvidence, []);
      assert.equal(restored.state, RunStatus.Blocked);
      assert.equal(state.attempt, 1);
      assert.equal(state.refutations, 0);
      assert.deepEqual(state.evidence, []);
      assert.equal(restored.artifacts, null);
      assert.ok(
        Object.values(state.phases).some((phase) =>
          phase.error?.includes(OperationalEvidenceFixture.Error),
        ),
      );
      return true;
    }
    assert.equal(restored.state, RunStatus.Passed);
    assert.equal(state.attempt, 2);
    assert.equal(state.refutations, 1);
    assert.deepEqual(prompts.at(-1), [OperationalEvidenceFixture.Refutation]);
    assert.deepEqual(state.evidence, [OperationalEvidenceFixture.Refutation]);
    assert.deepEqual(initialEvidence, []);
    assert.ok(restored.artifacts);
    return true;
  });
}
