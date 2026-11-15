import { strict as assert } from "node:assert";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ConfigFile,
  ExecutionDelivery,
  ExecutionPhase,
  NativeSetupDelivery,
  RunStatus,
  SdkProcessFixture,
  StepStatus,
  VendorStubMode,
} from "@titan/constants";
import { call } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  ConfigSchema,
  type NativeBackendId,
  NativeToolServerSettingsSchema,
  type RunClient,
  RunSchema,
  type SdkProbePaths,
} from "@titan/types";
import { prepareSdkProject } from "./sdk-process.ts";
import { serverReady, spawnServer } from "./server-process.ts";

export async function nativeSetupProcess(
  backend: NativeBackendId,
  allowance: number,
  restart: boolean,
  paths: SdkProbePaths = {},
) {
  return withTemporaryDirectory((root) =>
    setupProcessAtRoot(root, backend, allowance, restart, paths),
  );
}

async function setupProcessAtRoot(
  root: string,
  backend: NativeBackendId,
  allowance: number,
  restart: boolean,
  paths: SdkProbePaths,
) {
  const { home, project } = await prepareSdkProject(root, backend, allowance, false, paths.vendors);
  const file = resolve(home, ConfigFile.User);
  const config = ConfigSchema.parse(JSON.parse((await readFile(file)).toString()));
  config.server.max_active_agents = 2;
  config.server.native_tools = NativeToolServerSettingsSchema.parse({ max_bindings: 1 });
  await writeFile(file, Buffer.from(JSON.stringify(config)));
  let child = spawnServer(home, paths.cli, SdkProcessFixture.DaemonTimeout);
  try {
    assert.equal(await waitUntil(() => serverReady(home, child.pid)), true);
    const client = createRunClient(home);
    const submitted = await client.submit({
      project,
      workflow: setupWorkflow(),
      backend,
      client_id: "native-setup-process",
      submission_id: "one",
    });
    const before = await settledSetup(client, submitted.run_id);
    assert.equal(before.state, RunStatus.Blocked);
    const blocked = Object.values(before.nodes).find((node) => node.state === StepStatus.Blocked);
    assert.ok(blocked);
    const phase = blocked.phases[ExecutionPhase.Worker];
    assert.ok(phase);
    assert.equal(phase.delivery, ExecutionDelivery.Prepared);
    assert.equal(phase.executions, 1);
    assert.equal(phase.dispatches, 0);
    assert.equal(phase.session_id, null);
    assert.equal(
      Object.values(before.nodes).filter((node) => node.state === StepStatus.Passed).length,
      1,
    );
    const usageBefore = await client.usage(before.run_id);
    assert.equal(usageBefore.executions, 2);
    assert.equal(usageBefore.unreported_executions, 0);
    if (restart) {
      child.kill("SIGKILL");
      await child.exited;
      child = spawnServer(home, paths.cli, SdkProcessFixture.DaemonTimeout);
      assert.equal(await waitUntil(() => serverReady(home, child.pid)), true);
    }
    await call(home, `/runs/${before.run_id}/resume`, "POST", {});
    const after = await settledSetup(client, before.run_id);
    assert.equal(
      after.state,
      allowance ? RunStatus.Passed : RunStatus.Blocked,
      JSON.stringify({ error: after.error, nodes: after.nodes }),
    );
    const usageAfter = await client.usage(after.run_id);
    assert.equal(usageAfter.executions, allowance ? 4 : 2);
    assert.equal(usageAfter.reported_executions, usageAfter.executions);
    assert.equal(usageAfter.unreported_executions, 0);
    for (const node of Object.values(after.nodes)) {
      assert.equal(node.attempt, 1);
      assert.equal(node.refutations, 0);
      assert.deepEqual(node.evidence, []);
    }
    if (allowance) {
      await setupArtifacts(after.artifacts);
    } else {
      assert.equal(after.artifacts, null);
      const retained = Object.values(after.nodes).find((node) => node.state === StepStatus.Blocked)
        ?.phases[ExecutionPhase.Worker];
      assert.deepEqual(retained, { ...phase, error: retained?.error });
    }
    assert.equal(
      (await readFile(resolve(project, "source.txt"))).equals(
        Buffer.from("Original project content"),
      ),
      true,
    );
    return true;
  } finally {
    if (child.exitCode === null) child.kill("SIGTERM");
    await child.exited;
  }
}

function setupWorkflow() {
  const { steps, ...workflow } = vendorRecoveryWorkflow(VendorStubMode.Complete);
  const base = steps[0];
  assert.ok(base);
  const nodes = NativeSetupDelivery.Steps.map((id) => {
    const task = JSON.stringify({
      mode: "delivery",
      file: id,
      content: id,
      requires: [],
      barrier: null,
    });
    return {
      ...base,
      id,
      needs: [],
      do: { ...base.do, task },
      falsify: base.falsify.map((action) => ({ ...action, task })),
    };
  });
  return { ...workflow, graph: { nodes }, limits: { max_parallel: 2 } };
}

async function settledSetup(client: RunClient, id: string) {
  assert.equal(
    await waitUntil(async () => {
      const run = await client.get(id);
      return run.state === RunStatus.Passed || run.state === RunStatus.Blocked;
    }, SdkProcessFixture.ObserveAttempts),
    true,
  );
  return RunSchema.parse(await client.get(id));
}

async function setupArtifacts(directory: string | null) {
  assert.ok(directory);
  for (const id of NativeSetupDelivery.Steps)
    assert.equal(
      (await readFile(resolve(directory, `${id}.txt`))).equals(Buffer.from(`Delivered ${id}`)),
      true,
    );
}
