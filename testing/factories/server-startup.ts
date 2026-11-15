import { strict as assert } from "node:assert";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  ApiCredential,
  Backend,
  BoardFile,
  CookieCredential,
  DashboardHeader,
  DashboardRoute,
  FileEncoding,
  HttpHeader,
  HttpMethod,
  HttpOriginHeader,
  LocalServer,
  RunStatus,
  ServerCredential,
  ServerHolder,
  ServerRestartCheck,
  ServerRoute,
  ServerSecondCheck,
  ServerStartCheck,
  ServerStartupFixture,
  ServerTokenCheck,
  ServerTornCheck,
  ServerTornVerdict,
  ServerTornWorkflow,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { Engine } from "@titan/runner";
import { call, readAddress, startServer } from "@titan/server";
import { createDashboardClient } from "@titan/server/dashboard-client";
import { thrownBy, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  AddressSchema,
  type RunSnapshot,
  RunSnapshotSchema,
  type ServerHandle,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { createFakeBackend, schemaFakeAnswer } from "../support/backend.ts";
import { checkedWorkflow } from "./hardening.ts";

export async function running<T>(
  body: (home: string, server: ServerHandle, project: string) => Promise<T>,
): Promise<T> {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, ServerStartupFixture.Home);
    const project = resolve(root, ServerStartupFixture.Project);
    await mkdir(project);
    const server = await startServer(home, createFakeBackend, { runtimeBuild: "installed-build" });
    try {
      return await body(home, server, project);
    } finally {
      await server.stop();
    }
  });
}

export const bearer = (token: string): string => LocalServer.Bearer + token;

async function personOf(home: string): Promise<string> {
  return (await readFile(resolve(home, ServerCredential.PersonFile))).toString(FileEncoding.Utf8);
}

async function statusOf(
  url: URL,
  headers: Record<string, string>,
  method: string = HttpMethod.Get,
): Promise<number> {
  return (await fetch(url, { method, headers, redirect: "manual" })).status;
}

async function health(server: ServerHandle): Promise<number> {
  return statusOf(new URL(ServerRoute.Health, server.address.url), {
    [HttpHeader.Authorization]: bearer(server.address.token),
  });
}

async function submitted(home: string, project: string): Promise<RunSnapshot> {
  const run = RunSnapshotSchema.parse(
    await call(home, LocalServer.Runs, HttpMethod.Post, {
      project,
      workflow: checkedWorkflow(),
      backend: Backend.Fake,
      client_id: ServerStartupFixture.Client,
      submission_id: ServerStartupFixture.Submission,
    }),
  );
  const path = `${LocalServer.Runs}/${run.run_id}`;
  const passed = await waitUntil(
    async () => RunSnapshotSchema.parse(await call(home, path)).state === RunStatus.Passed,
  );
  assert.ok(passed);
  return RunSnapshotSchema.parse(await call(home, path));
}

export async function serverStarts(check: ServerStartCheck) {
  return running(async (home, server) => {
    const response = await fetch(new URL(ServerRoute.Health, server.address.url), {
      headers: { [HttpHeader.Authorization]: bearer(server.address.token) },
    });
    assert.equal(response.headers.get(HttpHeader.RuntimeBuild), "installed-build");
    await response.body?.cancel();
    const address = resolve(home, LocalServer.File);
    const person = resolve(home, ServerCredential.PersonFile);
    const modeOf = async (path: string): Promise<string> =>
      ((await stat(path)).mode & ServerStartupFixture.OwnerMask).toString(
        ServerStartupFixture.Octal,
      );
    if (check === ServerStartCheck.AddressMode) return modeOf(address);
    if (check === ServerStartCheck.PersonMode) return modeOf(person);
    if (check === ServerStartCheck.Content) {
      const stored = AddressSchema.parse(JSON.parse(await readFile(address, FileEncoding.Utf8)));
      return `${stored.url === server.address.url} ${stored.token === server.address.token}`;
    }
    if (check === ServerStartCheck.Loopback) return new URL(server.address.url).hostname;
    if (check === ServerStartCheck.GroupOther)
      return `${(await stat(address)).mode & ServerStartupFixture.GroupOtherMask} ${
        (await stat(person)).mode & ServerStartupFixture.GroupOtherMask
      }`;
    const target = new URL(server.address.url);
    target.hostname =
      check === ServerStartCheck.Ipv6
        ? ServerStartupFixture.Ipv6
        : ServerStartupFixture.OtherLoopback;
    return (await thrownBy(() => fetch(target))) === undefined
      ? ServerStartupFixture.Answered
      : ServerStartupFixture.Refused;
  });
}

