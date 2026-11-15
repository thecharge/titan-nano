import { strict as assert } from "node:assert";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ApprovalLevel,
  ConfigFile,
  ExecutionPhase,
  RunStatus,
  SdkProcessFixture,
  WorkspaceModeSetting,
} from "@titan/constants";
import { createRunClient } from "@titan/server/client";
import { createRequestClient } from "@titan/server/requests";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { ConfigSchema, type NativeBackendId, RunSchema, type SdkProbePaths } from "@titan/types";
import { prepareSdkProject } from "./sdk-process.ts";
import { serverReady, spawnServer } from "./server-process.ts";

export async function helperProcess(
  backend: NativeBackendId,
  raised: boolean,
  paths: SdkProbePaths = {},
) {
  return withTemporaryDirectory(async (root) => {
    const { home, project } = await prepareSdkProject(root, backend, 0, false, paths.vendors);
    const configPath = resolve(home, ConfigFile.User);
    const config = ConfigSchema.parse(JSON.parse((await readFile(configPath)).toString()));
    config.workspace = { ...config.workspace, mode: WorkspaceModeSetting.Live };
    await writeFile(configPath, Buffer.from(JSON.stringify(config)));
    const child = spawnServer(home, paths.cli, SdkProcessFixture.DaemonTimeout);
    try {
      assert(
        await waitUntil(() => serverReady(home, child.pid), SdkProcessFixture.ObserveAttempts),
      );
      const base = vendorRecoveryWorkflow("complete");
      const workflow = {
        ...base,
        personas: {
          ...base.personas,
          worker: { ...base.personas.worker, request_turns: true },
          investigator: { ...base.personas.worker },
        },
        steps: base.steps.map((step) => ({
          ...step,
          do: { ...step.do, task: "request_turn_helper" },
        })),
      };
      const client = createRunClient(home);
      const run = await client.submit({
        project,
        workflow,
        backend,
        client_id: "helper-native-owner",
        submission_id: "helper-native-delivery",
        ...(raised ? { overrides: { approvals: { ask: ApprovalLevel.Human } } } : {}),
      });
      assert(
        await waitUntil(async () => {
          const state = (await client.get(run.run_id)).state;
          return [RunStatus.Passed, RunStatus.Waiting, RunStatus.Blocked].includes(state);
        }, SdkProcessFixture.ObserveAttempts),
      );
      const saved = RunSchema.parse(await client.get(run.run_id));
      assert.equal(saved.state, raised ? RunStatus.Waiting : RunStatus.Passed);
      const node = saved.nodes.deliver;
      assert(node);
      const phases = Object.values(node.phases).filter((phase) => phase.helper);
      assert.equal(phases.length, raised ? 0 : 1);
      const requests = (await createRequestClient(home).list({ run_id: run.run_id })).requests;
      assert.equal(requests.length, 1);
      assert.equal(requests[0]?.request.answer?.decision, raised ? undefined : "approve");
      if (!raised) {
        assert.equal(phases[0]?.completed, true);
        assert.notEqual(phases[0]?.session_id, node.phases[ExecutionPhase.Worker]?.session_id);
        assert.equal((await client.usage(run.run_id)).executions, 4);
      }
      return true;
    } finally {
      child.kill("SIGTERM");
      await child.exited;
    }
  });
}
