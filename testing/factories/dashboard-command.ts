import { strict as assert } from "node:assert";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  CliCommand,
  CliRuntime,
  DaemonStartup,
  DashboardCommandFixture,
  DashboardCommandScenario,
  DashboardFixture,
  DashboardHeader,
  DashboardRoute,
  DashboardSession,
  ErrorCode,
  FileEncoding,
  HttpHeader,
  LocalServer,
  ProbeOption,
  ServerCredential,
  TaskOutcome,
} from "@titan/constants";
import { settle } from "@titan/core";
import { TitanError } from "@titan/errors";
import { DashboardMessage } from "@titan/messages";
import { startServer } from "@titan/server";
import { readAddress } from "@titan/server/client";
import { Dashboard } from "@titan/server/dashboard";
import { createDashboardClient } from "@titan/server/dashboard-client";
import { DashboardSessions } from "@titan/server/dashboard-session";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type DashboardClient,
  DashboardCommandOutputSchema,
  type DashboardSource,
} from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices, renderCommandOutput } from "../../apps/cli/src/bootstrap.ts";
import { probeDaemon } from "../../apps/cli/src/daemon.ts";
import { parseInvocation } from "../../apps/cli/src/parser.ts";
import { createFakeBackend } from "../support/backend.ts";
import { stopOwnedDaemon } from "../support/daemon.ts";

const code = (character: string): string => character.repeat(DashboardSession.CodeBytes * 2);

async function prepareHome(root: string, token: string): Promise<string> {
  const home = resolve(root, DashboardCommandFixture.HomeDirectory);
  await mkdir(home);
  await writeFile(resolve(home, ServerCredential.PersonFile), token, { mode: 0o600 });
  return home;
}

async function publish(home: string, origin: string): Promise<void> {
  await writeFile(
    resolve(home, LocalServer.File),
    JSON.stringify({ url: origin, token: DashboardCommandFixture.AgentToken, pid: process.pid }),
  );
}

async function loginFailure(home: string): Promise<string> {
  const [outcome] = await settle([() => createDashboardClient(home).login()]);
  const reason = outcome?.status === TaskOutcome.Rejected ? outcome.reason : undefined;
  return failureCode(reason);
}

function failureCode(error: unknown): string {
  return error instanceof TitanError ? error.code : String(error);
}

function dashboardServer(clock: () => number) {
  const dashboard = new Dashboard({} as DashboardSource, new DashboardSessions(clock));
  return Bun.serve({
    hostname: LocalServer.Host,
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname !== DashboardRoute.Code) return dashboard.respond(request, url.origin);
      if (
        request.headers.get(HttpHeader.Authorization) !==
        LocalServer.Bearer + DashboardCommandFixture.Token
      )
        return Response.json(
          { code: ErrorCode.PermissionDenied, error: DashboardMessage.Person },
          { status: 403 },
        );
      const minted = dashboard.mint();
      return Response.json({ code: minted, url: DashboardMessage.LoginLink(url.origin, minted) });
    },
  });
}

async function visit(link: string): Promise<Response> {
  return fetch(link, { redirect: "manual" });
}

async function filesUnder(directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true, recursive: true }))
    if (entry.isFile()) found.push(resolve(entry.parentPath, entry.name));
  return found;
}

async function printed(
  home: string,
  extra: readonly string[],
  dashboard: (home: string) => DashboardClient = createDashboardClient,
): Promise<string[]> {
  const lines: string[] = [];
  const cli = createCli({
    ...defaultServices,
    dashboard,
    output: (value, json, context) =>
      renderCommandOutput(value, json, context, (line) => lines.push(line)),
  });
  await cli([CliCommand.Dashboard, ProbeOption.Home, home, ...extra]);
  return lines;
}

function refusal(args: string[]): string {
  try {
    parseInvocation(args);
    return DashboardCommandFixture.Nothing;
  } catch (error) {
    return failureCode(error);
  }
}

