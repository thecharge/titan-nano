import { strict as assert } from "node:assert";
import { chmod, link, mkdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  Backend,
  ErrorCode,
  LocalServer,
  RunStatus,
  ServerDatabaseAdapter,
  ServerFile,
  ServerLimit,
} from "@titan/constants";
import { call, readAddress, startServer } from "@titan/server";
import { ownMaintenance, ownOfflineHome } from "@titan/server/maintenance";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { RunSnapshotSchema, ServerHealthSchema } from "@titan/types";
import { exists } from "@titan/workspace";
import { createFakeBackend } from "../support/backend.ts";
import { checkedWorkflow } from "./hardening.ts";

export async function serverOwnership(mode: string) {
  return withTemporaryDirectory(async (home) => {
    const factory = () => createFakeBackend();
    if (mode === "held-lease" || mode === "held-lease-marker") {
      const owner = await startServer(home, factory);
      let contender: Awaited<ReturnType<typeof startServer>> | undefined;
      try {
        if (mode === "held-lease") await rm(resolve(home, ServerFile.Lock), { recursive: true });
        contender = await startServer(home, factory);
        return false;
      } finally {
        await contender?.stop();
        await owner.stop();
      }
    }
    const child = Bun.spawn([process.execPath, "-e", ""], { stdout: "ignore", stderr: "ignore" });
    await child.exited;
    const lock = resolve(home, ServerFile.Lock);
    if (mode === "lease-path") await mkdir(resolve(home, ServerFile.Lease));
    else {
      await mkdir(lock);
      if (mode !== "missing")
        await writeFile(
          resolve(lock, ServerFile.Owner),
          mode === "corrupt"
            ? Buffer.from("{")
            : Buffer.from(
                JSON.stringify({
                  pid: mode === "live" || mode.startsWith("reused-pid") ? process.pid : child.pid,
                  started_at: 1,
                  ...(mode.startsWith("reused-pid") ? { lease: true } : {}),
                  ...(mode === "invalid-marker" ? { lease: false } : {}),
                }),
              ),
        );
    }
    if (mode === "dead-again" || mode === "reused-pid-again")
      await writeFile(resolve(home, LocalServer.File), Buffer.from("stale address"));
    const server = await startServer(home, factory);
    try {
      const run = RunSnapshotSchema.parse(
        await call(home, "/runs", "POST", {
          project: home,
          workflow: checkedWorkflow(),
          backend: Backend.Fake,
          client_id: "ownership",
          submission_id: "recovered",
        }),
      );
      const passed = await waitUntil(
        async () =>
          RunSnapshotSchema.parse(await call(home, `/runs/${run.run_id}`)).state ===
          RunStatus.Passed,
      );
      if (!passed) throw new Error("Reclaimed owner cannot execute a workflow");
      const health = await fetch(new URL("/health", server.address.url), {
        headers: { authorization: `Bearer ${server.address.token}` },
      });
      return {
        status: health.status,
        addressRenewed: (await readAddress(home)).token === server.address.token,
      };
    } finally {
      await server.stop();
    }
  });
}

export function maintenanceOwnership(mode: string) {
  return withTemporaryDirectory(async (home) => {
    const factory = () => createFakeBackend();
    if (mode === "invalid") {
      await mkdir(resolve(home, ServerFile.MaintenanceLease));
      await using refused = new AsyncDisposableStack();
      await assert.rejects(ownMaintenance(home, refused), { code: ErrorCode.ServerLocked });
      return true;
    }
    if (mode === "released") {
      const earlier = new AsyncDisposableStack();
      await ownMaintenance(home, earlier);
      await earlier.disposeAsync();
      await using next = new AsyncDisposableStack();
      await ownMaintenance(home, next);
      await ownOfflineHome(home, next);
      return true;
    }
    if (mode === "live") {
      const server = await startServer(home, factory);
      try {
        await using maintenance = new AsyncDisposableStack();
        await ownMaintenance(home, maintenance);
        await using refused = new AsyncDisposableStack();
        await assert.rejects(ownOfflineHome(home, refused), { code: ErrorCode.ServerLocked });
        await assert.rejects(startServer(home, factory), { code: ErrorCode.ServerLocked });
        assert.equal(ServerHealthSchema.parse(await call(home, "/health")).ready, true);
      } finally {
        await server.stop();
      }
      const recovered = await startServer(home, factory);
      await recovered.stop();
      return true;
    }
    await using owner = new AsyncDisposableStack();
    await ownMaintenance(home, owner);
    if (mode === "updater") {
      await using contender = new AsyncDisposableStack();
      await assert.rejects(ownMaintenance(home, contender), { code: ErrorCode.ServerLocked });
    } else await assert.rejects(startServer(home, factory), { code: ErrorCode.ServerLocked });
    return true;
  });
}

