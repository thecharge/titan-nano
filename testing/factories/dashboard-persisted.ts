import { Database } from "bun:sqlite";
import { expect } from "bun:test";
import { appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  BoardFile,
  DashboardHeader,
  DashboardRoute,
  RunStatus,
  ServerCredential,
  ServerFile,
  ServerSql,
} from "@titan/constants";
import { newId } from "@titan/core";
import { Engine } from "@titan/runner";
import { startServer } from "@titan/server";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type DashboardCodeBody,
  DashboardRunListSchema,
  RunSchema,
  type ServerHandle,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { exists } from "@titan/workspace";
import { createFakeBackend } from "../support/backend.ts";

async function listFrom(server: ServerHandle, home: string) {
  const person = (await readFile(join(home, ServerCredential.PersonFile), "utf8")).trim();
  const minted = await fetch(server.address.url + DashboardRoute.Code, {
    method: "POST",
    headers: { authorization: `Bearer ${person}` },
  });
  const code = ((await minted.json()) as DashboardCodeBody).code;
  const login = await fetch(`${server.address.url}/login?code=${code}`, { redirect: "manual" });
  const cookie = login.headers.get(DashboardHeader.SetCookie)?.split(";")[0] ?? "";
  const started = performance.now();
  const response = await fetch(server.address.url + DashboardRoute.Runs, { headers: { cookie } });
  expect(response.status).toBe(200);
  const result = DashboardRunListSchema.parse(await response.json());
  return { result, elapsed: performance.now() - started };
}

export async function persistedDashboard(
  total: number,
  partial: boolean,
  cache = "valid",
): Promise<boolean> {
  return withTemporaryDirectory(async (root) => {
    const home = join(root, "home");
    const project = join(root, "project");
    await mkdir(home);
    await mkdir(project);
    await writeFile(join(home, "config.yaml"), "server:\n  max_resident_runs: 2\n");
    const engine = new Engine(() => createFakeBackend());
    const seed = await engine.create({
      project,
      plan: validateWorkflow(vendorRecoveryWorkflow()),
      config: await resolveConfig({ home, project }),
      backend: Backend.Fake,
      client_id: "persisted",
      submission_id: "seed",
    });
    const database = new Database(join(home, ServerFile.Database));
    for (const query of ServerSql.Initialize) database.run(query);
    const before = new Map<string, Buffer>();
    try {
      for (let index = 0; index < total; index++) {
        const id = newId();
        const run = RunSchema.parse(JSON.parse(JSON.stringify(seed).replaceAll(seed.run_id, id)));
        run.version = 0;
        run.state = RunStatus.Passed;
        await new RunStore(run.root).commit(run, "persisted-fixture");
        await rm(join(run.root, BoardFile.Events));
        const path = join(run.root, BoardFile.Journal);
        if (partial && index === 0) await appendFile(path, "{unfinished");
        before.set(path, await readFile(path));
        database.query(ServerSql.Insert).run(id, run.root, "persisted", String(index), "fixture");
      }
    } finally {
      database.close();
    }
    let server = await startServer(home, () => createFakeBackend());
    try {
      expect((await listFrom(server, home)).result.runs.length).toBe(total);
      await server.stop();
      const retained = new Database(join(home, ServerFile.Database));
      try {
        if (cache === "stale") retained.run("UPDATE run_numbers SET size = 0");
        if (cache === "stamp") retained.run("UPDATE run_numbers SET stamp = 'invalid'");
        if (cache === "state")
          retained.run("UPDATE run_numbers SET numbers = json_set(numbers, '$.state', 'queued')");
        if (cache === "workflow")
          retained.run(
            "UPDATE run_numbers SET numbers = json_set(numbers, '$.workflow_id', 'another-workflow')",
          );
        if (cache === "identity")
          retained.run(
            "UPDATE run_numbers SET numbers = json_set(numbers, '$.run_id', 'another-run')",
          );
        if (cache === "json") retained.run("UPDATE run_numbers SET numbers = 'invalid JSON'");
        if (cache === "shape") retained.run("UPDATE run_numbers SET numbers = '{}'");
      } finally {
        retained.close();
      }
      server = await startServer(home, () => createFakeBackend());
      const shown = await listFrom(server, home);
      expect(shown.result.runs.length).toBe(total);
      expect(shown.elapsed).toBeLessThan(2000);
      for (const entry of shown.result.runs) {
        expect(entry.numbers?.run_id).toBe(entry.summary.run_id);
        expect(entry.numbers?.state).toBe(RunStatus.Passed);
        expect(entry.numbers?.started_at).toBe(seed.created_at);
        expect(entry.numbers?.cost_usd.label).toBe("not reported");
      }
      expect(shown.result.runs.every((entry) => entry.summary.state === RunStatus.Passed)).toBe(
        true,
      );
      for (const [path, bytes] of before) {
        expect((await readFile(path)).equals(bytes)).toBe(true);
        expect(await exists(join(path, "..", BoardFile.Events))).toBe(false);
      }
      return true;
    } finally {
      await server.stop();
    }
  });
}
