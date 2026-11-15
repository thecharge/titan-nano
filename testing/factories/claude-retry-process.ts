import { strict as assert } from "node:assert";
import {
  Backend,
  ExecutionPhase,
  RunAction,
  RunStatus,
  SdkProcessFixture,
  VendorStubMode,
} from "@titan/constants";
import { createRunClient } from "@titan/server/client";
import { inspectVendorRetry, vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { RunSchema, type SdkProbePaths } from "@titan/types";
import { prepareSdkProject } from "./sdk-process.ts";
import { serverReady, spawnServer } from "./server-process.ts";

export async function claudeProcessRetry(
  worker: boolean,
  task: VendorStubMode,
  allowance: number,
  paths: SdkProbePaths = {},
) {
  return withTemporaryDirectory(async (root) => {
    const { home, project } = await prepareSdkProject(
      root,
      Backend.Claude,
      allowance,
      false,
      paths.vendors,
    );
    const children: ReturnType<typeof spawnServer>[] = [];
    try {
      const first = spawnServer(home, paths.cli, SdkProcessFixture.DaemonTimeout);
      children.push(first);
      assert.equal(
        await waitUntil(() => serverReady(home, first.pid), SdkProcessFixture.ObserveAttempts),
        true,
      );
      const client = createRunClient(home);
      const workflow = vendorRecoveryWorkflow(worker ? VendorStubMode.Complete : task);
      if (worker) for (const step of workflow.steps) step.do.task = task;
      const submitted = await client.submit({
        project,
        workflow,
        backend: Backend.Claude,
        client_id: "retry-process",
        submission_id: "retry-process",
      });
      assert.equal(
        await waitUntil(async () => {
          const state = (await client.get(submitted.run_id)).state;
          return state === RunStatus.Passed || state === RunStatus.Blocked;
        }, SdkProcessFixture.ObserveAttempts),
        true,
      );
      const before = RunSchema.parse(await client.get(submitted.run_id));
      const node = before.nodes.deliver;
      assert.ok(node?.work);
      const key = worker ? ExecutionPhase.Worker : `${ExecutionPhase.FalsifierPrefix}0`;
      const phase = node.phases[key];
      assert.ok(phase?.session_id);
      const events = await client.events(before.run_id);
      const usage = await client.usage(before.run_id);
      first.kill("SIGKILL");
      await first.exited;
      const next = spawnServer(home, paths.cli, SdkProcessFixture.DaemonTimeout);
      children.push(next);
      assert.equal(
        await waitUntil(() => serverReady(home, next.pid), SdkProcessFixture.ObserveAttempts),
        true,
      );
      const restored = RunSchema.parse(await client.get(before.run_id));
      assert.deepEqual(restored.nodes.deliver, node);
      assert.deepEqual(await client.usage(before.run_id), usage);
      if (before.state === RunStatus.Blocked) {
        await client.control(before.run_id, RunAction.Resume);
        assert.equal(
          await waitUntil(async () => {
            const run = RunSchema.parse(await client.get(before.run_id));
            return run.state === RunStatus.Blocked && run.version > restored.version;
          }, SdkProcessFixture.ObserveAttempts),
          true,
        );
        const exhausted = RunSchema.parse(await client.get(before.run_id));
        assert.equal(exhausted.nodes.deliver?.phases[key]?.executions, phase.executions);
        assert.equal(exhausted.nodes.deliver?.phases[key]?.session_id, phase.session_id);
        assert.equal(exhausted.nodes.deliver?.phases[key]?.error, phase.error);
        assert.equal(exhausted.nodes.deliver?.attempt, 1);
        assert.deepEqual(exhausted.nodes.deliver?.evidence, []);
      }
      return inspectVendorRetry(before, events, usage, worker);
    } finally {
      for (const child of children) {
        if (child.exitCode === null) child.kill("SIGKILL");
        await child.exited;
      }
    }
  });
}
