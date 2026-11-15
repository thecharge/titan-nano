import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { ErrorCode, RunAction, RunStatus } from "@titan/constants";
import { OperationalError, TitanError, UsageLimitError } from "@titan/errors";
import { call, startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type BackendFactory, type BackendId, type NativeBackendId, RunSchema } from "@titan/types";
import { schemaFakeAnswer } from "../support/backend.ts";

export async function backendAuthorization(
  selected: NativeBackendId,
  limit: boolean,
  requested: string | null,
) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(project);
    await writeFile(resolve(project, "source.txt"), "Original input");
    const backends: BackendId[] = [];
    let interrupted = false;
    const factory: BackendFactory = (backend) =>
      new FakeBackend(async (spec) => {
        backends.push(backend);
        if (spec.writable && spec.invocation_id.startsWith("deliver/") && !interrupted) {
          interrupted = true;
          if (limit) throw new UsageLimitError("Controlled usage limit", 3_600_000);
          throw new OperationalError(ErrorCode.ProviderUnavailable, "Controlled interruption");
        }
        return schemaFakeAnswer(spec);
      });
    const workflow = vendorRecoveryWorkflow();
    const step = workflow.steps[0];
    assert.ok(step);
    workflow.steps = [{ ...step, id: "finished" }, step];
    let server = await startServer(home, factory);
    try {
      const client = createRunClient(home);
      const submitted = await client.submit({
        project,
        workflow,
        backend: selected,
        client_id: "backend-owner",
        submission_id: "restart",
      });
      assert.ok(
        await waitUntil(
          async () => (await client.get(submitted.run_id)).state === RunStatus.Blocked,
        ),
      );
      const before = RunSchema.parse(await client.get(submitted.run_id));
      assert.deepEqual(backends, [selected, selected, selected]);
      await client.control(before.run_id, RunAction.Pause);
      await server.stop();
      server = await startServer(home, factory);
      const restored = RunSchema.parse(await client.get(before.run_id));
      assert.equal(restored.backend, selected);
      assert.deepEqual(restored.nodes.finished, before.nodes.finished);
      assert.deepEqual(backends, [selected, selected, selected]);
      const path = `/runs/${before.run_id}/resume${requested === null ? "" : `?backend=${encodeURIComponent(requested)}`}`;
      const failure = await thrownBy(() => call(home, path, "POST", {}));
      if (failure) {
        assert.ok(failure instanceof TitanError);
        assert.equal(failure.code, ErrorCode.Backend);
        assert.deepEqual(backends, [selected, selected, selected]);
      } else if (limit && requested === null) {
        assert.ok(
          await waitUntil(
            async () => (await client.get(before.run_id)).state === RunStatus.Recovering,
          ),
        );
        const waiting = RunSchema.parse(await client.get(before.run_id));
        assert.deepEqual(waiting.nodes.deliver?.phases, before.nodes.deliver?.phases);
        assert.deepEqual(backends, [selected, selected, selected]);
        await client.control(before.run_id, RunAction.Pause);
      } else {
        assert.ok(
          await waitUntil(async () => (await client.get(before.run_id)).state === RunStatus.Passed),
        );
      }
      const after = RunSchema.parse(await client.get(before.run_id));
      const usage = await client.usage(before.run_id);
      assert.equal(usage.executions, backends.length);
      assert.equal(usage.reported_executions, backends.length - 1);
      assert.equal(usage.unreported_executions, 1);
      assert.deepEqual(after.nodes.finished, before.nodes.finished);
      assert.equal(after.nodes.deliver?.attempt, 1);
      assert.equal(after.nodes.deliver?.refutations, 0);
      assert.deepEqual(after.nodes.deliver?.evidence, []);
      return {
        state: after.state,
        backends,
        error: failure instanceof TitanError ? failure.code : null,
      };
    } finally {
      await server.stop();
    }
  });
}
