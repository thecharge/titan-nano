import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { RunStore } from "@titan/board";
import {
  Backend,
  CliCommand,
  ExecutionPhase,
  FileEncoding,
  IoLimit,
  McpIdentity,
  ProcessSignal,
  RecoveryCheckpointFixture,
  RunAction,
  RunEventKind,
  RunFile,
  RunStatus,
  SdkProcessFixture,
  StepStatus,
  VendorFixture,
  VendorStubMode,
} from "@titan/constants";
import { all } from "@titan/core";
import { createRunClient } from "@titan/server/client";
import { readFileBytes } from "@titan/streams";
import { assertRecoveryCheckpoint, vendorRecoveryWorkflow } from "@titan/test-factories";
import { processExited, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  McpTextContentSchema,
  ObjectSchema,
  type Run,
  RunSchema,
  type SdkProbePaths,
  VendorStubCallSchema,
  WorkflowSchema,
} from "@titan/types";
import { readTree, treeHash } from "@titan/workspace";
import { runCliCommand } from "../support/command.ts";
import { withStdioMcp } from "../support/mcp.ts";
import { preparePlanProject } from "./sdk-plan.ts";
import { prepareSdkProject } from "./sdk-process.ts";
import { serverReady, spawnServer } from "./server-process.ts";

export async function claudeBackoff(worker: boolean, action: RunAction, paths: SdkProbePaths = {}) {
  return inspectBackoff(worker, action, paths, false);
}

export async function claudeBackoffBranch(
  worker: boolean,
  action: RunAction,
  paths: SdkProbePaths = {},
) {
  return inspectBackoff(worker, action, paths, true);
}

function backoffWorkflow(worker: boolean, peer: boolean) {
  const workflow = vendorRecoveryWorkflow(
    worker ? VendorStubMode.Complete : VendorStubMode.RateWaitOnce,
  );
  if (worker) for (const step of workflow.steps) step.do.task = VendorStubMode.RateWaitOnce;
  const { steps, ...base } = workflow;
  const target = steps[0];
  assert.ok(target);
  return peer
    ? WorkflowSchema.parse({
        ...base,
        personas: {
          ...base.personas,
          codex: { ...base.personas.worker, backend: Backend.Codex },
          codexCheck: { ...base.personas.checker, backend: Backend.Codex },
        },
        limits: { max_parallel: 1 },
        graph: {
          nodes: [
            { ...target, needs: [] },
            ...["peer", "next", "join"].map((id) => ({
              id,
              needs: id === "peer" ? [] : id === "next" ? ["peer"] : ["deliver", "next"],
              do: { persona: "codex", task: VendorStubMode.Complete },
              falsify: [{ persona: "codexCheck", task: VendorStubMode.Complete }],
            })),
          ],
        },
      })
    : workflow;
}

async function inspectBackoffBranch(run: Run, worker: boolean) {
  const phase = assertRecoveryCheckpoint(run, worker);
  assert.equal(run.config.value.limits.max_parallel, 1);
  assert.equal(run.config.value.server.max_active_agents, 1);
  const started = new Set<string>();
  for await (const event of RunStore.forRun(run.project, run.run_id).events(run.version)) {
    for (const id of ["peer", "next"]) {
      if (
        event.type !== RunEventKind.ExecutionStarted ||
        ObjectSchema.parse(event.data).step_id !== id ||
        event.state.nodes[id]?.state !== StepStatus.Running
      )
        continue;
      assert.equal(event.state.state, RunStatus.Running);
      if (id === "next") assert.deepEqual(assertRecoveryCheckpoint(event.state, worker), phase);
      started.add(id);
    }
  }
  assert.deepEqual([...started].sort(), ["next", "peer"]);
}

