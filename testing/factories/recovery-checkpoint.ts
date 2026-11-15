import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  ErrorCode,
  ExecutionPhase,
  OperationalEvidenceFixture,
  RecoveryCheckpointFixture,
  RecoveryCheckpointMode,
  RunEventKind,
  RunStatus,
  StepStatus,
  Verdict,
} from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { Engine } from "@titan/runner";
import { assertRecoveryCheckpoint, vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type BackendFactory, ObjectSchema, type Run } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

export async function recoveryCheckpoint(worker: boolean, mode: RecoveryCheckpointMode) {
  async function observe(project: string) {
    const key = worker ? ExecutionPhase.Worker : `${ExecutionPhase.FalsifierPrefix}0`;
    const peer = mode === RecoveryCheckpointMode.Peer;
    const release = Promise.withResolvers<void>();
    let peerEntered = false;
    let turns = 0;
    const backend = new FakeBackend(async (spec) => {
      if (spec.invocation_id === `deliver/1/${key}`) turns++;
      if (
        spec.invocation_id === `deliver/1/${key}` &&
        (mode !== RecoveryCheckpointMode.Complete || turns === 1)
      )
        throw new OperationalError(
          ErrorCode.RateLimited,
          OperationalEvidenceFixture.Error,
          true,
          mode === RecoveryCheckpointMode.Complete
            ? RecoveryCheckpointFixture.CompletionMilliseconds
            : RecoveryCheckpointFixture.WaitMilliseconds,
        );
      if (spec.invocation_id === `peer/1/${key}`) {
        peerEntered = true;
        await release.promise;
      }
      return {
        json: spec.writable
          ? { ok: true, marker: "candidate", turn: 1 }
          : { verdict: Verdict.Survived, evidence: OperationalEvidenceFixture.Survived },
      };
    });
    const workflow = vendorRecoveryWorkflow();
    const target = workflow.steps[0];
    assert.ok(target);
    const { steps, ...base } = workflow;
    const nodes = [
      { ...target, needs: [] },
      { ...target, id: "peer", needs: [] },
      { ...target, id: "next", needs: ["peer"] },
      { ...target, id: "join", needs: ["deliver", "next"] },
    ];
    const plan = validateWorkflow(
      peer
        ? {
            ...base,
            graph: {
              nodes,
            },
          }
        : { ...base, steps },
    );
    const factory = () => backend;
    let engine = new Engine(factory, { max_active_agents: 1 });
    const overrides = {
      defaults: { max_attempts: 1 },
      recovery: { max_retries: 1, base_delay_s: 0.001, max_delay_s: 0.002, jitter_ratio: 0 },
      limits: {
        max_parallel: peer ? 1 : 2,
        max_minutes:
          mode === RecoveryCheckpointMode.Deadline
            ? RecoveryCheckpointFixture.DeadlineMinutes
            : null,
      },
    };
    const config = await resolveConfig({ home: resolve(project, "home"), project, overrides });
    const run = await engine.create({
      project,
      plan,
      config,
      backend: Backend.Fake,
      client_id: "checkpoint-caller",
      submission_id: "checkpoint-submission",
    });
    let active = engine.start(run.run_id);
    try {
      if (mode === RecoveryCheckpointMode.Complete) {
        await active;
        await assertCompleted(engine, run, key);
        return true;
      }
      assert.ok(
        await waitUntil(async () => {
          const snapshot = await engine.snapshot(run.run_id);
          return (
            snapshot.nodes.deliver?.state === StepStatus.Pending &&
            snapshot.nodes.deliver.phases[key]?.next_retry !== null &&
            snapshot.nodes.deliver.phases[key]?.next_retry !== undefined
          );
        }),
        JSON.stringify({
          state: run.state,
          deliver: run.nodes.deliver,
          peer: run.nodes.peer,
          peerEntered,
          turns,
        }),
      );
      if (peer) {
        assert.ok(await waitUntil(async () => peerEntered));
        assert.equal((await engine.snapshot(run.run_id)).state, RunStatus.Running);
        release.resolve();
        assert.ok(
          await waitUntil(
            async () => (await engine.snapshot(run.run_id)).nodes.next?.state === StepStatus.Passed,
          ),
        );
      }
      const waiting = await engine.snapshot(run.run_id);
      assert.equal(waiting.state, RunStatus.Recovering);
      const phase = assertRecoveryCheckpoint(waiting, worker);
      const usage = await engine.usage(run.run_id);
      assert.equal(usage.unreported_executions, 1);
      assert.equal(engine.resume(run.run_id), active);
      assert.deepEqual(await engine.snapshot(run.run_id), waiting);
      if (mode === RecoveryCheckpointMode.Deadline) {
        await active;
        assert.equal((await engine.snapshot(run.run_id)).state, RunStatus.TimedOut);
      } else if (mode === RecoveryCheckpointMode.Cancel || peer) {
        await engine.cancel(run.run_id);
        assert.equal((await engine.snapshot(run.run_id)).state, RunStatus.Cancelled);
      } else {
        await engine.pause(run.run_id);
        assert.equal((await engine.snapshot(run.run_id)).state, RunStatus.Paused);
        engine = await checkpointEngine(
          engine,
          factory,
          run.root,
          mode === RecoveryCheckpointMode.Reload,
        );
        active = engine.resume(run.run_id);
        assert.ok(
          await waitUntil(
            async () => (await engine.snapshot(run.run_id)).state === RunStatus.Recovering,
          ),
        );
        const resumed = await engine.snapshot(run.run_id);
        assert.deepEqual(assertRecoveryCheckpoint(resumed, worker), phase);
        assert.equal((await engine.usage(run.run_id)).executions, usage.executions);
        await engine.pause(run.run_id);
        assert.equal((await engine.snapshot(run.run_id)).state, RunStatus.Paused);
      }
      const final = await engine.snapshot(run.run_id);
      assert.deepEqual(assertRecoveryCheckpoint(final, worker), phase);
      if (peer) {
        assert.equal(final.nodes.peer?.state, StepStatus.Passed);
        assert.equal(final.nodes.next?.state, StepStatus.Passed);
        assert.equal(final.nodes.join?.state, StepStatus.Pending);
      }
      const events = await engine.events(run.run_id);
      assert.ok(events.events.some((event) => event.type === RunEventKind.ExecutionRecovering));
      return true;
    } finally {
      release.resolve();
      await engine.cancel(run.run_id);
      await active;
    }
  }
  return withTemporaryDirectory(observe);
}

