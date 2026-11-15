import { strict as assert } from "node:assert";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import {
  Backend,
  BackgroundFixture,
  BoardFile,
  CatalogFixture,
  RunStatus,
  ServerState,
  Verdict,
} from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { RunSchema, RunSummarySchema } from "@titan/types";
import { createFakeBackend } from "../support/backend.ts";
import { withClientResponse } from "../support/client.ts";
import { writeIsolatedHome } from "../support/isolated.ts";

export async function catalogIsolation(mode: CatalogFixture) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    const home = resolve(root, "home");
    await mkdir(project);
    const factory = createFakeBackend;
    await writeIsolatedHome(home);
    let server = await startServer(home, factory);
    const client = createRunClient(home);
    try {
      const first = await client.submit({
        project,
        workflow: vendorRecoveryWorkflow(),
        backend: Backend.Fake,
        client_id: "catalog",
        submission_id: "one",
      });
      const second = await client.submit({
        project,
        workflow: vendorRecoveryWorkflow(),
        backend: Backend.Fake,
        client_id: "catalog",
        submission_id: "two",
      });
      assert.ok(
        await waitUntil(async () => (await client.get(first.run_id)).state === RunStatus.Passed),
      );
      assert.ok(
        await waitUntil(async () => (await client.get(second.run_id)).state === RunStatus.Passed),
      );
      await server.stop();
      const journal = resolve(project, BoardFile.Runs, second.run_id, BoardFile.Journal);
      if (mode === CatalogFixture.Missing || mode === CatalogFixture.Directory) await rm(journal);
      if (mode === CatalogFixture.Directory) await mkdir(journal);
      if (mode === CatalogFixture.Corrupt)
        await writeFile(journal, Buffer.from("invalid record\n"));
      await writeIsolatedHome(home);
      server = await startServer(home, factory);
      const rows = RunSummarySchema.array().parse((await client.list()).runs);
      assert.equal(rows.length, 2);
      assert.equal((await client.get(first.run_id)).state, RunStatus.Passed);
      const healthy = rows.find((row) => row.run_id === first.run_id);
      const target = rows.find((row) => row.run_id === second.run_id);
      assert.equal(healthy?.state, RunStatus.Passed);
      if (target?.state === ServerState.ReadUnavailable) assert.ok(target.error);
      return target?.state;
    } finally {
      await server.stop();
    }
  });
}

export async function listingResponse(value: unknown) {
  await withClientResponse(
    Response.json({
      schema_version: 1,
      runs: value,
      before: Number.MAX_SAFE_INTEGER,
      next_before: Array.isArray(value) && value.length ? 1 : Number.MAX_SAFE_INTEGER,
      has_more: false,
    }),
    async (client) => {
      RunSummarySchema.array().parse((await client.list()).runs);
    },
  );
  return true;
}

export async function startIsolation(mode: BackgroundFixture) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    const home = resolve(root, "home");
    await mkdir(project);
    let affected: string | null = null;
    await writeIsolatedHome(home);
    const server = await startServer(
      home,
      () =>
        new FakeBackend(async (spec) => {
          if (spec.writable && affected === null) {
            affected = spec.run_id;
            if (mode === BackgroundFixture.Operational)
              throw new OperationalError("vendor_stopped", "Fixture vendor stopped");
            if (
              mode === BackgroundFixture.AppendFailure ||
              mode === BackgroundFixture.ProjectionFailure
            ) {
              const file =
                mode === BackgroundFixture.AppendFailure ? BoardFile.Journal : BoardFile.State;
              const path = resolve(project, BoardFile.Runs, spec.run_id, file);
              await rename(path, `${path}.saved`);
              await mkdir(path);
            }
          }
          return {
            json: spec.writable
              ? { ok: true, marker: "fixture", turn: 1 }
              : { verdict: Verdict.Survived, evidence: "Checked candidate" },
          };
        }),
    );
    const client = createRunClient(home);
    try {
      const first = await client.submit({
        project,
        workflow: vendorRecoveryWorkflow(),
        backend: Backend.Fake,
        client_id: "background",
        submission_id: "one",
      });
      let state: string | undefined;
      assert.ok(
        await waitUntil(async () => {
          const error = await thrownBy(async () => {
            state = (await client.get(first.run_id)).state;
          });
          if (error) {
            assert.equal(Reflect.get(Object(error), "code"), "server_error");
            state = ServerState.ReadUnavailable;
          }
          return state !== RunStatus.Running;
        }),
      );
      const second = await client.submit({
        project,
        workflow: vendorRecoveryWorkflow(),
        backend: Backend.Fake,
        client_id: "background",
        submission_id: "two",
      });
      assert.ok(
        await waitUntil(async () => (await client.get(second.run_id)).state === RunStatus.Passed),
      );
      const rows = (await client.list()).runs;
      assert.equal(rows.length, 2);
      assert.equal(rows.find((row) => row.run_id === second.run_id)?.state, RunStatus.Passed);
      assert.equal(rows.find((row) => row.run_id === first.run_id)?.state, state);
      if (mode === BackgroundFixture.Operational) {
        const node = RunSchema.parse(await client.get(first.run_id)).nodes.deliver;
        assert.equal(node?.attempt, 1);
        assert.equal(node?.refutations, 0);
      }
      return state;
    } finally {
      await server.stop();
    }
  });
}
