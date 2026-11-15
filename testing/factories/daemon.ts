import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ConfigFile,
  DaemonFixture,
  DaemonStartup,
  ExitCode,
  LocalServer,
  ProcessIo,
  ProcessSignal,
  ServerRoute,
  TestProcessFixture,
} from "@titan/constants";
import { all } from "@titan/core";
import { readAddress } from "@titan/server/client";
import { processExited, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type DaemonProcess, type DaemonStartupServices, ServerHealthSchema } from "@titan/types";
import { daemonStartupServices, ensureDaemon, probeDaemon } from "../../apps/cli/src/daemon.ts";

export async function aliasDaemonVersion(home: string, version: string) {
  const address = await readAddress(home);
  const proxy = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (request) => {
      const url = new URL(request.url);
      const response = await fetch(
        new Request(new URL(url.pathname + url.search, address.url), request),
      );
      if (url.pathname !== ServerRoute.Health) return response;
      const health = ServerHealthSchema.parse(await response.json());
      return Response.json({ ...health, version });
    },
  });
  await writeFile(
    resolve(home, LocalServer.File),
    JSON.stringify({ ...address, url: `http://127.0.0.1:${proxy.port}` }),
  );
  return proxy;
}

export async function daemonStartup(mode: DaemonFixture) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const children: DaemonProcess[] = [];
    const services = {
      ...daemonStartupServices,
      launch: (home: string) => {
        assert.ok(children.length < 2);
        const child = daemonStartupServices.launch(home);
        children.push(child);
        return child;
      },
    } satisfies DaemonStartupServices;
    try {
      return await exerciseDaemon(home, mode, services, children);
    } finally {
      await stopDaemonChildren(children);
    }
  });
}

async function exerciseDaemon(
  home: string,
  mode: DaemonFixture,
  services: DaemonStartupServices,
  children: DaemonProcess[],
) {
  if (mode === DaemonFixture.Stale) {
    await mkdir(home);
    await writeFile(resolve(home, LocalServer.File), Buffer.from("{"));
  }
  if (mode === DaemonFixture.Zero || mode === DaemonFixture.Excess) {
    await mkdir(home);
    const value = mode === DaemonFixture.Zero ? 0 : DaemonStartup.TimeoutMilliseconds + 1;
    await writeFile(
      resolve(home, ConfigFile.User),
      Buffer.from(Bun.YAML.stringify({ server: { startup_timeout_ms: value } })),
    );
    await assert.rejects(ensureDaemon(home, services));
    assert.equal(children.length, 0);
    return true;
  }
  if (
    [
      DaemonFixture.Timeout,
      DaemonFixture.Exited,
      DaemonFixture.ExpiredProbe,
      DaemonFixture.LaunchError,
    ].includes(mode)
  )
    return rejectedDaemon(home, mode, children);
  if (mode === DaemonFixture.Concurrent)
    await all([() => ensureDaemon(home, services), () => ensureDaemon(home, services)]);
  else await ensureDaemon(home, services);
  const first = await readAddress(home);
  assert.ok(children.some((child) => child.pid === first.pid));
  assert.ok(await probeDaemon(home, DaemonStartup.ProbeMilliseconds));
  if (mode === DaemonFixture.Reuse) {
    await ensureDaemon(home, services);
    assert.equal((await readAddress(home)).pid, first.pid);
    assert.equal(children.length, 1);
  }
  assert.ok(
    mode === DaemonFixture.Concurrent
      ? children.length >= 1 && children.length <= 2
      : children.length === 1,
  );
  assert.ok(
    await waitUntil(async () =>
      children.every((child) => child.pid === first.pid || child.exitCode !== null),
    ),
  );
  return true;
}

async function rejectedDaemon(home: string, mode: DaemonFixture, children: DaemonProcess[]) {
  let clock = 0;
  const services: DaemonStartupServices = {
    now: () => clock,
    wait: async (milliseconds) => {
      clock += milliseconds;
    },
    probe: async () => {
      if (mode === DaemonFixture.Exited && children[0]) await children[0].exited;
      if (mode === DaemonFixture.ExpiredProbe || children.length)
        clock += DaemonStartup.TimeoutMilliseconds;
      return false;
    },
    launch: () => {
      if (mode === DaemonFixture.LaunchError) throw new Error("Launch refused");
      const child = Bun.spawn(
        [
          process.execPath,
          TestProcessFixture.Eval,
          mode === DaemonFixture.Exited ? TestProcessFixture.ExitScript : TestProcessFixture.Script,
          String(TestProcessFixture.HeldMilliseconds),
        ],
        { stdin: ProcessIo.Ignore, stdout: ProcessIo.Ignore, stderr: ProcessIo.Ignore },
      );
      children.push(child);
      return child;
    },
  };
  await assert.rejects(ensureDaemon(home, services), { exitCode: ExitCode.Transport });
  assert.equal(
    children.length,
    mode === DaemonFixture.ExpiredProbe || mode === DaemonFixture.LaunchError ? 0 : 1,
  );
  if (mode === DaemonFixture.Timeout) assert.equal(children[0]?.signalCode, ProcessSignal.Kill);
  const exited = await all(children.map((child) => () => processExited(child.pid)));
  assert.ok(exited.every(Boolean));
  return true;
}

async function stopDaemonChildren(children: DaemonProcess[]): Promise<void> {
  for (const child of children) {
    if (child.exitCode === null) child.kill(ProcessSignal.Kill);
    await child.exited;
  }
}
