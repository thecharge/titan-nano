import { strict as assert } from "node:assert";
import { rm, truncate, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runtimeBuild } from "@titan/config";
import {
  CliCommand,
  CliRuntime,
  DaemonBuildCase,
  DaemonProbeFixture,
  DaemonStartup,
  EmbeddedRuntimeBuild,
  ErrorCode,
  HttpHeader,
  HttpStatus,
  IoLimit,
  LocalServer,
  McpIdentity,
  Packaging,
  ProbeOption,
  SdkProcessFixture,
  ServerRoute,
} from "@titan/constants";
import { hash, newId } from "@titan/core";
import { localServerUrl } from "@titan/messages";
import { readAddress } from "@titan/server/client";
import { readFileBytes } from "@titan/streams";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { ServerHealthSchema } from "@titan/types";
import { daemonEntry, probeDaemon } from "../../apps/cli/src/daemon.ts";
import { captureCli } from "../support/command.ts";
import { stopOwnedDaemon } from "../support/daemon.ts";
import { serverReady, spawnServer } from "./server-process.ts";

function probeResponse(mode: DaemonProbeFixture): Response {
  if (mode === DaemonProbeFixture.Unauthorized)
    return new Response("Denied", { status: HttpStatus.Unauthorized });
  if (mode === DaemonProbeFixture.Empty) return new Response(null, { status: 204 });
  if (mode === DaemonProbeFixture.Malformed) return new Response("{");
  if (mode === DaemonProbeFixture.Oversized)
    return new Response(Buffer.alloc(IoLimit.AddressBytes + 1, 32));
  if (mode === DaemonProbeFixture.Invalid) return Response.json({ ready: false });
  return Response.json(
    ServerHealthSchema.parse({
      ready: true,
      version:
        mode === DaemonProbeFixture.Older
          ? "0.0.0"
          : mode === DaemonProbeFixture.Newer
            ? "9999.0.0"
            : McpIdentity.Version,
      diagnostics: { written: 0, filtered: 0, rejected: 0, failed: 0, disabled: true },
    }),
  );
}

export async function daemonProbe(
  mode: DaemonProbeFixture,
  build?: string | null,
  header?: string,
  maintenance = false,
) {
  return withTemporaryDirectory(async (home) => {
    const token = "a".repeat(LocalServer.TokenMinimumLength);
    let requests = 0;
    const server = Bun.serve({
      hostname: LocalServer.Host,
      port: 0,
      fetch: (request) => {
        requests++;
        assert.equal(new URL(request.url).pathname, ServerRoute.Health);
        assert.equal(request.headers.get(HttpHeader.Authorization), LocalServer.Bearer + token);
        const response = probeResponse(mode);
        if (header) response.headers.set(HttpHeader.RuntimeBuild, header);
        return response;
      },
    });
    try {
      await probeAddress(home, mode, token, server.port ?? 0);
      const healthy = mode === DaemonProbeFixture.Healthy || mode === DaemonProbeFixture.Trailing;
      const inspect = () =>
        probeDaemon(home, DaemonStartup.ProbeMilliseconds, maintenance ? null : undefined, build);
      if (
        mode === DaemonProbeFixture.Older ||
        mode === DaemonProbeFixture.Newer ||
        (!maintenance && build && header !== build && header !== EmbeddedRuntimeBuild)
      )
        await assert.rejects(inspect(), {
          code: ErrorCode.ServerVersion,
        });
      else assert.equal(await inspect(), healthy);
      assert.equal(requests, mode === DaemonProbeFixture.Missing ? 0 : 1);
      return true;
    } finally {
      await server.stop(true);
    }
  });
}

async function probeAddress(home: string, mode: DaemonProbeFixture, token: string, port: number) {
  if (mode === DaemonProbeFixture.Missing) return;
  await writeFile(
    resolve(home, LocalServer.File),
    Buffer.from(
      JSON.stringify({
        url: localServerUrl(port) + (mode === DaemonProbeFixture.Trailing ? LocalServer.Root : ""),
        token,
        pid: process.pid,
      }),
    ),
  );
}

export function daemonEntryPath(source: string, compiled: boolean) {
  const entry = fileURLToPath(import.meta.resolve("../../apps/cli/src/main.ts"));
  assert.equal(daemonEntry(source), compiled ? resolve(dirname(entry), Packaging.Bundle) : entry);
  return true;
}

export async function runtimeBuildIdentity(mode: string) {
  return withTemporaryDirectory(async (folder) => {
    const source = mode === "source";
    const path = resolve(folder, source ? "main.ts" : "titan.js");
    const bytes = Buffer.from("installed runtime bytes");
    if (mode !== "missing" && !source) await writeFile(path, bytes);
    if (mode === "oversized") await truncate(path, Packaging.BundleMaximumBytes + 1);
    return (await runtimeBuild(path)) === (source ? null : hash(bytes));
  });
}

export async function installedDaemonBuild(cli: string, mode: DaemonBuildCase) {
  return withTemporaryDirectory(async (home) => {
    const bytes = await readFileBytes(cli, Packaging.BundleMaximumBytes);
    const same = mode === DaemonBuildCase.Same;
    const variant = resolve(dirname(cli), `titan-build-${newId()}.js`);
    if (!same)
      await writeFile(
        variant,
        mode === DaemonBuildCase.Legacy
          ? bytes.toString().replaceAll(HttpHeader.RuntimeBuild, "x-titan-legacy-build")
          : Buffer.concat([bytes, Buffer.from("\n")]),
      );
    const first = spawnServer(home, same ? cli : variant, SdkProcessFixture.DaemonTimeout);
    try {
      assert.ok(await waitUntil(() => serverReady(home, first.pid)));
      const result = await captureCli(cli, [
        CliCommand.Runs,
        ProbeOption.Home,
        home,
        CliRuntime.JsonFlag,
      ]);
      assert.equal(result.code, 0, result.error.toString());
      const selected = await readAddress(home);
      assert.equal(selected.pid === first.pid, same);
      const health = await fetch(new URL(ServerRoute.Health, selected.url), {
        headers: { [HttpHeader.Authorization]: LocalServer.Bearer + selected.token },
      });
      assert.equal(health.headers.get(HttpHeader.RuntimeBuild), hash(bytes));
      await health.body?.cancel();
      return true;
    } finally {
      await stopOwnedDaemon(home);
      await first.exited;
      if (!same) await rm(variant);
    }
  });
}