export async function serverToken(check: ServerTokenCheck) {
  return running(async (home, server) => {
    const authorization: Record<ServerTokenCheck, string | undefined> = {
      [ServerTokenCheck.Agent]: bearer(server.address.token),
      [ServerTokenCheck.Person]: bearer(await personOf(home)),
      [ServerTokenCheck.None]: undefined,
      [ServerTokenCheck.Wrong]: bearer(ServerStartupFixture.WrongToken),
      [ServerTokenCheck.Bare]: server.address.token,
      [ServerTokenCheck.Short]: bearer(ServerStartupFixture.ShortToken),
    };
    const value = authorization[check];
    return statusOf(
      new URL(LocalServer.Runs, server.address.url),
      value === undefined ? {} : { [HttpHeader.Authorization]: value },
    );
  });
}

export async function serverOrigin(holder: ServerHolder, origin: string) {
  return running(async (home, server) => {
    const token = holder === ServerHolder.Person ? await personOf(home) : server.address.token;
    const headers: Record<string, string> = { [HttpHeader.Authorization]: bearer(token) };
    if (origin !== ServerStartupFixture.NoOrigin) headers[HttpOriginHeader] = origin;
    return statusOf(new URL(LocalServer.Runs, server.address.url), headers);
  });
}

async function contend(home: string): Promise<void> {
  const second = await startServer(home, createFakeBackend);
  await second.stop();
}

export async function serverSecond(check: ServerSecondCheck) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, ServerStartupFixture.Home);
    const first = await startServer(home, createFakeBackend);
    try {
      if (check === ServerSecondCheck.Refused) return await contend(home);
      if (check === ServerSecondCheck.Dotted)
        return await contend(`${home}${ServerStartupFixture.Dotted}`);
      if (check === ServerSecondCheck.OtherHome) {
        const elsewhere = resolve(root, ServerStartupFixture.Other);
        const other = await startServer(elsewhere, createFakeBackend);
        try {
          return `${await health(first)} ${await health(other)}`;
        } finally {
          await other.stop();
        }
      }
      if (check === ServerSecondCheck.Preserved) {
        await thrownBy(() => contend(home));
        return `${await health(first)} ${(await readAddress(home)).token === first.address.token}`;
      }
      await first.stop();
      const next = await startServer(home, createFakeBackend);
      try {
        return `${await health(next)}`;
      } finally {
        await next.stop();
      }
    } finally {
      await first.stop();
    }
  });
}

export async function serverRestart(check: ServerRestartCheck) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, ServerStartupFixture.Home);
    const project = resolve(root, ServerStartupFixture.Project);
    await mkdir(project);
    await mkdir(resolve(root, ServerStartupFixture.Elsewhere));
    let agents = 0;
    const factory = () =>
      new FakeBackend(async (spec) => {
        agents++;
        return schemaFakeAnswer(spec);
      });
    const first = await startServer(home, factory);
    const { before, counted } = await (async () => {
      try {
        const kept = await submitted(home, project);
        return { before: kept, counted: agents };
      } finally {
        await first.stop();
      }
    })();
    const target =
      check === ServerRestartCheck.OtherHome ? resolve(root, ServerStartupFixture.Other) : home;
    const id =
      check === ServerRestartCheck.Missing ? ServerStartupFixture.MissingRun : before.run_id;
    let second: ServerHandle | undefined;
    try {
      second = await startServer(target, factory);
      const response = await fetch(new URL(`${LocalServer.Runs}/${id}`, second.address.url), {
        headers: { [HttpHeader.Authorization]: bearer(second.address.token) },
      });
      if (check === ServerRestartCheck.Missing || check === ServerRestartCheck.OtherHome)
        return response.status;
      const snapshot = RunSnapshotSchema.parse(await response.json());
      if (check === ServerRestartCheck.State) return snapshot.state;
      if (check === ServerRestartCheck.Agents) return agents === counted;
      if (check === ServerRestartCheck.Result)
        return snapshot.artifacts === before.artifacts && snapshot.artifacts !== null;
      const recorded = Reflect.get(snapshot, ServerStartupFixture.ProjectField);
      return `${recorded === Reflect.get(before, ServerStartupFixture.ProjectField)} ${
        recorded !== resolve(root, ServerStartupFixture.Elsewhere)
      }`;
    } finally {
      await second?.stop();
    }
  });
}

