import { strict as assert } from "node:assert";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  Backend,
  ConfigFile,
  ErrorCode,
  HttpStatus,
  LocalServer,
  RunStatus,
  RuntimeLimit,
  ServerFile,
} from "@titan/constants";
import { all } from "@titan/core";
import { call, startServer } from "@titan/server";
import { ServerAdmission } from "@titan/server/admission";
import { requestServerStop } from "@titan/server/maintenance";
import { thrownBy, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { RunSnapshotSchema, type ServerHandle } from "@titan/types";
import { exists } from "@titan/workspace";
import { createFakeBackend } from "../support/backend.ts";
import { openDirectoryFiles } from "../support/descriptors.ts";
import { checkedWorkflow } from "./hardening.ts";

export async function serverLifecycle(mode: string) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await all([() => mkdir(home), () => mkdir(project)]);
    const factory = () => createFakeBackend();
    const listeners: ReturnType<typeof Bun.serve>[] = [];
    const serve = Bun.serve;
    Bun.serve = new Proxy(serve, {
      apply(target, receiver, args: Parameters<typeof Bun.serve>) {
        const server: ReturnType<typeof Bun.serve> = Reflect.apply(target, receiver, args);
        listeners.push(server);
        return server;
      },
    });
    try {
      const config = resolve(home, ConfigFile.User);
      const database = resolve(home, ServerFile.Database);
      const address = resolve(home, LocalServer.File);
      if (mode === "config") await writeFile(config, "server: { max_active_agents: 0 }");
      if (mode === "database") await mkdir(database);
      if (mode === "address") await mkdir(address);
      let previous: ServerHandle | undefined;
      const failed = await thrownBy(async () => {
        const server = await startServer(home, factory);
        previous = server;
        const first = server.stop();
        const second = server.stop();
        if (first !== second) throw new Error("Shutdown must share its completion");
        await all([() => first, () => second]);
      });
      const lockReleased = !(await exists(resolve(home, ServerFile.Lock)));
      const databaseClosed = (await openDirectoryFiles(home)) === 0;
      const stopped = await all(
        listeners.map(
          (server) => async () => thrownBy(() => fetch(new URL("/health", server.url))),
        ),
      );
      const listenersStarted = listeners.length;
      const listenerClosed = stopped.every((error) => error !== undefined);
      if (mode === "config") await rm(config);
      if (mode === "database") await rm(database, { recursive: true });
      if (mode === "address") await rm(address, { recursive: true });
      const retried = await startServer(home, factory);
      try {
        if (mode === "repeated") await previous?.stop();
        const ownerPreserved =
          (await exists(resolve(home, ServerFile.Lock))) && (await exists(address));
        const response = await fetch(new URL("/health", retried.address.url), {
          headers: { authorization: `Bearer ${retried.address.token}` },
        });
        const run = RunSnapshotSchema.parse(
          await call(home, "/runs", "POST", {
            project,
            workflow: checkedWorkflow(),
            backend: Backend.Fake,
            client_id: "lifecycle",
            submission_id: "after-retry",
          }),
        );
        const settled = await waitUntil(async () => {
          const state = RunSnapshotSchema.parse(await call(home, `/runs/${run.run_id}`));
          return state.state === RunStatus.Passed;
        });
        return {
          failed: failed !== undefined,
          lockReleased,
          databaseClosed,
          listenerClosed,
          listenersStarted,
          ownerPreserved,
          retryReady: response.status === 200 && settled,
        };
      } finally {
        await retried.stop();
      }
    } finally {
      Bun.serve = serve;
      await all(listeners.map((server) => () => server.stop(true)));
    }
  });
}

export async function serverAdmission(mode: string) {
  const admission = new ServerAdmission();
  if (mode === "idle") {
    assert.equal(await admission.use(async () => true), true);
    const closed = admission.close();
    assert.equal(admission.close(), closed);
    await closed;
    return true;
  }
  if (mode === "closed") {
    await admission.close();
    let called = false;
    await assert.rejects(
      admission.use(async () => {
        called = true;
      }),
      {
        code: ErrorCode.ServerStopping,
      },
    );
    assert.equal(called, false);
    return true;
  }
  const gate = Promise.withResolvers<void>();
  const count = mode === "capacity" ? RuntimeLimit.PendingOperations : 2;
  const tasks = Array.from({ length: count }, () => admission.use(() => gate.promise));
  try {
    if (mode === "capacity")
      await assert.rejects(
        admission.use(async () => true),
        { code: ErrorCode.Capacity },
      );
    let drained = false;
    const closed = admission.close().then(() => {
      drained = true;
    });
    await Promise.resolve();
    assert.equal(drained, false);
    gate.resolve();
    await all(tasks.map((task) => () => task));
    await closed;
    assert.equal(drained, true);
  } finally {
    gate.resolve();
    await all(tasks.map((task) => () => task));
  }
  return true;
}

export function serverShutdown(method: string, invalid: boolean) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    const home = resolve(root, "home");
    await mkdir(project);
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const read = Request.prototype.json;
    let held = false;
    Request.prototype.json = async function () {
      if (!held && new URL(this.url).pathname === "/runs") {
        held = true;
        entered.resolve();
        await release.promise;
      }
      return Reflect.apply(read, this, []);
    };
    const body = {
      project,
      workflow: checkedWorkflow(),
      backend: Backend.Fake,
      client_id: "shutdown",
      submission_id: "accepted",
    };
    let server: ServerHandle | undefined;
    try {
      server = await startServer(home, createFakeBackend);
      const headers = { authorization: `Bearer ${server.address.token}` };
      const accepted = fetch(new URL("/runs", server.address.url), {
        method: "POST",
        headers,
        body: invalid ? "{}" : JSON.stringify(body),
      });
      assert.ok(await waitUntil(async () => held));
      await entered.promise;
      await assert.rejects(requestServerStop(home), { code: ErrorCode.ServerBusy });
      const stopping = server.stop();
      assert.equal(server.stop(), stopping);
      const rejected = await fetch(
        new URL(method === "GET" ? "/health" : "/runs", server.address.url),
        {
          method,
          headers,
          ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
        },
      );
      assert.equal(rejected.status, HttpStatus.Unavailable);
      assert.equal((await rejected.json()).code, ErrorCode.ServerStopping);
      release.resolve();
      const response = await accepted;
      assert.equal(response.status, invalid ? HttpStatus.BadRequest : HttpStatus.Created);
      const result = await response.json();
      await stopping;
      server = await startServer(home, createFakeBackend);
      const retried = await call(home, "/runs", "POST", body);
      if (!invalid)
        assert.equal(
          RunSnapshotSchema.parse(retried).run_id,
          RunSnapshotSchema.parse(result).run_id,
        );
      assert.equal((await openDirectoryFiles(home)) > 0, true);
      return true;
    } finally {
      release.resolve();
      Request.prototype.json = read;
      await server?.stop();
    }
  });
}