async function checkpointEngine(
  engine: Engine,
  factory: BackendFactory,
  root: string,
  reload: boolean,
) {
  if (!reload) return engine;
  const replaced = new Engine(factory, { max_active_agents: 1 });
  await replaced.load(root);
  return replaced;
}

async function assertCompleted(engine: Engine, run: Run, key: string) {
  const completed = await engine.snapshot(run.run_id);
  assert.equal(completed.state, RunStatus.Passed);
  const phase = completed.nodes.deliver?.phases[key];
  assert.ok(phase?.completed);
  assert.equal(phase.executions, 2);
  assert.equal(phase.retries, 1);
  assert.equal(phase.next_retry, null);
  assert.equal(completed.nodes.deliver?.attempt, 1);
  assert.deepEqual(completed.nodes.deliver?.evidence, []);
  let retry = 0;
  let continued = false;
  for await (const event of RunStore.forRun(run.project, run.run_id).events()) {
    if (event.type === RunEventKind.ExecutionRecovering) {
      assert.equal(event.state.state, RunStatus.Recovering);
      retry = event.state.nodes.deliver?.phases[key]?.next_retry ?? 0;
      assert.ok(retry > event.time);
    }
    if (
      event.type === RunEventKind.ExecutionStarted &&
      ObjectSchema.parse(event.data).phase === key &&
      event.state.nodes.deliver?.phases[key]?.executions === 2
    ) {
      assert.equal(event.state.state, RunStatus.Running);
      assert.ok(retry > 0 && event.time >= retry);
      continued = true;
    }
  }
  assert.equal(continued, true);
}