async function journalRun(root: string) {
  const home = resolve(root, ServerStartupFixture.Home);
  const project = resolve(root, ServerStartupFixture.Project);
  await mkdir(home);
  await mkdir(project);
  const config = await resolveConfig({ home, project });
  const plan = validateWorkflow(ServerTornWorkflow);
  const backend = new FakeBackend(async (spec) => ({
    json: spec.writable ? ServerStartupFixture.Answer : ServerTornVerdict,
  }));
  const engine = new Engine(() => backend, { max_active_agents: 2 });
  const run = await engine.create({
    project,
    plan,
    config,
    backend: Backend.Fake,
    client_id: ServerStartupFixture.Client,
    submission_id: ServerStartupFixture.Submission,
  });
  await engine.start(run.run_id);
  const journal = resolve(run.root, BoardFile.Journal);
  return { run, journal, text: await readFile(journal, FileEncoding.Utf8) };
}

export async function serverTorn(check: ServerTornCheck) {
  return withTemporaryDirectory(async (root) => {
    const { run, journal, text } = await journalRun(root);
    const lines = text.split(ServerStartupFixture.LineBreak);
    const last = lines.at(-2) ?? "";
    let mutated = text + ServerStartupFixture.Torn;
    if (check === ServerTornCheck.Partial)
      mutated = text + last.slice(0, Math.floor(last.length / 2));
    if (check === ServerTornCheck.Corrupt || check === ServerTornCheck.Unchanged)
      mutated = [lines[0], ServerStartupFixture.Garbage, ...lines.slice(1)].join(
        ServerStartupFixture.LineBreak,
      );
    if (check === ServerTornCheck.Reordered)
      mutated = [lines[1], lines[0], ...lines.slice(2)].join(ServerStartupFixture.LineBreak);
    if (check === ServerTornCheck.Empty) mutated = "";
    await writeFile(journal, mutated);
    const store = new RunStore(run.root);
    if (check === ServerTornCheck.Unchanged) {
      const error = await thrownBy(() => store.read());
      const code = error instanceof TitanError ? error.code : "";
      return `${code} ${(await readFile(journal, FileEncoding.Utf8)) === mutated}`;
    }
    const recovered = await store.read();
    const restored = (await readFile(journal, FileEncoding.Utf8)) === text;
    if (check === ServerTornCheck.State) return recovered.state;
    if (check === ServerTornCheck.Restored) return restored;
    if (check === ServerTornCheck.Replayed) return recovered.version === run.version;
    return `${recovered.state} ${restored}`;
  });
}

async function cookieOf(home: string): Promise<string> {
  const { link } = await createDashboardClient(home).login();
  const response = await fetch(link, { redirect: "manual" });
  return (response.headers.get(DashboardHeader.SetCookie) ?? "").split(";")[0] ?? "";
}

export async function dashboardApi(route: string, method: string, credential: ApiCredential) {
  return running(async (home, server) => {
    const cookie = await cookieOf(home);
    const headers: Record<string, string> = {};
    if (credential === ApiCredential.Cookie || credential === ApiCredential.CookieAgent)
      headers[DashboardHeader.Cookie] = cookie;
    if (credential === ApiCredential.CookieAgent || credential === ApiCredential.Agent)
      headers[HttpHeader.Authorization] = bearer(server.address.token);
    if (credential === ApiCredential.Person)
      headers[HttpHeader.Authorization] = bearer(await personOf(home));
    return statusOf(new URL(route, server.address.url), headers, method);
  });
}

export async function dashboardCookie(route: string, credential: CookieCredential) {
  return running(async (home, server, project) => {
    const run = await submitted(home, project);
    const headers: Record<string, string> = {};
    const cookie = await cookieOf(home);
    if (credential === CookieCredential.Cookie || credential === CookieCredential.Foreign)
      headers[DashboardHeader.Cookie] = cookie;
    if (credential === CookieCredential.Wrong)
      headers[DashboardHeader.Cookie] = ServerStartupFixture.WrongCookie;
    if (credential === CookieCredential.Agent)
      headers[HttpHeader.Authorization] = bearer(server.address.token);
    if (credential === CookieCredential.Person)
      headers[HttpHeader.Authorization] = bearer(await personOf(home));
    if (credential === CookieCredential.Foreign)
      headers[HttpOriginHeader] = ServerStartupFixture.Foreign;
    const path = route === DashboardRoute.RunPrefix ? route + run.run_id : route;
    const response = await fetch(new URL(path, server.address.url), { headers });
    return `${response.status} ${(await response.text()).includes(run.run_id)}`;
  });
}
