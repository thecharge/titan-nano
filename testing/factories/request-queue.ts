import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  ApprovalLevel,
  Backend,
  ConfigFile,
  ErrorCode,
  RequestDecision,
  RequestKind,
  RunStatus,
  ServerQueueField,
  TaskOutcome,
} from "@titan/constants";
import { settle } from "@titan/core";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { createRequestClient } from "@titan/server/requests";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type OwnerBudgetField, RunSchema } from "@titan/types";
import { createFakeBackend } from "../support/backend.ts";

export async function requestQueueSettings(
  settings: unknown,
  owner = true,
  field: OwnerBudgetField = ServerQueueField.Requests,
) {
  return withTemporaryDirectory(async (home) => {
    const project = resolve(home, "project");
    await mkdir(resolve(project, ConfigFile.HomeDirectory), { recursive: true });
    await writeFile(
      resolve(owner ? home : project, owner ? ConfigFile.User : ConfigFile.Project),
      Buffer.from(JSON.stringify({ server: settings })),
    );
    const config = await resolveConfig({ home, project });
    return Reflect.get(config.value.server, field);
  });
}

function queueRequest(request_id: string) {
  return {
    request_id,
    kind: RequestKind.Tool,
    scope: {
      operation: "inspect",
      resource: "candidate",
      content_hashes: {},
      arguments: [],
      environment_names: [],
    },
    origin: { client_id: "queue-origin", harness_session_id: "queue-session" },
    expires_at: Date.now() + 60000,
  };
}

export async function requestQueueCapacity(
  maximum: number,
  answer: boolean,
  field = ServerQueueField.Requests,
) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(home);
    await mkdir(project);
    await writeFile(
      resolve(home, ConfigFile.User),
      Buffer.from(JSON.stringify({ server: { [field]: maximum } })),
    );
    const server = await startServer(home, createFakeBackend);
    const original = RunStore.prototype.events;
    const release = Promise.withResolvers<void>();
    let held = false;
    let active: ReturnType<typeof settle> | undefined;
    try {
      const runs = createRunClient(home);
      const requests = createRequestClient(home);
      const submit = async (submission_id: string) => {
        const run = RunSchema.parse(
          await runs.submit({
            project,
            workflow: vendorRecoveryWorkflow(),
            backend: Backend.Fake,
            client_id: "queue-owner",
            submission_id,
          }),
        );
        assert.ok(
          await waitUntil(
            async () => RunSchema.parse(await runs.get(run.run_id)).state === RunStatus.Passed,
          ),
        );
        return RunSchema.parse(await runs.get(run.run_id));
      };
      const first = await submit("first");
      const second = await submit("second");
      const target = await requests.open(second.run_id, queueRequest("target"));
      const before = RunSchema.parse(await runs.get(second.run_id));
      RunStore.prototype.events = async function* (through) {
        if (this.root === first.root && !held) {
          held = true;
          await release.promise;
        }
        yield* original.call(this, through);
      };
      active = settle([() => requests.open(first.run_id, queueRequest("held"))]);
      assert.ok(await waitUntil(async () => held));
      const perform = () =>
        answer
          ? requests.answer(
              {
                run_id: second.run_id,
                request_id: target.request_id,
                version: target.version,
                decision: RequestDecision.Approve,
                reason: "Reviewed exact request",
                client_id: "queue-reviewer",
              },
              ApprovalLevel.Main,
            )
          : requests.open(second.run_id, queueRequest("independent"));
      let refused = false;
      try {
        await perform();
      } catch (error) {
        assert.equal(Reflect.get(Object(error), "code"), ErrorCode.Capacity);
        refused = true;
      }
      assert.equal(refused, maximum === 1);
      if (refused && field === ServerQueueField.Runs) {
        await assert.rejects(runs.get(second.run_id), { code: ErrorCode.Capacity });
        assert.deepEqual(await new RunStore(second.root).read(), before);
      }
      if (refused && field !== ServerQueueField.Runs) {
        assert.deepEqual(RunSchema.parse(await runs.get(second.run_id)), before);
        assert.deepEqual(await requests.get(second.run_id, target.request_id), target);
      }
      release.resolve();
      const completed = await active;
      assert.equal(completed[0]?.status, TaskOutcome.Fulfilled);
      if (refused) await perform();
      const after = RunSchema.parse(await runs.get(second.run_id));
      assert.equal(after.version, before.version + 1);
      assert.equal(after.state, RunStatus.Passed);
      assert.equal(after.nodes.deliver?.attempt, 1);
      assert.equal(after.nodes.deliver?.refutations, 0);
      assert.equal((await requests.list({ run_id: first.run_id })).requests.length, 1);
      const observed = await requests.get(
        second.run_id,
        answer ? target.request_id : "independent",
      );
      assert.equal(observed.answer?.decision ?? null, answer ? RequestDecision.Approve : null);
      return true;
    } finally {
      release.resolve();
      await active;
      RunStore.prototype.events = original;
      await server.stop();
    }
  });
}
