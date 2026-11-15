import { strict as assert } from "node:assert";
import { cp, mkdir, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { FakeBackend } from "@titan/backend-fake";
import { runtimeBuild } from "@titan/config";
import {
  Backend,
  ErrorCode,
  McpIdentity,
  Packaging,
  RunStatus,
  ServerCredential,
  SignalEvent,
  UpdateFile,
} from "@titan/constants";
import { RunRuntimeError, TitanError } from "@titan/errors";
import { call, startServer } from "@titan/server";
import { createClientTransport } from "@titan/server/client";
import { startMcp } from "@titan/server/mcp";
import { thrownBy, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { RunSchema } from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { daemonStartupServices, ensureDaemon } from "../../apps/cli/src/daemon.ts";
import { handoff } from "../../apps/cli/src/launch.ts";
import { outputEnvelope } from "../../apps/cli/src/output.ts";
import {
  recoverRunRuntime,
  recoverRuntimeConnection,
} from "../../apps/cli/src/runtime-recovery.ts";
import { createFakeBackend, schemaFakeAnswer } from "../support/backend.ts";
import { withClientAddress } from "../support/client.ts";
import { aliasDaemonVersion } from "./daemon.ts";
import { checkedWorkflow } from "./hardening.ts";
import { requestPageRecord } from "./request-pages.ts";
import { managedUpdate } from "./update-install.ts";

export async function runtimeRecovery(mode: string) {
  return withTemporaryDirectory(async (directory) => {
    const managed = await managedUpdate(directory);
    const release = join(managed.installation, "releases/titan-cli-retained");
    const entry = join(release, Packaging.InstalledPath, Packaging.Bundle);
    const rejectedProbe = join(directory, "rejected-runtime-started");
    const recordProbe = `await Bun.write(${JSON.stringify(rejectedProbe)}, "started");`;
    await mkdir(dirname(entry), { recursive: true });
    await writeFile(
      join(dirname(entry), "package.json"),
      JSON.stringify({ version: mode === "wrong-manifest" ? "0.8.0" : "0.9.0" }),
    );
    const output = outputEnvelope(
      { version: mode === "wrong-binary" ? "0.8.0" : "0.9.0" },
      { operation: "version" },
    );
    await writeFile(
      entry,
      mode === "invalid-binary"
        ? "invalid javascript"
        : [
            mode.startsWith("unknown-build") ? recordProbe : "",
            `console.log(${JSON.stringify(JSON.stringify(output))});`,
            mode.startsWith("changed-build")
              ? 'await Bun.write(import.meta.path, (await Bun.file(import.meta.path).text()) + "\\n");'
              : "",
          ].join("\n"),
    );
    if (
      ["duplicate", "ambiguous", "ambiguous-connection", "build", "build-connection"].includes(mode)
    ) {
      const duplicate = join(managed.installation, "releases/titan-cli-duplicate");
      await cp(release, duplicate, { recursive: true });
      if (mode !== "duplicate")
        await writeFile(
          join(duplicate, Packaging.InstalledPath, Packaging.Bundle),
          Buffer.concat([
            await readFile(entry),
            Buffer.from(mode.startsWith("build") ? recordProbe : "\n"),
          ]),
        );
    }
    if (mode === "missing" || mode === "missing-connection") await rm(release, { recursive: true });
    if (mode === "missing-entry") await rm(managed.entry);
    if (mode === "missing-launcher") await rm(managed.launcher);
    if (mode === "linked") {
      await rm(entry);
      const outside = join(directory, "outside.js");
      await writeFile(outside, `console.log(${JSON.stringify(JSON.stringify(output))});`);
      await symlink(outside, entry);
    }
    const requiredBuild = mode.startsWith("build")
      ? await runtimeBuild(entry)
      : mode.startsWith("unknown-build")
        ? "f".repeat(64)
        : undefined;
    const args = ["status", "retained-run", "--home", managed.home, "--json"];
    let handedOff = false;
    const services = {
      ...defaultServices,
      environment:
        mode === "pinned" || mode === "pinned-connection"
          ? { [UpdateFile.PinnedRuntime]: "1.0.0" }
          : {},
      executable:
        mode === "unmanaged"
          ? ([process.execPath, import.meta.path] as const)
          : ([process.execPath, managed.entry] as const),
      version: "1.0.0",
      cwd: () => managed.project,
      updateNotice: async () => null,
      client: (home: string) => ({
        ...defaultServices.client(home),
        get: async () => {
          throw new RunRuntimeError(
            "0.9.0",
            "retained runtime required",
            requiredBuild ?? undefined,
          );
        },
      }),
      handoff: async (
        selected: string,
        actual: readonly string[],
        project: string,
        version?: string,
      ) => {
        assert.deepEqual(await readFile(selected), await readFile(entry));
        assert.deepEqual(actual, args);
        assert.equal(project, managed.project);
        assert.equal(version, "0.9.0");
        handedOff = true;
        return 17;
      },
    };
    let entered = false;
    const factory =
      mode === "busy"
        ? () =>
            new FakeBackend(async (spec, _prompt, signal) => {
              entered = true;
              await new Promise<void>((done) =>
                signal.addEventListener(SignalEvent.Abort, () => done(), { once: true }),
              );
              return schemaFakeAnswer(spec);
            })
        : createFakeBackend;
    const server =
      mode === "idle" || mode === "idle-version" || mode === "idle-connection" || mode === "busy"
        ? await startServer(managed.home, factory)
        : null;
    const proxy = mode === "idle-version" ? await aliasDaemonVersion(managed.home, "0.9.0") : null;
    try {
      if (mode === "busy") {
        await call(managed.home, "/runs", "POST", {
          project: managed.project,
          workflow: checkedWorkflow(),
          backend: Backend.Fake,
          client_id: "runtime-client",
          submission_id: "runtime-active",
        });
        assert.ok(await waitUntil(async () => entered));
      }
      if (mode === "connection" || mode.endsWith("-connection")) {
        await using resources = new AsyncDisposableStack();
        const child = Bun.spawn([process.execPath, "--eval", "setTimeout(() => {}, 10000)"], {
          stdin: "ignore",
          stdout: "ignore",
          stderr: "ignore",
        });
        resources.defer(async () => {
          child.kill();
          await child.exited;
        });
        let launched = false;
        const expected =
          mode === "connection" || mode === "idle-connection" || mode === "build-connection";
        assert.equal(
          await recoverRuntimeConnection(
            managed.home,
            "0.9.0",
            services,
            {
              now: daemonStartupServices.now,
              wait: daemonStartupServices.wait,
              probe: async (_home, _timeout, version) => {
                assert.equal(version, "0.9.0");
                return launched;
              },
              launch: (_home, selected, version) => {
                assert.equal(selected, entry);
                assert.equal(version, "0.9.0");
                launched = true;
                return child;
              },
            },
            requiredBuild ?? undefined,
          ),
          expected,
        );
        assert.equal(launched, expected);
        if (server) await server.stopped;
      } else if (
        mode === "build" ||
        mode === "success" ||
        mode === "duplicate" ||
        mode === "idle" ||
        mode === "idle-version"
      ) {
        assert.equal(await createCli(services)(args), 17);
        assert.equal(handedOff, true);
        if (server) await server.stopped;
      } else if (mode === "busy") {
        await assert.rejects(() => createCli(services)(args), { code: "server_busy" });
        assert.ok(await call(managed.home, "/health"));
      } else {
        assert.equal(
          await recoverRunRuntime(
            {
              options: {},
              positionals: [],
              home: managed.home,
              project: managed.project,
              services,
              emit() {},
            },
            args,
            "0.9.0",
            requiredBuild ?? undefined,
          ),
          null,
        );
        await assert.rejects(() => createCli(services)(args), RunRuntimeError);
      }
      if (mode === "missing-launcher")
        await assert.rejects(readlink(managed.launcher), { code: "ENOENT" });
      else assert.equal(await readlink(managed.launcher), managed.previous);
      if (mode === "missing-entry")
        await assert.rejects(readFile(managed.entry), { code: "ENOENT" });
      else assert.equal((await readFile(managed.entry)).toString(), "original entry");
      if (mode.startsWith("build") || mode.startsWith("unknown-build"))
        await assert.rejects(readFile(rejectedProbe), { code: "ENOENT" });
      return true;
    } finally {
      await server?.stop();
      await proxy?.stop(true);
    }
  });
}

export async function runtimeHandoff(mode: string) {
  return withTemporaryDirectory(async (directory) => {
    const entry = join(directory, "entry.ts");
    const marker = join(directory, "observed.json");
    const version = mode === "pinned" ? "0.9.0" : undefined;
    await writeFile(
      entry,
      [
        'import {writeFile} from "node:fs/promises";',
        `await writeFile(${JSON.stringify(marker)}, JSON.stringify({args:process.argv.slice(2),cwd:process.cwd(),version:process.env.TITAN_PINNED_RUNTIME}));`,
        `process.exitCode = ${mode === "failed" ? 17 : 0};`,
      ].join("\n"),
    );
    const args = ["status", "identifier with spaces", "--json"];
    const exit = await handoff(
      mode === "missing" ? join(directory, "missing.ts") : entry,
      args,
      directory,
      version,
    );
    if (mode === "missing") assert.notEqual(exit, 0);
    else {
      assert.equal(exit, mode === "failed" ? 17 : 0);
      assert.deepEqual(JSON.parse((await readFile(marker)).toString()), {
        args,
        cwd: directory,
        ...(version ? { version } : {}),
      });
    }
    return true;
  });
}

export async function daemonRuntimeHandoff(mode: string) {
  return withTemporaryDirectory(async (directory) => {
    let launched = false;
    let stopped = false;
    let probed = false;
    const child = Bun.spawn([process.execPath, "--eval", "setTimeout(() => {}, 10000)"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    });
    const services = {
      now: daemonStartupServices.now,
      wait: daemonStartupServices.wait,
      probe: async () => {
        if (!probed) {
          probed = true;
          throw new TitanError(ErrorCode.ServerVersion, "another runtime owns this home");
        }
        return true;
      },
      ...(mode === "unavailable"
        ? {}
        : {
            stopIdle: async () => {
              if (mode === "busy") throw new TitanError(ErrorCode.ServerBusy, "active work");
              stopped = true;
            },
          }),
      launch: () => {
        assert.equal(stopped, true);
        launched = true;
        return child;
      },
    };
    try {
      if (mode === "older" || mode === "newer") {
        await ensureDaemon(directory, services);
        assert.equal(launched, true);
      } else {
        await assert.rejects(() => ensureDaemon(directory, services), {
          code: mode === "busy" ? ErrorCode.ServerBusy : ErrorCode.ServerVersion,
        });
        assert.equal(launched, false);
      }
      return true;
    } finally {
      child.kill();
      await child.exited;
    }
  });
}

export async function runtimeTransportRecovery(mode: string) {
  let requests = 0;
  let connections = 0;
  let recoveries = 0;
  const payload = { operation: "retained operation" };
  return withClientAddress(
    async (request) => {
      requests += 1;
      assert.equal(request.method, "POST");
      assert.deepEqual(await request.json(), payload);
      if (requests === 1 || mode === "repeated")
        return Response.json(
          {
            code: mode === "unrelated" ? ErrorCode.Arguments : ErrorCode.UnsupportedRunRuntime,
            error: "retained runtime required",
            required_runtime: "0.9.0",
            required_build: mode === "owner" ? "a".repeat(64) : undefined,
          },
          { status: 400 },
        );
      return Response.json({ ok: true });
    },
    async (home) => {
      if (mode === "owner")
        await writeFile(join(home, ServerCredential.PersonFile), "a".repeat(64), { mode: 0o600 });
      const recover =
        mode === "missing"
          ? undefined
          : async (version: string, build?: string) => {
              assert.equal(version, "0.9.0");
              assert.equal(build, mode === "owner" ? "a".repeat(64) : undefined);
              recoveries += 1;
              if (mode === "busy") throw new TitanError(ErrorCode.ServerBusy, "active work");
              return mode !== "refused";
            };
      const transport = createClientTransport(
        home,
        async () => {
          connections += 1;
        },
        mode === "owner",
        recover,
      );
      if (mode === "ordinary" || mode === "owner")
        assert.deepEqual(await transport("/retained", "POST", payload), { ok: true });
      else
        await assert.rejects(() => transport("/retained", "POST", payload), {
          code:
            mode === "unrelated"
              ? ErrorCode.Arguments
              : mode === "busy"
                ? ErrorCode.ServerBusy
                : ErrorCode.UnsupportedRunRuntime,
        });
      assert.equal(connections, 1);
      assert.equal(recoveries, mode === "unrelated" || mode === "missing" ? 0 : 1);
      assert.equal(
        requests,
        mode === "ordinary" || mode === "owner" || mode === "repeated" ? 2 : 1,
      );
      return true;
    },
  );
}

export async function runtimeMcpRecovery(mode: string) {
  let requests = 0;
  let recoveries = 0;
  let connections = 0;
  return withClientAddress(
    () => {
      requests += 1;
      if (requests === 1 || mode === "repeated" || mode === "refused")
        return Response.json(
          {
            code: ErrorCode.UnsupportedRunRuntime,
            error: "retained runtime required",
            required_runtime: "0.9.0",
          },
          { status: 400 },
        );
      return Response.json(
        mode === "request"
          ? requestPageRecord("retained", "permission")
          : {
              run_id: "retained",
              root: "/retained",
              state: RunStatus.Blocked,
              nodes: {},
              artifacts: null,
            },
      );
    },
    async (home) => {
      const [left, right] = InMemoryTransport.createLinkedPair();
      const server = await startMcp(
        home,
        left,
        async () => {
          connections += 1;
        },
        async (version) => {
          assert.equal(version, "0.9.0");
          recoveries += 1;
          return mode !== "refused";
        },
      );
      const client = new Client({ name: "runtime-recovery", version: "1" });
      try {
        await client.connect(right);
        const result = await client.callTool({
          name: mode === "request" ? McpIdentity.RequestRead : `${McpIdentity.Prefix}status`,
          arguments:
            mode === "request"
              ? { run_id: "retained", request_id: "permission" }
              : { run_id: "retained" },
        });
        assert.equal(
          result.isError === true,
          mode === "refused" || mode === "repeated",
          JSON.stringify(result),
        );
        assert.equal(connections, 1);
        assert.equal(recoveries, 1);
        assert.equal(requests, mode === "refused" ? 1 : 2);
        return true;
      } finally {
        await client.close();
        await server.close();
      }
    },
  );
}

export async function runtimeDefaultConnection(mode: string) {
  let probes = 0;
  let requests = 0;
  return withClientAddress(
    (request) => {
      if (new URL(request.url).pathname === "/health") {
        probes += 1;
        return Response.json({
          ready: true,
          version: McpIdentity.Version,
          diagnostics: { written: 0, filtered: 0, rejected: 0, failed: 0, disabled: true },
        });
      }
      requests += 1;
      if (mode.startsWith("missing-"))
        return Response.json(
          {
            code: ErrorCode.UnsupportedRunRuntime,
            error: "retained runtime required",
            required_runtime: "0.9.0",
          },
          { status: 400 },
        );
      return Response.json(
        mode === "request"
          ? requestPageRecord("retained", "permission")
          : {
              run_id: "retained",
              root: "/retained",
              state: RunStatus.Blocked,
              nodes: {},
              artifacts: null,
            },
      );
    },
    async (home) => {
      const operation = mode.endsWith("request")
        ? () => defaultServices.requests(home).get("retained", "permission")
        : () => defaultServices.client(home).get("retained");
      if (mode.startsWith("missing-")) await assert.rejects(operation, RunRuntimeError);
      else assert.equal((await operation()).run_id, "retained");
      assert.equal(probes, 1);
      assert.equal(requests, 1);
      return true;
    },
  );
}

export async function runtimeBuildServer(mode: string) {
  return withTemporaryDirectory(async (project) => {
    const home = join(project, "home");
    const build = "a".repeat(64);
    let server = await startServer(
      home,
      createFakeBackend,
      mode === "legacy" ? {} : { runtimeBuild: build },
    );
    try {
      const created = await call(home, "/runs", "POST", {
        project,
        workflow: checkedWorkflow(),
        backend: Backend.Fake,
        client_id: "build-owner",
        submission_id: "build-one",
      });
      const run = RunSchema.parse(created);
      assert.equal(run.runtime_build, mode === "legacy" ? undefined : build);
      assert(
        await waitUntil(
          async () =>
            RunSchema.parse(await call(home, `/runs/${run.run_id}`)).state === RunStatus.Passed,
        ),
      );
      await server.stop();
      const selected = mode === "matching" ? build : "b".repeat(64);
      server = await startServer(
        home,
        createFakeBackend,
        mode === "missing" ? {} : { runtimeBuild: selected },
      );
      if (mode === "matching" || mode === "legacy") {
        const recovered = RunSchema.parse(await call(home, `/runs/${run.run_id}`));
        assert.equal(recovered.runtime_build, run.runtime_build);
      } else {
        const failure = await thrownBy(() => call(home, `/runs/${run.run_id}`));
        assert(failure instanceof RunRuntimeError);
        assert.equal(failure.requiredBuild, build);
      }
      return true;
    } finally {
      await server.stop();
    }
  });
}
