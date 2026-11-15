import { Database } from "bun:sqlite";
import { strict as assert } from "node:assert";
import { mkdir, readFile, rename, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { basename, resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import { Backend, IoLimit, RunStatus, StepStatus } from "@titan/constants";
import { writeAll } from "@titan/core";
import { OperationalError } from "@titan/errors";
import { Engine } from "@titan/runner";
import { call, startServer } from "@titan/server";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { AgentSpec, FakeHandler } from "@titan/types";
import { RunIdentitySchema, RunPageSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { git, readTree, writeTree } from "@titan/workspace";
import { createFakeBackend } from "../support/backend.ts";
import { isolatedWorkspace } from "../support/isolated.ts";

export async function writeProgress(size: number, chunk: number) {
  const offsets: number[] = [];
  await writeAll(Buffer.alloc(size), async (_buffer, offset, remaining) => {
    offsets.push(offset);
    return chunk < 1 || chunk > size ? chunk : Math.min(chunk, remaining);
  });
  return offsets;
}
function clientResponse(mode: string): Response {
  if (mode === "empty") return new Response(null, { status: 204 });
  if (mode === "oversized-response")
    return Response.json({ value: "x".repeat(IoLimit.ResponseBytes) });
  if (mode === "unauthorized")
    return Response.json({ code: "unauthorized", error: "Denied" }, { status: 401 });
  if (mode === "invalid")
    return Response.json({ code: "bad_input", error: "Invalid" }, { status: 400 });
  return Response.json({ ready: true });
}

export async function clientAvailability(mode: string) {
  return withTemporaryDirectory(async (home) => {
    if (mode === "missing") return call(home, "/health");
    if (mode === "corrupt") {
      await writeFile(resolve(home, "server.json"), "{");
      return call(home, "/health");
    }
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: () => clientResponse(mode),
    });
    await writeFile(
      resolve(home, "server.json"),
      JSON.stringify({
        url: `http://127.0.0.1:${server.port}`,
        token: "x".repeat(64),
        pid: process.pid,
      }) + (mode === "oversized-address" ? " ".repeat(IoLimit.AddressBytes) : ""),
    );
    try {
      if (mode === "closed") await server.stop(true);
      return await call(home, "/health");
    } finally {
      await server.stop(true);
    }
  });
}
export async function workspaceSafety(mode: string) {
  return withTemporaryDirectory(async (root) => {
    const source = resolve(root, "source");
    const target = resolve(root, "target");
    await mkdir(source);
    await mkdir(target);
    await writeFile(resolve(source, "note.txt"), "checked content");
    const files = await readTree(source);
    if (mode === "socket") {
      const socket = createServer();
      await new Promise<void>((done) => {
        socket.listen(resolve(source, "service.sock"), done);
      });
      try {
        return await readTree(source);
      } finally {
        await new Promise<void>((done, fail) => {
          socket.close((error) => (error ? fail(error) : done()));
        });
      }
    }
    if (mode === "root-link") {
      const link = resolve(root, "link");
      await symlink(target, link);
      await writeTree(link, files);
    } else if (mode === "parent-link") {
      await symlink(source, resolve(target, "nested"));
      const entry = files["note.txt"];
      if (!entry) throw new Error("Fixture file missing");
      await writeTree(target, { "nested/note.txt": entry });
    } else {
      const entry = files["note.txt"];
      if (!entry) throw new Error("Fixture file missing");
      const path = mode === "nested" ? "nested/note.txt" : "note.txt";
      await writeTree(target, { [path]: entry });
      return (await readFile(resolve(target, path), "utf8")) === "checked content";
    }
    return false;
  });
}
export async function gitOutput(stream: string, size: number) {
  return withTemporaryDirectory(async (project) => {
    const text = await git(project, [
      "-c",
      `alias.fixture=!bun -e 'process.${stream}.write("x".repeat(${size}))'`,
      "fixture",
    ]);
    return text.length;
  });
}
export async function boardAvailability(id: string) {
  return withTemporaryDirectory(async (project) => {
    const store = RunStore.forRun(project, id);
    if (id === "missing") return store.read();
    if (id === "loop") {
      await mkdir(store.root, { recursive: true });
      await symlink("board.jsonl", resolve(store.root, "board.jsonl"));
      return store.read();
    }
    return basename(store.root);
  });
}
export const checkedWorkflow = () => ({
  name: "Hardening",
  goal: "Checked work",
  personas: {
    worker: { description: "Worker", role: "Solve" },
    checker: { description: "Checker", role: "Refute" },
  },
  steps: [
    {
      id: "one",
      do: { persona: "worker", task: "Solve" },
      falsify: [{ persona: "checker", task: "Refute" }],
    },
  ],
});
class CancelFailingBackend extends FakeBackend {
  constructor(handler: FakeHandler) {
    super(handler);
  }
  async start(spec: AgentSpec) {
    const session = await super.start(spec);
    return {
      ...session,
      async cancel(reason: string) {
        await session.cancel(reason);
        throw new Error("Cancellation transport already closed");
      },
    };
  }
}
export async function engineInterruption(mode: string) {
  return withTemporaryDirectory(async (project) => {
    const ready = Promise.withResolvers<void>();
    const parallel = mode.startsWith("parallel");
    let started = 0;
    const handler: FakeHandler = async (spec, _prompt, signal) => {
      started++;
      if (started === (parallel ? 2 : 1)) ready.resolve();
      if (mode.startsWith("backoff"))
        throw new OperationalError("throttle", "Temporary throttle", true, 10000);
      await new Promise<void>((_done, fail) => {
        if (signal.aborted) fail(signal.reason);
        else
          signal.addEventListener(
            "abort",
            () => {
              if (parallel && spec.invocation_id.startsWith("two/"))
                setTimeout(() => fail(signal.reason), 10);
              else fail(signal.reason);
            },
            { once: true },
          );
      });
      return { json: null };
    };
    const backend = new CancelFailingBackend(handler);
    const engine = new Engine(() => backend);
    const config = await resolveConfig({
      home: project,
      project,
      overrides: {
        ...isolatedWorkspace,
        limits: { max_minutes: mode === "deadline" ? 0.001 : null },
      },
    });
    const run = await engine.create({
      project,
      plan: validateWorkflow({
        ...checkedWorkflow(),
        steps: parallel
          ? [
              {
                parallel: [
                  checkedWorkflow().steps[0],
                  { ...checkedWorkflow().steps[0], id: "two" },
                ],
              },
            ]
          : checkedWorkflow().steps,
      }),
      config,
      backend: Backend.Fake,
      client_id: "test",
      submission_id: "one",
    });
    const active = engine.start(run.run_id);
    await ready.promise;
    if (mode.startsWith("backoff")) {
      const recovering = await waitUntil(async () =>
        (await engine.events(run.run_id)).events.some(
          (event) => event.type === "execution_recovering",
        ),
      );
      if (!recovering) throw new Error("Recovery did not enter backoff");
      await Bun.sleep(2);
    }
    if (mode.includes("pause")) await engine.pause(run.run_id);
    else if (mode.includes("cancel")) await engine.cancel(run.run_id);
    await active;
    return run.state;
  });
}
export async function serverProtocol(mode: string) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(project);
    const backend = createFakeBackend();
    const factory = () => backend;
    let server = await startServer(home, factory);
    try {
      if (mode === "lock") {
        try {
          await startServer(home, factory);
        } catch (error) {
          return error instanceof Error ? Reflect.get(error, "code") : "unexpected";
        }
      }
      if (mode === "incomplete") {
        const db = new Database(resolve(home, "runs.db"));
        try {
          db.query("INSERT INTO runs VALUES (?,?,?,?,?)").run(
            "incomplete",
            resolve(project, "missing"),
            "client",
            "submission",
            "hash",
          );
        } finally {
          db.close();
        }
        const rows = RunPageSchema.parse(await call(home, "/runs")).runs;
        return rows[0]?.state;
      }
      const headers = { authorization: `Bearer ${server.address.token}` };
      if (mode === "health")
        return (await fetch(`${server.address.url}/health`, { headers })).status;
      if (mode === "route")
        return (await fetch(`${server.address.url}/unknown`, { headers })).status;
      if (mode === "missing")
        return (await fetch(`${server.address.url}/runs/missing`, { headers })).status;
      const run = RunIdentitySchema.parse(
        await call(home, "/runs", "POST", {
          project,
          workflow: checkedWorkflow(),
          backend: "fake",
          client_id: "test",
          submission_id: "one",
        }),
      );
      let state = "running";
      const deadline = Date.now() + 2000;
      while (state === "running") {
        if (Date.now() > deadline) throw new Error("Run did not settle");
        await Bun.sleep(1);
        const value = await call(home, `/runs/${run.run_id}`);
        state = Reflect.get(Object(value), "state");
      }
      if (mode === "reload") {
        await server.stop();
        server = await startServer(home, factory);
        return (
          await fetch(`${server.address.url}/runs/${run.run_id}`, {
            headers: { authorization: `Bearer ${server.address.token}` },
          })
        ).status;
      }
      if (mode === "resume-failure") {
        const store = RunStore.forRun(project, run.run_id);
        const record = await store.read();
        record.state = RunStatus.Blocked;
        const node = record.nodes.one;
        if (!node) throw new Error("Missing node");
        node.state = StepStatus.Pending;
        await store.commit(record, "test_restart");
        await server.stop();
        server = await startServer(home, factory);
        await call(home, `/runs/${run.run_id}`);
        await rename(resolve(record.root, "board.jsonl"), resolve(record.root, "board.backup"));
        await mkdir(resolve(record.root, "board.jsonl"));
        const response = await fetch(`${server.address.url}/runs/${run.run_id}/resume`, {
          method: "POST",
          headers: { authorization: `Bearer ${server.address.token}` },
        });
        const observed = await fetch(`${server.address.url}/runs/${run.run_id}`, {
          headers: { authorization: `Bearer ${server.address.token}` },
        });
        if (observed.status !== response.status)
          throw new Error("Failed writer returned inconsistent status");
        const health = await fetch(`${server.address.url}/health`, {
          headers: { authorization: `Bearer ${server.address.token}` },
        });
        if (health.status !== 200) throw new Error("Writer failure stopped the server");
        return response.status;
      }
      return (
        await fetch(`${server.address.url}/runs/${run.run_id}`, { method: "DELETE", headers })
      ).status;
    } finally {
      await server.stop();
    }
  });
}

export async function residentRuns(extra: number, present: boolean, maximum = 2) {
  return withTemporaryDirectory(async (project) => {
    const config = await resolveConfig({ home: project, project, overrides: isolatedWorkspace });
    const plan = validateWorkflow(checkedWorkflow());
    const engine = new Engine(() => createFakeBackend(), { max_resident_runs: maximum });
    for (let index = 0; index < maximum + extra; index++)
      await engine.create({
        project,
        plan,
        config,
        backend: Backend.Fake,
        client_id: "fixture",
        submission_id: String(index),
        run_id: `run-${index}`,
      });
    assert.equal(engine.ids().length, maximum);
    for (let index = extra; index < maximum + extra; index++)
      assert.equal(engine.get(`run-${index}`).run_id, `run-${index}`);
    return engine.has(present ? `run-${maximum + extra - 1}` : "run-0");
  });
}
