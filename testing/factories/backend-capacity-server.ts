import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { resolveConfig } from "@titan/config";
import { Backend, ExecutionPhase, RunAction, RunStatus } from "@titan/constants";
import { all } from "@titan/core";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type BackendId, RunSchema } from "@titan/types";
import {
  backendCapacityPeerWorkflow,
  backendCapacityProbe,
  backendCapacityWorkflow,
} from "../support/backend-capacity.ts";

export async function configuredBackendCapacity(value: unknown, owner: boolean, workflow: boolean) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    await mkdir(project);
    const settings = { server: { backend_limits: value } };
    const configFile = resolve(owner ? root : project, "config.yaml");
    if (!workflow) await writeFile(configFile, Buffer.from(JSON.stringify(settings)));
    const options = {
      home: root,
      project,
      ...(!owner && !workflow ? { configFile } : {}),
      ...(workflow ? { workflow: settings } : {}),
    };
    const config = await resolveConfig(options);
    return config.value.server.backend_limits;
  });
}

export async function backendCapacityServer(backend: BackendId, cancel: boolean, checker = false) {
  async function inspect(root: string) {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await all([() => mkdir(home), () => mkdir(project)]);
    const settings = { max_active_agents: 2, backend_limits: { [backend]: 1 } };
    await writeFile(
      resolve(home, "config.yaml"),
      Buffer.from(JSON.stringify({ server: settings })),
    );
    const probe = backendCapacityProbe(backend, checker);
    const server = await startServer(home, () => probe.fake);
    try {
      const client = createRunClient(home);
      const identity = { project, backend: Backend.Fake, client_id: "owner" };
      const owner = await client.submit({
        ...identity,
        submission_id: "owner",
        workflow: backendCapacityWorkflow(backend, true, checker),
      });
      await probe.entered;
      const peer = await client.submit({
        ...identity,
        submission_id: "peer",
        workflow: backendCapacityPeerWorkflow(backend),
      });
      assert.ok(
        await waitUntil(async () => (await client.get(peer.run_id)).state === RunStatus.Passed),
        "The other backend must finish while the first is held",
      );
      const pending = RunSchema.parse(await client.get(owner.run_id));
      const phase = checker ? `${ExecutionPhase.FalsifierPrefix}0` : ExecutionPhase.Worker;
      assert.equal(
        Object.values(pending.nodes).reduce(
          (sum, node) => sum + (node.phases[phase]?.executions ?? 0),
          0,
        ),
        1,
      );
      const cancellation = cancel
        ? client.control(owner.run_id, RunAction.Cancel)
        : Promise.resolve();
      if (cancel) await probe.cancelled;
      probe.release();
      await cancellation;
      assert.ok(
        await waitUntil(
          async () =>
            (await client.get(owner.run_id)).state ===
            (cancel ? RunStatus.Cancelled : RunStatus.Passed),
        ),
      );
      const final = RunSchema.parse(await client.get(owner.run_id));
      return {
        peak: probe.statistics().peak,
        active: probe.statistics().active,
        state: final.state,
        peerState: (await client.get(peer.run_id)).state,
        attempts: Object.values(final.nodes).map((node) => node.attempt),
        refutations: Object.values(final.nodes).map((node) => node.refutations),
      };
    } finally {
      probe.release();
      await server.stop();
    }
  }
  return withTemporaryDirectory(inspect);
}