export function maintenanceProcess(mode: string) {
  return withTemporaryDirectory(async (home) => {
    const ready = resolve(home, "maintenance-ready");
    const source = `
      import { ownMaintenance, ownOfflineHome } from ${JSON.stringify(import.meta.resolve("@titan/server/maintenance"))};
      await using resources = new AsyncDisposableStack();
      await ownMaintenance(${JSON.stringify(home)}, resources);
      await ownOfflineHome(${JSON.stringify(home)}, resources);
      await Bun.write(${JSON.stringify(ready)}, "ready");
      await new Response(Bun.stdin.stream()).text();
    `;
    const child = Bun.spawn([process.execPath, "-e", source], {
      stdin: "pipe",
      stdout: "ignore",
      stderr: "inherit",
    });
    try {
      assert.ok(await waitUntil(() => exists(ready)));
      if (mode === "updater") {
        await using refused = new AsyncDisposableStack();
        await assert.rejects(ownMaintenance(home, refused), { code: ErrorCode.ServerLocked });
      }
      if (mode === "server")
        await assert.rejects(startServer(home, createFakeBackend), {
          code: ErrorCode.ServerLocked,
        });
      if (mode === "killed") child.kill("SIGKILL");
      else child.stdin.end();
      const code = await child.exited;
      assert.equal(code === 0, mode !== "killed");
      {
        await using recovered = new AsyncDisposableStack();
        await ownMaintenance(home, recovered);
        await ownOfflineHome(home, recovered);
      }
      const server = await startServer(home, createFakeBackend);
      await server.stop();
      return true;
    } finally {
      if (child.exitCode === null) child.kill("SIGKILL");
      await child.exited;
    }
  });
}

export function leasePathSafety(
  offline: boolean,
  unsafe: boolean,
  hard = false,
  companion = false,
) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    await mkdir(home);
    const target = resolve(root, "person-owned.db");
    if (companion) await writeFile(target, Buffer.alloc(0));
    else {
      const database = new Bun.SQL({ adapter: ServerDatabaseAdapter, filename: target });
      try {
        await database.unsafe("CREATE TABLE retained (value TEXT)");
        await database.unsafe("INSERT INTO retained VALUES ('Preserve the person data')");
      } finally {
        await database.close();
      }
    }
    await chmod(target, 0o644);
    const bytes = await readFile(target);
    const before = await stat(target);
    const path = resolve(
      home,
      (offline ? ServerFile.Lease : ServerFile.MaintenanceLease) + (companion ? "-journal" : ""),
    );
    if (unsafe) await (hard ? link(target, path) : symlink(target, path));
    await using resources = new AsyncDisposableStack();
    const acquire = () =>
      offline ? ownOfflineHome(home, resources) : ownMaintenance(home, resources);
    if (unsafe) await assert.rejects(acquire(), { code: ErrorCode.ServerLocked });
    else {
      await acquire();
      assert.equal((await stat(path)).mode & 0o777, ServerLimit.FileMode);
    }
    assert.deepEqual(await readFile(target), bytes);
    assert.equal((await stat(target)).mode, before.mode);
    return true;
  });
}
