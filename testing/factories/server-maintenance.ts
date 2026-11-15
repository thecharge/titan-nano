import { strict as assert } from "node:assert";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { RunStore } from "@titan/board";
import {
  Backend,
  ErrorCode,
  RunStatus,
  SdkProcessFixture,
  ServerRoute,
  SignalEvent,
} from "@titan/constants";
import { call, startServer } from "@titan/server";
import { callAsPerson } from "@titan/server/client";
import { requestServerStop } from "@titan/server/maintenance";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type RunSnapshot,
  RunSnapshotSchema,
  type SdkProbePaths,
  ServerHealthSchema,
} from "@titan/types";
import { createFakeBackend, schemaFakeAnswer } from "../support/backend.ts";
import { checkedWorkflow } from "./hardening.ts";
import { serverReady, spawnServer } from "./server-process.ts";

export function serverMaintenance(mode: string) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(project);
    const serve = Bun.serve;
    if (mode === "cleanup")
      Bun.serve = new Proxy(serve, {
        apply(target, receiver, args: Parameters<typeof Bun.serve>) {
          const server: ReturnType<typeof Bun.serve> = Reflect.apply(target, receiver, args);
          const stop = server.stop.bind(server);
          server.stop = async (force) => {
            await stop(force);
            throw new Error("Maintenance cleanup failure");
          };
          return server;
        },
      });
    const active = mode === "active" || mode === "force";
    let entered = false;
    const factory = active
      ? () =>
          new FakeBackend(async (spec, _prompt, signal) => {
            entered = true;
            await new Promise<void>((done) =>
              signal.addEventListener(SignalEvent.Abort, () => done(), { once: true }),
            );
            return schemaFakeAnswer(spec);
          })
      : createFakeBackend;
    const server = await startServer(home, factory).finally(() => {
      Bun.serve = serve;
    });
    try {
      let run: RunSnapshot | undefined;
      if (active) {
        run = RunSnapshotSchema.parse(
          await call(home, "/runs", "POST", {
            project,
            workflow: checkedWorkflow(),
            backend: Backend.Fake,
            client_id: "maintenance",
            submission_id: "active",
          }),
        );
        assert.ok(await waitUntil(async () => entered));
      }
      if (mode === "agent")
        await assert.rejects(call(home, ServerRoute.Stop, "POST", {}), {
          code: ErrorCode.PermissionDenied,
        });
      else if (mode === "method")
        await assert.rejects(callAsPerson(home, ServerRoute.Stop, "GET", undefined), {
          code: ErrorCode.Method,
        });
      else if (mode === "body" || mode === "query")
        await assert.rejects(
          callAsPerson(home, ServerRoute.Stop + (mode === "query" ? "?extra=true" : ""), "POST", {
            idle_only: mode === "body" ? "false" : true,
          }),
          { code: ErrorCode.Arguments },
        );
      else if (mode === "active")
        await assert.rejects(requestServerStop(home), { code: ErrorCode.ServerBusy });
      else {
        if (mode === "default") await callAsPerson(home, ServerRoute.Stop, "POST", {});
        else await requestServerStop(home, mode !== "force");
        await server.stopped;
        if (mode === "cleanup")
          await assert.rejects(server.stop(), { message: "Maintenance cleanup failure" });
        else await server.stop();
        if (run) {
          const retained = await new RunStore(run.root).read();
          assert.equal(retained.state, RunStatus.Paused);
          assert.equal(retained.nodes.one?.attempt, 1);
          assert.equal(retained.nodes.one?.refutations, 0);
        }
        const replacement = await startServer(home, createFakeBackend);
        await replacement.stop();
        return true;
      }
      assert.equal(ServerHealthSchema.parse(await call(home, "/health")).ready, true);
      return true;
    } finally {
      if (mode === "cleanup")
        await assert.rejects(server.stop(), { message: "Maintenance cleanup failure" });
      else await server.stop();
    }
  });
}

export function daemonMaintenance(mode: string, paths: SdkProbePaths = {}) {
  return withTemporaryDirectory(async (home) => {
    const child = spawnServer(home, paths.cli, SdkProcessFixture.DaemonTimeout);
    try {
      assert.ok(
        await waitUntil(() => serverReady(home, child.pid), SdkProcessFixture.ObserveAttempts),
      );
      if (mode === "agent" || mode === "body") {
        const rejected =
          mode === "agent"
            ? call(home, ServerRoute.Stop, "POST", {})
            : callAsPerson(home, ServerRoute.Stop, "POST", { idle_only: "false" });
        await assert.rejects(rejected, {
          code: mode === "agent" ? ErrorCode.PermissionDenied : ErrorCode.Arguments,
        });
        assert.equal(await serverReady(home, child.pid), true);
        assert.equal(child.exitCode, null);
        return true;
      }
      await requestServerStop(home, mode !== "explicit");
      assert.ok(
        await waitUntil(async () => child.exitCode !== null, SdkProcessFixture.ObserveAttempts),
      );
      assert.equal(await child.exited, 0);
      const next = spawnServer(home, paths.cli, SdkProcessFixture.DaemonTimeout);
      try {
        assert.ok(
          await waitUntil(() => serverReady(home, next.pid), SdkProcessFixture.ObserveAttempts),
        );
      } finally {
        next.kill("SIGTERM");
        assert.equal(await next.exited, 0);
      }
      return true;
    } finally {
      if (child.exitCode === null) child.kill("SIGTERM");
      await child.exited;
    }
  });
}
