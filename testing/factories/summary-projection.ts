import { Database } from "bun:sqlite";
import { expect } from "bun:test";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import { Backend, BoardFile, RunStatus, ServerSql, ServerState } from "@titan/constants";
import { Engine } from "@titan/runner";
import {
  cachedRunNumbers,
  cachedRunSummary,
  describeRun,
  RunSummaryProjector,
  writeRunSummary,
} from "@titan/server/listing";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { CatalogDatabase } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { createFakeBackend } from "../support/backend.ts";

export async function summaryProjection(
  failure: boolean,
  execute: boolean,
  eventMode = "normal",
): Promise<boolean> {
  return withTemporaryDirectory(async (root) => {
    const project = join(root, "project");
    const home = join(root, "home");
    await mkdir(project);
    const db = new Database(":memory:");
    for (const query of ServerSql.Initialize) db.run(query);
    const database = {
      unsafe: async (query: string, params: unknown[]) => {
        if (
          failure &&
          (!execute ||
            (query === ServerSql.SummaryPut &&
              JSON.parse(String(params[3])).state === RunStatus.Passed))
        )
          throw new Error("Injected summary persistence failure");
        return db.query(query).all(...(params as (string | number)[]));
      },
    } as unknown as CatalogDatabase;
    const projector = new RunSummaryProjector(database, 1);
    const engine = new Engine(
      () => createFakeBackend(),
      {},
      {
        projectRun: (run, _kind, event) => {
          const selected = eventMode === "gap" && event ? { ...event, id: event.id + 1 } : event;
          return projector.write(run, undefined, eventMode === "missing" ? undefined : selected);
        },
      },
    );
    try {
      let id: string | undefined;
      const error = await thrownBy(async () => {
        const run = await engine.create({
          project,
          plan: validateWorkflow(vendorRecoveryWorkflow()),
          config: await resolveConfig({ home, project }),
          backend: Backend.Fake,
          client_id: "projection",
          submission_id: "one",
        });
        id = run.run_id;
        if (execute) await engine.start(id);
        const projected = await cachedRunSummary(database, id, run.root);
        expect(projected?.state).toBe(execute ? RunStatus.Passed : RunStatus.Running);
        expect(projected).toBeDefined();
        if (!projected) throw new Error("Missing persisted run summary");
        const numbers = await cachedRunNumbers(database, projected, run.root);
        expect(numbers?.state).toBe(execute ? RunStatus.Passed : RunStatus.Running);
        expect(numbers?.run_id).toBe(id);
        await writeRunSummary(database, run);
        expect(await cachedRunNumbers(database, projected, run.root)).toEqual(numbers);
        const listed = await describeRun(
          { id, root: run.root, sequence: 1, client_id: run.client_id },
          async () => {
            throw new Error("Listing replayed a board");
          },
          database,
          true,
        );
        expect(listed.state).toBe(execute ? RunStatus.Passed : RunStatus.Running);
      });
      if (failure) {
        expect(error).toBeInstanceOf(Error);
        if (execute) {
          expect(id).toBeDefined();
          expect(await thrownBy(() => engine.snapshot(String(id)))).toBeInstanceOf(Error);
        } else expect(engine.ids()).toEqual([]);
      } else expect(error).toBeUndefined();
      return true;
    } finally {
      db.close();
    }
  });
}

export async function summaryCache(mode: string): Promise<boolean> {
  return withTemporaryDirectory(async (root) => {
    const project = join(root, "project");
    const home = join(root, "home");
    await mkdir(project);
    const db = new Database(":memory:");
    for (const query of ServerSql.Initialize) db.run(query);
    const database = {
      unsafe: async (query: string, params: unknown[]) =>
        db.query(query).all(...(params as (string | number)[])),
    } as unknown as CatalogDatabase;
    const engine = new Engine(
      () => createFakeBackend(),
      {},
      { projectRun: (run) => writeRunSummary(database, run) },
    );
    try {
      const run = await engine.create({
        project,
        plan: validateWorkflow(vendorRecoveryWorkflow()),
        config: await resolveConfig({ home, project }),
        backend: Backend.Fake,
        client_id: "cache",
        submission_id: "one",
      });
      if (mode === "finished") await engine.start(run.run_id);
      if (mode === "stale") await appendFile(join(run.root, BoardFile.Journal), "{partial");
      if (mode === "crossed" || mode === "legacy") {
        const cached = await cachedRunSummary(database, run.run_id, run.root);
        expect(cached).toBeDefined();
        const summary = { ...cached };
        if (mode === "crossed") summary.run_id = "another-run";
        else {
          delete summary.stage;
          delete summary.persona;
        }
        db.query("UPDATE run_summaries SET summary = ? WHERE id = ?").run(
          JSON.stringify(summary),
          run.run_id,
        );
      }
      let reads = 0;
      const read = async () => {
        reads++;
        return new RunStore(run.root).inspect();
      };
      const row = { id: run.run_id, root: run.root, sequence: 1, client_id: run.client_id };
      const result = await describeRun(row, read, database, true);
      expect(reads).toBe(0);
      expect(result.state).toBe(
        mode === "stale" || mode === "crossed" || mode === "legacy"
          ? ServerState.ReadUnavailable
          : mode === "finished"
            ? RunStatus.Passed
            : RunStatus.Running,
      );
      if (mode === "legacy") {
        const migrated = await describeRun(row, read, database);
        expect(reads).toBe(1);
        expect(migrated.stage).toBeNull();
        expect(migrated.persona).toBeNull();
        expect((await describeRun(row, read, database, true)).state).toBe(RunStatus.Running);
        expect(reads).toBe(1);
      }
      return true;
    } finally {
      db.close();
    }
  });
}

export async function summaryMigration(mode: string): Promise<boolean> {
  return withTemporaryDirectory(async (root) => {
    const project = join(root, "project");
    const home = join(root, "home");
    await mkdir(project);
    const db = new Database(":memory:");
    for (const query of ServerSql.Initialize) db.run(query);
    const database = {
      unsafe: async (query: string, params: unknown[]) =>
        db.query(query).all(...(params as (string | number)[])),
    } as unknown as CatalogDatabase;
    const engine = new Engine(() => createFakeBackend());
    try {
      const run = await engine.create({
        project,
        plan: validateWorkflow(vendorRecoveryWorkflow()),
        config: await resolveConfig({ home, project }),
        backend: Backend.Fake,
        client_id: "migration",
        submission_id: "one",
      });
      if (mode === "finished") await engine.start(run.run_id);
      const original = await engine.snapshot(run.run_id);
      const row = { id: run.run_id, root: run.root, sequence: 1, client_id: run.client_id };
      const migrated = await describeRun(
        row,
        async () => {
          if (mode === "append") await appendFile(join(run.root, BoardFile.Journal), "{partial");
          if (mode === "commit") await engine.start(run.run_id);
          return original;
        },
        database,
      );
      expect(migrated.state).toBe(original.state);
      const cached = await cachedRunSummary(database, run.run_id, run.root);
      if (mode === "append" || mode === "commit") {
        expect(cached).toBeUndefined();
        const unavailable = await describeRun(
          row,
          async () => {
            throw new Error("Stored-only listing must not replay a journal");
          },
          database,
          true,
        );
        expect(unavailable.state).toBe(ServerState.ReadUnavailable);
      } else expect(cached).toEqual(migrated);
      return true;
    } finally {
      db.close();
    }
  });
}
