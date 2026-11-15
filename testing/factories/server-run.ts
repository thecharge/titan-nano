import { strict as assert } from "node:assert";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { RunStore } from "@titan/board";
import {
  Backend,
  BoardFile,
  DashboardHeader,
  FileEncoding,
  HttpHeader,
  HttpMethod,
  LocalServer,
  RunEventKind,
  RunStatus,
  ServerKillCheck,
  ServerRoute,
  ServerRunCheck,
  ServerRunFixture,
  ServerStartupFixture,
  ServerStreamCheck,
} from "@titan/constants";
import { call, startServer } from "@titan/server";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type RunEvent,
  RunSchema,
  RunSnapshotSchema,
  type ServerHandle,
  StepRestartSchema,
} from "@titan/types";
import { createFakeBackend, schemaFakeAnswer } from "../support/backend.ts";
import { bearer, running } from "./server-startup.ts";

async function example(): Promise<unknown> {
  return Bun.YAML.parse(await readFile(resolve(ServerRunFixture.Example), FileEncoding.Utf8));
}

function submission(
  server: ServerHandle,
  project: string,
  workflow: unknown,
  token?: string,
): Promise<Response> {
  return fetch(new URL(LocalServer.Runs, server.address.url), {
    method: HttpMethod.Post,
    headers: {
      [HttpHeader.ContentType]: LocalServer.Json,
      ...(token === undefined ? {} : { [HttpHeader.Authorization]: bearer(token) }),
    },
    body: JSON.stringify({
      project,
      workflow,
      backend: Backend.Fake,
      client_id: ServerRunFixture.Client,
      submission_id: ServerRunFixture.Submission,
    }),
  });
}

export async function serverRun(check: ServerRunCheck) {
  return running(async (home, server, project) => {
    const response = await submission(
      server,
      project,
      check === ServerRunCheck.Invalid ? {} : await example(),
      check === ServerRunCheck.NoToken ? undefined : server.address.token,
    );
    if (check === ServerRunCheck.NoToken || check === ServerRunCheck.Invalid)
      return response.status;
    const started = RunSnapshotSchema.parse(await response.json());
    const shown = RunSnapshotSchema.parse(
      await call(home, `${LocalServer.Runs}/${started.run_id}`),
    );
    if (check === ServerRunCheck.RunId) return shown.run_id === started.run_id;
    return shown.state === RunStatus.Running || shown.state === RunStatus.Passed;
  });
}

async function frameIds(response: Response, done: (ids: number[]) => boolean): Promise<number[]> {
  assert.ok(response.body);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const ids: number[] = [];
  let buffer = "";
  try {
    while (!done(ids)) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const blocks = buffer.split(ServerRunFixture.FrameBoundary);
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        const match = ServerRunFixture.IdLine.exec(block);
        if (match?.[1]) ids.push(Number(match[1]));
      }
    }
  } finally {
    await reader.cancel();
  }
  return ids;
}

function openStream(
  server: ServerHandle,
  id: string,
  headers: Record<string, string>,
): Promise<Response> {
  return fetch(new URL(`${LocalServer.Runs}/${id}/${ServerRoute.Stream}`, server.address.url), {
    headers,
  });
}

