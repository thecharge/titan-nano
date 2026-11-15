import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  ExecutionPhase,
  RequestKind,
  RunStatus,
  StepStatus,
  Verdict,
} from "@titan/constants";
import { Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { Run } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { isolatedWorkspace } from "../support/isolated.ts";

function assertSingleExecutions(run: Run) {
  for (const state of Object.values(run.nodes)) {
    assert.equal(state.attempt, 1);
    assert.equal(state.refutations, 0);
    for (const phase of Object.values(state.phases)) {
      assert.equal(phase.executions, 1);
      assert.equal(phase.retries, 0);
    }
  }
}

function duplicateResume(engine: Engine, id: string, running: Promise<void>) {
  for (let index = 0; index < 3; index++) assert.equal(engine.resume(id), running);
}

export async function activeResume(checker: boolean, duplicate: boolean, parallel = false) {
  return withTemporaryDirectory(async (project) => {
    const selected = checker ? `${ExecutionPhase.FalsifierPrefix}0` : ExecutionPhase.Worker;
    const release = Promise.withResolvers<void>();
    let held = false;
    const calls = new Map<string, number>();
    const backend = new FakeBackend(async (spec) => {
      calls.set(spec.invocation_id, (calls.get(spec.invocation_id) ?? 0) + 1);
      if (spec.invocation_id === `deliver/1/${selected}`) {
        held = true;
        await release.promise;
      }
      return {
        json: spec.writable
          ? { ok: true, marker: "candidate", turn: 1 }
          : { verdict: Verdict.Survived, evidence: "Checked candidate" },
      };
    });
    const workflow = vendorRecoveryWorkflow();
    const target = workflow.steps[0];
    assert.ok(target);
    const engine = new Engine(() => backend);
    const run = await engine.create({
      project,
      config: await resolveConfig({
        home: resolve(project, "home"),
        project,
        overrides: {
          ...isolatedWorkspace,
          limits: { max_parallel: 2 },
          recovery: { max_retries: 0 },
        },
      }),
      plan: validateWorkflow({
        ...workflow,
        steps: parallel ? [{ parallel: [target, { ...target, id: "peer" }] }] : workflow.steps,
      }),
      backend: Backend.Fake,
      client_id: "active-caller",
      submission_id: "active-submission",
    });
    const running = engine.start(run.run_id);
    try {
      assert.ok(await waitUntil(async () => held));
      if (parallel)
        assert.ok(await waitUntil(async () => run.nodes.peer?.state === StepStatus.Passed));
      const node = run.nodes.deliver;
      const phase = node?.phases[selected];
      assert.ok(node && phase?.session_id && phase.execution_id);
      const before = structuredClone(phase);
      const cursor = (await engine.snapshot(run.run_id)).version;
      const liveUsage = await engine.usage(run.run_id);
      assert.equal(liveUsage.through, cursor);
      assert.equal(liveUsage.executions, (checker ? 2 : 1) + (parallel ? 2 : 0));
      assert.equal(liveUsage.reported_executions, (checker ? 1 : 0) + (parallel ? 2 : 0));
      assert.equal(liveUsage.unreported_executions, 1);
      assert.deepEqual(liveUsage.complete, {
        input_tokens: false,
        output_tokens: false,
        cost_usd: false,
      });
      if (duplicate) duplicateResume(engine, run.run_id, running);
      assert.equal(node.state, StepStatus.Running);
      assert.deepEqual(phase, before);
      assert.equal((await engine.snapshot(run.run_id)).version, cursor);
      assert.deepEqual(await engine.usage(run.run_id), liveUsage);
      const request = await engine.requests.open(run.run_id, {
        request_id: "active-origin",
        kind: RequestKind.Resource,
        scope: {
          operation: "read",
          resource: "reference",
          content_hashes: {},
          arguments: [],
          environment_names: [],
        },
        origin: {
          client_id: run.client_id,
          harness_session_id: phase.session_id,
          execution: {
            step_id: "deliver",
            attempt: node.attempt,
            phase: selected,
            execution_id: phase.execution_id,
          },
        },
        expires_at: Date.now() + 60000,
      });
      assert.equal(request.origin.execution?.execution_id, before.execution_id);
      assert.equal((await engine.requests.list(run.run_id)).length, 1);
      release.resolve();
      await running;
      const final = await engine.snapshot(run.run_id);
      assert.equal(final.state, RunStatus.Passed);
      assertSingleExecutions(final);
      assert.equal(calls.size, parallel ? 4 : 2);
      assert.ok([...calls.values()].every((count) => count === 1));
      const finishedUsage = await engine.usage(run.run_id);
      assert.equal(finishedUsage.executions, parallel ? 4 : 2);
      assert.equal(finishedUsage.reported_executions, parallel ? 4 : 2);
      assert.equal(finishedUsage.unreported_executions, 0);
      return true;
    } finally {
      release.resolve();
      await running;
    }
  });
}
