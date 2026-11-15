import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  BoardFile,
  ErrorCode,
  ExecutionPhase,
  FileEncoding,
  IoLimit,
  Newline,
  RunEventKind,
  RunStatus,
  TaskOutcome,
  Verdict,
} from "@titan/constants";
import { settle } from "@titan/core";
import { OperationalError } from "@titan/errors";
import { Engine } from "@titan/runner";
import { readFileBytes } from "@titan/streams";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { RunEventSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { executionRequest } from "./request-execution.ts";

export async function requestRecovery(
  checker: boolean,
  retry: boolean,
  race = false,
  historical = false,
) {
  async function observe(project: string) {
    const releaseTransition = Promise.withResolvers<void>();
    const releaseAgent = Promise.withResolvers<void>();
    const failAgent = Promise.withResolvers<void>();
    const releaseSnapshot = Promise.withResolvers<void>();
    let initial = false;
    let snapshotHeld = false;
    let held = false;
    let entered = false;
    let calls = 0;
    const phaseKey = checker ? `${ExecutionPhase.FalsifierPrefix}0` : ExecutionPhase.Worker;
    const backend = new FakeBackend(async (spec) => {
      if (spec.invocation_id.endsWith(`/${phaseKey}`)) {
        calls++;
        if (calls === 1) {
          initial = true;
          await failAgent.promise;
          throw new OperationalError(
            ErrorCode.ExecutionInterrupted,
            "Interrupted request origin",
            retry,
          );
        }
        entered = true;
        await releaseAgent.promise;
      }
      return {
        json: spec.invocation_id.endsWith(`/${ExecutionPhase.Worker}`)
          ? { ok: true, marker: "candidate", turn: 1 }
          : { verdict: Verdict.Survived, evidence: "Checked candidate" },
      };
    });
    const factory = () => backend;
    const engine = new Engine(factory);
    const recovery = { max_retries: 1, base_delay_s: 0.001, max_delay_s: 0.001, jitter_ratio: 0 };
    const config = await resolveConfig({
      home: resolve(project, "home"),
      project,
      overrides: {
        recovery,
      },
    });
    const run = await engine.create({
      project,
      config,
      plan: validateWorkflow(vendorRecoveryWorkflow()),
      backend: Backend.Fake,
      client_id: "recovery-origin",
      submission_id: "recovery-origin",
    });
    const original = RunStore.prototype.commit;
    const snapshot = RunStore.prototype.snapshot;
    if (!race) failAgent.resolve();
    RunStore.prototype.commit = function (state, kind, data) {
      const committed = original.call(this, state, kind, data);
      if (
        this.root !== run.root ||
        kind !== (retry ? RunEventKind.ExecutionRecovering : RunEventKind.ExecutionBlocked)
      )
        return committed;
      return committed.then(async () => {
        held = true;
        await releaseTransition.promise;
      });
    };
    const running = settle([() => engine.start(run.run_id)]);
    try {
      assert.ok(await waitUntil(async () => initial));
      const interrupted = await engine.snapshot(run.run_id);
      const input = executionRequest(interrupted, "deliver", phaseKey);
      let reads = 0;
      if (race)
        RunStore.prototype.snapshot = async function () {
          const state = await snapshot.call(this);
          if (this.root === run.root && ++reads === 2) {
            snapshotHeld = true;
            await releaseSnapshot.promise;
          }
          return state;
        };
      const opening = settle([() => engine.requests.open(run.run_id, input)]);
      if (race) {
        assert.ok(await waitUntil(async () => snapshotHeld));
        failAgent.resolve();
      }
      assert.ok(await waitUntil(async () => held));
      RunStore.prototype.snapshot = snapshot;
      const before = await engine.snapshot(run.run_id);
      releaseSnapshot.resolve();
      const results = await opening;
      const result = results[0];
      assert.ok(result?.status === TaskOutcome.Rejected);
      assert.equal(Reflect.get(Object(result.reason), "code"), ErrorCode.PermissionDenied);
      assert.deepEqual(await engine.snapshot(run.run_id), before);
      assert.equal((await engine.requests.list(run.run_id)).length, 0);
      releaseTransition.resolve();
      if (!retry) {
        await running;
        assert.equal(run.state, RunStatus.Blocked);
        assert.equal(calls, 1);
        return true;
      }
      assert.ok(await waitUntil(async () => entered));
      const resumed = await engine.snapshot(run.run_id);
      const phase = resumed.nodes.deliver?.phases[phaseKey];
      assert.ok(phase);
      assert.equal(phase.error, null);
      assert.equal(phase.next_retry, null);
      assert.equal(phase.retries, 1);
      assert.equal(phase.executions, 2);
      assert.equal(phase.session_id, input.origin.harness_session_id);
      assert.notEqual(phase.execution_id, input.origin.execution?.execution_id);
      const current = executionRequest(resumed, "deliver", phaseKey);
      const request = await engine.requests.open(run.run_id, current);
      assert.deepEqual(request.origin, current.origin);
      releaseAgent.resolve();
      const outcomes = await running;
      assert.equal(outcomes[0]?.status, TaskOutcome.Fulfilled);
      assert.equal(run.state, RunStatus.Passed);
      if (historical) await rewriteRecoveryDiagnostic(run.root, phaseKey);
      const restored = new Engine(factory);
      await restored.load(run.root);
      assert.deepEqual(await restored.requests.open(run.run_id, current), request);
      assert.equal(restored.get(run.run_id).nodes.deliver?.attempt, 1);
      assert.deepEqual(restored.get(run.run_id).nodes.deliver?.evidence, []);
      return true;
    } finally {
      failAgent.resolve();
      releaseSnapshot.resolve();
      releaseTransition.resolve();
      releaseAgent.resolve();
      await running;
      RunStore.prototype.snapshot = snapshot;
      RunStore.prototype.commit = original;
    }
  }
  return withTemporaryDirectory(observe);
}

async function rewriteRecoveryDiagnostic(root: string, phaseKey: string): Promise<void> {
  const path = resolve(root, BoardFile.Journal);
  const bytes = await readFileBytes(path, IoLimit.ResponseBytes);
  const lines = bytes.toString(FileEncoding.Utf8).trimEnd().split(Newline);
  let changed = false;
  const rewritten = lines.map((line) => {
    const event = RunEventSchema.parse(JSON.parse(line));
    if (event.type !== RunEventKind.RequestOpened) return line;
    const recorded = event.state.nodes.deliver?.phases[phaseKey];
    assert.ok(recorded);
    recorded.error = "Historical recovery diagnostic";
    recorded.next_retry = event.time;
    changed = true;
    return JSON.stringify(event);
  });
  assert.ok(changed);
  await writeFile(path, Buffer.from(rewritten.join(Newline) + Newline));
}
