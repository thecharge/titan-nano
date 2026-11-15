import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { Backend, ConfigFile, ErrorCode, RunAction, RunStatus, Verdict } from "@titan/constants";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { RunSchema } from "@titan/types";

export async function residentOwner(maximum: number, reverse: boolean) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(home);
    await mkdir(project);
    await writeFile(
      resolve(home, ConfigFile.User),
      Buffer.from(JSON.stringify({ server: { max_resident_runs: maximum } })),
    );
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const executions: string[] = [];
    let held: string | null = null;
    const backend = new FakeBackend(async (spec) => {
      if (spec.writable) executions.push(spec.run_id);
      if (spec.writable && held === null) {
        held = spec.run_id;
        entered.resolve();
        await release.promise;
      }
      return {
        json: spec.writable
          ? { ok: true, marker: "candidate", turn: 1 }
          : { verdict: Verdict.Survived, evidence: "Checked candidate" },
      };
    });
    const server = await startServer(home, () => backend);
    const client = createRunClient(home);
    const names = reverse ? ["second", "first"] : ["first", "second"];
    const submit = async (submission_id: string) =>
      RunSchema.parse(
        await client.submit({
          project,
          workflow: {
            ...vendorRecoveryWorkflow(),
            steps: vendorRecoveryWorkflow().steps.map((step) => ({
              ...step,
              files: [`${submission_id}.txt`],
            })),
          },
          backend: Backend.Fake,
          client_id: "residency-owner",
          submission_id,
        }),
      );
    try {
      const first = await submit(names[0] ?? "first");
      await entered.promise;
      if (maximum === 1) {
        await assert.rejects(submit(names[1] ?? "second"), { code: ErrorCode.Capacity });
        assert.deepEqual(executions, [first.run_id]);
        release.resolve();
        assert.ok(
          await waitUntil(async () => (await client.get(first.run_id)).state === RunStatus.Passed),
        );
      }
      const peer = await submit(names[1] ?? "second");
      assert.notEqual(peer.run_id, first.run_id);
      if (maximum === 1) {
        assert.equal(peer.state, RunStatus.Blocked);
        assert.equal(peer.nodes.deliver?.phases.worker?.executions ?? 0, 0);
        await client.control(peer.run_id, RunAction.Resume);
      }
      assert.ok(
        await waitUntil(async () => (await client.get(peer.run_id)).state === RunStatus.Passed),
      );
      assert.deepEqual(executions, [first.run_id, peer.run_id]);
      release.resolve();
      assert.ok(
        await waitUntil(async () => (await client.get(first.run_id)).state === RunStatus.Passed),
      );
      assert.equal(RunSchema.parse(await client.get(peer.run_id)).nodes.deliver?.attempt, 1);
      assert.equal((await client.list()).runs.length, 2);
      return true;
    } finally {
      release.resolve();
      await server.stop();
    }
  });
}