async function inspectBackoff(
  worker: boolean,
  action: RunAction,
  paths: SdkProbePaths,
  peer: boolean,
) {
  return withTemporaryDirectory(async (root) => {
    const { home, project } = peer
      ? await preparePlanProject(root, paths.vendors ?? resolve("testing/fixtures/vendors"), 1, 1)
      : await prepareSdkProject(root, Backend.Claude, 1, false, paths.vendors);
    const cli = paths.cli ?? resolve("apps/cli/src/main.ts");
    const children: ReturnType<typeof spawnServer>[] = [];
    try {
      const first = spawnServer(home, cli, SdkProcessFixture.DaemonTimeout);
      children.push(first);
      assert.ok(
        await waitUntil(() => serverReady(home, first.pid), SdkProcessFixture.ObserveAttempts),
      );
      const client = createRunClient(home);
      const selected = backoffWorkflow(worker, peer);
      const submitted = await client.submit({
        project,
        workflow: selected,
        backend: Backend.Claude,
        client_id: "backoff-caller",
        submission_id: "backoff-submission",
      });
      assert.ok(
        await waitUntil(async () => {
          const run = RunSchema.parse(await client.get(submitted.run_id));
          return (
            run.state === RunStatus.Recovering &&
            run.nodes.deliver?.state === StepStatus.Pending &&
            (!peer || run.nodes.next?.state === StepStatus.Passed)
          );
        }, SdkProcessFixture.ObserveAttempts),
      );
      const before = RunSchema.parse(await client.get(submitted.run_id));
      const phase = assertRecoveryCheckpoint(before, worker);
      const work = before.nodes.deliver?.work;
      assert.ok(work);
      const cwd = worker ? work : resolve(work, "..", "review-0");
      const preserved = worker ? [cwd] : [cwd, resolve(work, "..", RunFile.Candidate)];
      if (worker)
        assert.deepEqual(
          await readFileBytes(
            resolve(cwd, RecoveryCheckpointFixture.PartialFile),
            IoLimit.DataBytes,
          ),
          Buffer.from(RecoveryCheckpointFixture.PartialContent),
        );
      if (peer)
        for (const id of ["peer", "next"]) {
          const snapshot = before.nodes[id]?.snapshot;
          assert.ok(snapshot);
          preserved.push(snapshot);
        }
      const hashes = await all(
        preserved.map(
          (path) => async () => treeHash(await readTree(path, before.config.value.limits)),
        ),
      );
      assert.deepEqual(
        {
          ...RunSchema.parse(await runCliCommand(cli, home, [CliCommand.Status, before.run_id])),
          state: before.state,
        },
        before,
      );
      await withStdioMcp(process.execPath, [cli, CliCommand.Mcp, "--home", home], async (mcp) => {
        const result = await mcp.callTool({
          name: `${McpIdentity.Prefix}${CliCommand.Status}`,
          arguments: { run_id: before.run_id },
        });
        assert.ok(!result.isError);
        const content = McpTextContentSchema.parse(result.content)[0];
        assert.ok(content);
        assert.deepEqual(
          { ...RunSchema.parse(JSON.parse(content.text)), state: before.state },
          before,
        );
      });
      const usage = await client.usage(before.run_id);
      assert.equal(usage.unreported_executions, 1);
      if (peer) {
        assert.equal(usage.executions, worker ? 5 : 6);
        await inspectBackoffBranch(before, worker);
      }
      if (action === RunAction.Resume) {
        first.kill(ProcessSignal.Kill);
        await first.exited;
        const next = spawnServer(home, cli, SdkProcessFixture.DaemonTimeout);
        children.push(next);
        assert.ok(
          await waitUntil(() => serverReady(home, next.pid), SdkProcessFixture.ObserveAttempts),
        );
        const restored = RunSchema.parse(await client.get(before.run_id));
        assert.equal(restored.state, RunStatus.Blocked);
        assert.deepEqual(assertRecoveryCheckpoint(restored, worker), phase);
        await client.control(before.run_id, RunAction.Resume);
        assert.ok(
          await waitUntil(
            async () => (await client.get(before.run_id)).state === RunStatus.Recovering,
          ),
        );
      }
      const control = action === RunAction.Cancel ? RunAction.Cancel : RunAction.Pause;
      await client.control(before.run_id, control);
      const final = RunSchema.parse(await client.get(before.run_id));
      assert.equal(
        final.state,
        control === RunAction.Cancel ? RunStatus.Cancelled : RunStatus.Paused,
      );
      assert.deepEqual(assertRecoveryCheckpoint(final, worker), phase);
      assert.equal((await client.usage(before.run_id)).executions, usage.executions);
      assert.equal(final.nodes.deliver?.work, work);
      assert.deepEqual(
        await all(
          preserved.map(
            (path) => async () => treeHash(await readTree(path, final.config.value.limits)),
          ),
        ),
        hashes,
      );
      const calls = (
        await readFileBytes(
          resolve(cwd, VendorFixture.StateDirectory, "calls.jsonl"),
          IoLimit.DataBytes,
        )
      )
        .toString(FileEncoding.Utf8)
        .trim()
        .split("\n")
        .map((line) => VendorStubCallSchema.parse(JSON.parse(line)));
      assert.equal(calls.length, 1);
      assert.equal(calls[0]?.resume, false);
      for (const call of calls) assert.ok(await waitUntil(() => processExited(call.pid)));
      assert.equal(final.nodes.deliver?.phases[ExecutionPhase.Worker]?.completed, !worker);
      if (peer) {
        for (const id of ["peer", "next"]) {
          assert.deepEqual(final.nodes[id], before.nodes[id]);
          assert.equal(final.nodes[id]?.state, StepStatus.Passed);
          for (const completed of Object.values(final.nodes[id]?.phases ?? {})) {
            assert.equal(completed.executions, 1);
            assert.equal(completed.retries, 0);
          }
        }
        assert.equal(final.nodes.join?.state, StepStatus.Pending);
        assert.equal(final.artifacts, null);
      }
      return true;
    } finally {
      for (const child of children) {
        if (child.exitCode === null) child.kill(ProcessSignal.Kill);
        await child.exited;
      }
    }
  });
}
