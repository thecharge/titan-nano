import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  Backend,
  ConfigFile,
  ErrorCode,
  RunStatus,
  ServerQueueField,
  TaskOutcome,
} from "@titan/constants";
import { settle } from "@titan/core";
import { Engine } from "@titan/runner";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type OwnerBudgetField, RunSchema } from "@titan/types";
import { createFakeBackend } from "../support/backend.ts";
import { requestQueueCapacity, requestQueueSettings } from "./request-queue.ts";

export async function runQueueSettings(field: OwnerBudgetField, settings: unknown, owner = true) {
  return requestQueueSettings(settings, owner, field);
}

export async function runQueueCapacity(maximum: number, answer: boolean) {
  return requestQueueCapacity(maximum, answer, ServerQueueField.Runs);
}

export async function submissionQueueCapacity(maximum: number, reverse: boolean, runMaximum = 2) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(home);
    await mkdir(project);
    await writeFile(
      resolve(home, ConfigFile.User),
      Buffer.from(
        JSON.stringify({
          server: { max_pending_submissions: maximum, max_pending_run_operations: runMaximum },
        }),
      ),
    );
    const server = await startServer(home, createFakeBackend);
    const original = Engine.prototype.create;
    const release = Promise.withResolvers<void>();
    let held = false;
    let active: ReturnType<typeof settle> | undefined;
    try {
      const runs = createRunClient(home);
      const submit = (submission_id: string) =>
        runs.submit({
          project,
          workflow: vendorRecoveryWorkflow(),
          backend: Backend.Fake,
          client_id: "submission-queue-owner",
          submission_id,
        });
      Engine.prototype.create = async function (options) {
        if (!held) {
          held = true;
          await release.promise;
        }
        return original.call(this, options);
      };
      active = settle([() => submit(reverse ? "second" : "first")]);
      assert.ok(await waitUntil(async () => held));
      const secondId = reverse ? "first" : "second";
      let refused = false;
      let second: unknown;
      try {
        second = await submit(secondId);
      } catch (error) {
        assert.equal(Reflect.get(Object(error), "code"), ErrorCode.Capacity);
        refused = true;
      }
      assert.equal(refused, maximum === 1);
      release.resolve();
      const completed = await active;
      const first = completed[0];
      assert.ok(first?.status === TaskOutcome.Fulfilled);
      if (refused) second = await submit(secondId);
      const observed = RunSchema.parse(second);
      const initial = RunSchema.parse(first.value);
      assert.notEqual(initial.run_id, observed.run_id);
      const repeated = RunSchema.parse(await submit(secondId));
      assert.equal(repeated.run_id, observed.run_id);
      assert.ok(
        await waitUntil(
          async () => RunSchema.parse(await runs.get(observed.run_id)).state === RunStatus.Passed,
        ),
      );
      assert.ok(
        await waitUntil(
          async () => RunSchema.parse(await runs.get(initial.run_id)).state === RunStatus.Passed,
        ),
      );
      assert.equal(RunSchema.parse(await runs.get(observed.run_id)).nodes.deliver?.attempt, 1);
      assert.equal(RunSchema.parse(await runs.get(initial.run_id)).nodes.deliver?.attempt, 1);
      return true;
    } finally {
      release.resolve();
      await active;
      Engine.prototype.create = original;
      await server.stop();
    }
  });
}