async function noLeak(root: string): Promise<string> {
  const home = resolve(root, DashboardCommandFixture.HomeDirectory);
  await mkdir(home);
  await mkdir(resolve(root, DashboardFixture.Project));
  await writeFile(resolve(home, "config.yaml"), "server:\n  logging:\n    level: debug\n");
  const diagnostics: string[] = [];
  const server = await startServer(home, createFakeBackend, {
    diagnosticSink: async (bytes) => {
      diagnostics.push(bytes.toString(FileEncoding.Utf8));
      return bytes.length;
    },
  });
  try {
    const lines = await printed(home, []);
    assert.equal(lines.length, 1);
    const link = lines[0] ?? "";
    assert.ok(DashboardCommandFixture.LinkPattern.test(link));
    const secret = new URL(link).searchParams.get(DashboardSession.CodeParameter) ?? "";
    const first = await visit(link);
    const cookie = (first.headers.get(DashboardHeader.SetCookie) ?? "").split(";")[0] ?? "";
    await fetch(server.address.url + DashboardRoute.Page, {
      headers: { [DashboardHeader.Cookie]: cookie },
    });
    await fetch(server.address.url + DashboardRoute.Runs, {
      headers: { [DashboardHeader.Cookie]: cookie },
    });
    const secrets = [secret, cookie.split(DashboardSession.CookieAssignment)[1] ?? ""];
    assert.ok(secrets.every((value) => value.length > 0));
    assert.ok(diagnostics.length > 0);
    const texts = [diagnostics.join("")];
    for (const file of await filesUnder(root))
      texts.push((await readFile(file)).toString("latin1"));
    return secrets.some((value) => texts.some((text) => text.includes(value)))
      ? DashboardCommandFixture.Leaked
      : DashboardCommandFixture.Clean;
  } finally {
    await server.stop();
  }
}

export async function dashboardCommand(
  scenario: DashboardCommandScenario,
  advance: number = DashboardCommandFixture.Elapsed,
): Promise<string> {
  if (scenario === DashboardCommandScenario.ExtraArgument)
    return refusal([CliCommand.Dashboard, DashboardCommandFixture.ExtraWord]);
  if (scenario === DashboardCommandScenario.WatchFlag)
    return refusal([CliCommand.Dashboard, DashboardCommandFixture.Watch]);
  return withTemporaryDirectory(async (root) => {
    if (scenario === DashboardCommandScenario.NoLeak) return noLeak(root);
    if (scenario === DashboardCommandScenario.StartsServer) {
      const home = resolve(root, DashboardCommandFixture.HomeDirectory);
      try {
        const lines = await printed(home, [], defaultServices.dashboard);
        const link = lines[0] ?? "";
        assert.equal(lines.length, 1);
        assert.ok(DashboardCommandFixture.LinkPattern.test(link));
        assert.equal(new URL(link).origin, new URL((await readAddress(home)).url).origin);
        assert.ok(await probeDaemon(home, DaemonStartup.ProbeMilliseconds));
        return `${DashboardCommandFixture.Started} ${(await visit(link)).status}`;
      } finally {
        await stopOwnedDaemon(home);
      }
    }
    if (scenario === DashboardCommandScenario.MismatchedUrl) {
      const real = code("d");
      const fake = Bun.serve({
        hostname: LocalServer.Host,
        port: 0,
        fetch: () =>
          Response.json({
            code: real,
            url: DashboardMessage.LoginLink(DashboardCommandFixture.OtherOrigin, real),
          }),
      });
      try {
        const home = await prepareHome(root, DashboardCommandFixture.Token);
        await publish(home, fake.url.origin);
        return await loginFailure(home);
      } finally {
        await fake.stop(true);
      }
    }
    if (scenario === DashboardCommandScenario.StaleAddress) {
      const dead = dashboardServer(Date.now);
      const origin = dead.url.origin;
      await dead.stop(true);
      const home = await prepareHome(root, DashboardCommandFixture.Token);
      await publish(home, origin);
      return await loginFailure(home);
    }
    let now = 0;
    const server = dashboardServer(() => now);
    try {
      const token =
        scenario === DashboardCommandScenario.WrongPersonToken
          ? DashboardCommandFixture.WrongToken
          : DashboardCommandFixture.Token;
      const home = await prepareHome(root, token);
      await publish(home, server.url.origin);
      if (scenario === DashboardCommandScenario.WrongPersonToken) return await loginFailure(home);
      if (scenario === DashboardCommandScenario.TextLine) {
        const lines = await printed(home, []);
        return `${lines.length} ${DashboardCommandFixture.LinkPattern.test(lines[0] ?? "")}`;
      }
      if (scenario === DashboardCommandScenario.JsonObject) {
        const lines = await printed(home, [CliRuntime.JsonFlag]);
        const envelope = DashboardCommandOutputSchema.parse(JSON.parse(lines[0] ?? "null"));
        return [
          lines.length,
          envelope.operation,
          Object.keys(envelope.data).join(","),
          DashboardCommandFixture.LinkPattern.test(envelope.data.link),
        ].join(" ");
      }
      const { link } = await createDashboardClient(home).login();
      now += advance;
      const first = await visit(link);
      const second = await visit(link);
      return `${first.status} ${second.status}`;
    } finally {
      await server.stop(true);
    }
  });
}