export async function serverStream(check: ServerStreamCheck) {
  return running(async (home, server, project) => {
    const authorized = { [HttpHeader.Authorization]: bearer(server.address.token) };
    const started = RunSnapshotSchema.parse(
      await (await submission(server, project, await example(), server.address.token)).json(),
    );
    const path = `${LocalServer.Runs}/${started.run_id}`;
    if (check === ServerStreamCheck.NoToken)
      return (await openStream(server, started.run_id, {})).status;
    if (check === ServerStreamCheck.BadCursor)
      return (
        await openStream(server, started.run_id, {
          ...authorized,
          [DashboardHeader.LastEventId]: ServerRunFixture.BadCursor,
        })
      ).status;
    const seen = (
      await frameIds(
        await openStream(server, started.run_id, authorized),
        (ids) => ids.length >= ServerRunFixture.SeenEvents,
      )
    ).slice(0, ServerRunFixture.SeenEvents);
    const last = seen.at(-1) ?? 0;
    const passed = await waitUntil(
      async () => RunSnapshotSchema.parse(await call(home, path)).state === RunStatus.Passed,
    );
    assert.ok(passed);
    const final = RunSchema.parse(await call(home, path)).version;
    if (check === ServerStreamCheck.FutureCursor)
      return (
        await openStream(server, started.run_id, {
          ...authorized,
          [DashboardHeader.LastEventId]: String(final + ServerRunFixture.FutureOffset),
        })
      ).status;
    const later = await frameIds(
      await openStream(server, started.run_id, {
        ...authorized,
        [DashboardHeader.LastEventId]: String(last),
      }),
      (ids) => ids.includes(final),
    );
    if (check === ServerStreamCheck.Count) return later.length >= ServerRunFixture.MinimumLater;
    if (check === ServerStreamCheck.Duplicates)
      return new Set(later).size === later.length && later.every((id) => id > last);
    return later.length === final - last && later.every((id, index) => id === last + 1 + index);
  });
}

export async function serverKill(check: ServerKillCheck) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, ServerStartupFixture.Home);
    const project = resolve(root, ServerStartupFixture.Project);
    await mkdir(project);
    const reached = Promise.withResolvers<void>();
    const gate = Promise.withResolvers<void>();
    let writes = 0;
    const blocking = () =>
      new FakeBackend(async (spec) => {
        if (spec.writable && ++writes === ServerRunFixture.WriterCalls) {
          reached.resolve();
          await gate.promise;
        }
        return schemaFakeAnswer(spec);
      });
    const first = await startServer(home, blocking);
    const { before, path, journal, events } = await (async () => {
      try {
        const started = RunSnapshotSchema.parse(
          await (await submission(first, project, await example(), first.address.token)).json(),
        );
        await reached.promise;
        const route = `${LocalServer.Runs}/${started.run_id}`;
        const run = RunSchema.parse(await call(home, route));
        return {
          before: run,
          path: route,
          journal: await readFile(resolve(run.root, BoardFile.Journal)),
          events: await readFile(resolve(run.root, BoardFile.Events)),
        };
      } finally {
        gate.resolve();
        await first.stop();
      }
    })();
    await writeFile(resolve(before.root, BoardFile.Journal), journal);
    await writeFile(resolve(before.root, BoardFile.Events), events);
    const second = await startServer(home, createFakeBackend);
    try {
      const after = RunSchema.parse(await call(home, path));
      const log: RunEvent[] = [];
      for await (const event of new RunStore(after.root).events(after.version)) log.push(event);
      const restarts = log
        .filter((event) => event.type === RunEventKind.StepRestarted)
        .map((event) => StepRestartSchema.parse(event.data));
      const own = restarts.find((entry) => entry.step_id === ServerRunFixture.KilledStep);
      const attempt = before.nodes[ServerRunFixture.KilledStep]?.attempt ?? 0;
      if (check === ServerKillCheck.Steps)
        return (
          Object.keys(after.nodes).join() === Object.keys(before.nodes).join() &&
          after.plan.nodes.map((node) => node.id).join() ===
            before.plan.nodes.map((node) => node.id).join()
        );
      if (check === ServerKillCheck.Restarted) return own !== undefined;
      if (check === ServerKillCheck.Attempt) return own?.attempt === attempt;
      if (check === ServerKillCheck.NoRerun)
        return !log.some(
          (event) => event.id > before.version && event.type === RunEventKind.AttemptStarted,
        );
      if (check === ServerKillCheck.OtherStep)
        return restarts.some((entry) => entry.step_id === ServerRunFixture.EarlierStep);
      return (after.nodes[ServerRunFixture.KilledStep]?.attempt ?? 0) < attempt;
    } finally {
      await second.stop();
    }
  });
}
