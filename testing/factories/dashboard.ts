import { strict as assert } from "node:assert";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import {
  Backend,
  DashboardFixture,
  DashboardHeader,
  DashboardPolicy,
  DashboardRoute,
  DashboardScenario,
  DashboardSession,
  DashboardUsageFixture,
  FileEncoding,
  HttpHeader,
  HttpMethod,
  HttpOriginHeader,
  LocalServer,
  RunStatus,
  ServerCredential,
} from "@titan/constants";
import { all } from "@titan/core";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { runNumbers } from "@titan/server/run-numbers";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type BackendFactory,
  type DashboardCodeBody,
  type DashboardRun,
  type DashboardRunList,
  type RunEventView,
  type RunNumbers,
  RunSchema,
  type ServerAddress,
} from "@titan/types";
import { schemaFakeAnswer } from "../support/backend.ts";

function usageBackend(fixture: DashboardUsageFixture): BackendFactory {
  let calls = 0;
  const answer: ConstructorParameters<typeof FakeBackend>[0] = async (spec) => {
    calls++;
    const cost =
      fixture === DashboardUsageFixture.Reported
        ? DashboardFixture.Cost
        : fixture === DashboardUsageFixture.Mixed && calls === 1
          ? DashboardFixture.MixedCost
          : null;
    return {
      ...(await schemaFakeAnswer(spec)),
      usage: {
        input_tokens: DashboardFixture.InputTokens,
        output_tokens: DashboardFixture.OutputTokens,
        cost_usd: cost,
      },
    };
  };
  return () => new FakeBackend(answer);
}

async function filesUnder(directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true, recursive: true }))
    if (entry.isFile()) found.push(resolve(entry.parentPath, entry.name));
  return found;
}

async function mint(address: ServerAddress, token: string): Promise<Response> {
  return fetch(address.url + DashboardRoute.Code, {
    method: HttpMethod.Post,
    headers: { [HttpHeader.Authorization]: DashboardFixture.Bearer + token },
  });
}

function cookieOf(response: Response): string {
  return (response.headers.get(DashboardHeader.SetCookie) ?? "").split(";")[0] ?? "";
}

async function visit(
  address: ServerAddress,
  code: string,
  headers: HeadersInit = {},
): Promise<Response> {
  return fetch(`${address.url}${DashboardRoute.Login}?${DashboardSession.CodeParameter}=${code}`, {
    redirect: "manual",
    headers,
  });
}

async function codeFor(address: ServerAddress, token: string): Promise<string> {
  const minted = await mint(address, token);
  assert.equal(minted.status, 200);
  return ((await minted.json()) as DashboardCodeBody).code;
}

export async function dashboardScenario(
  scenario: DashboardScenario,
  fixture: DashboardUsageFixture = DashboardUsageFixture.Reported,
): Promise<string> {
  async function observe(root: string): Promise<string> {
    const home = resolve(root, DashboardFixture.Home);
    const project = resolve(root, DashboardFixture.Project);
    await mkdir(home);
    await mkdir(project);
    await writeFile(resolve(home, "config.yaml"), "server:\n  logging:\n    level: debug\n");
    const diagnostics: string[] = [];
    const server = await startServer(home, usageBackend(fixture), {
      diagnosticSink: async (bytes) => {
        diagnostics.push(bytes.toString(FileEncoding.Utf8));
        return bytes.length;
      },
    });
    try {
      const address = server.address;
      const person = (
        await readFile(resolve(home, ServerCredential.PersonFile), FileEncoding.Utf8)
      ).trim();
      const client = createRunClient(home);
      const submitted = await client.submit({
        workflow: vendorRecoveryWorkflow(),
        project,
        backend: Backend.Fake,
        client_id: DashboardFixture.Client,
        submission_id: DashboardFixture.Submission,
        workflow_path: "workflow.yaml",
      });
      assert.ok(
        await waitUntil(
          async () => (await client.get(submitted.run_id)).state === RunStatus.Passed,
        ),
      );
      const runId = submitted.run_id;
      const code = await codeFor(address, person);
      const first = await visit(address, code);
      const cookie = cookieOf(first);
      const authorized = { [DashboardHeader.Cookie]: cookie };
      const get = (path: string, headers: HeadersInit = authorized) =>
        fetch(address.url + path, { headers });
      const runPath = `${DashboardRoute.RunPrefix}${runId}`;
      if (scenario === DashboardScenario.Login)
        return [
          first.status,
          first.headers.get(DashboardHeader.SetCookie)?.split("; ").slice(1).join("; "),
          first.headers.get(DashboardHeader.Location),
          first.headers.get(DashboardHeader.ReferrerPolicy),
          first.headers.get(DashboardHeader.CacheControl),
        ].join(" ");
      if (scenario === DashboardScenario.SecondLogin)
        return String((await visit(address, code)).status);
      if (scenario === DashboardScenario.WrongCode)
        return String((await visit(address, DashboardFixture.WrongCode)).status);
      if (scenario === DashboardScenario.NoCookie)
        return String((await get(DashboardRoute.Runs, {})).status);
      if (scenario === DashboardScenario.ForeignOrigin)
        return String(
          (
            await get(DashboardRoute.Runs, {
              ...authorized,
              [HttpOriginHeader]: DashboardFixture.ForeignOrigin,
            })
          ).status,
        );
      if (scenario === DashboardScenario.ListWithCookie) {
        const response = await get(DashboardRoute.Runs);
        const body = (await response.json()) as DashboardRunList;
        const listed = body.runs.find((entry) => entry.summary.run_id === runId);
        return `${response.status} ${listed?.summary.state}`;
      }
      if (scenario === DashboardScenario.PageHeaders) {
        const response = await get(DashboardRoute.Page);
        return `${response.status} ${response.headers.get(DashboardHeader.ContentSecurityPolicy)}`;
      }
      if (scenario === DashboardScenario.PageAssets) {
        const html = await (await get(DashboardRoute.Page)).text();
        const sources = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(
          (match) => match[1] ?? "",
        );
        const statuses: string[] = [];
        for (const source of sources) {
          assert.ok(source.startsWith("/") && !source.startsWith("//"), source);
          const asset = await get(source);
          statuses.push(
            `${asset.status}:${asset.headers.get(DashboardHeader.ContentSecurityPolicy) === DashboardPolicy.ContentSecurityPolicy}`,
          );
        }
        return sources.length >= 2 ? statuses.join(" ") : "no assets";
      }
      if (scenario === DashboardScenario.PostWithCookie) {
        const folder = RunSchema.parse(await client.get(runId)).root;
        const names = await filesUnder(folder);
        const before = await all(names.map((file) => () => readFile(file)));
        const response = await fetch(address.url + DashboardRoute.Runs, {
          method: HttpMethod.Post,
          headers: authorized,
        });
        const after = await all(names.map((file) => () => readFile(file)));
        const same =
          names.length === (await filesUnder(folder)).length &&
          before.every((bytes, index) => bytes.equals(after[index] ?? Buffer.alloc(0)));
        return `${response.status} ${same ? "unchanged" : "changed"}`;
      }
      if (scenario === DashboardScenario.CookieOnRuns)
        return String((await get(LocalServer.Runs)).status);
      if (scenario === DashboardScenario.CookieOnAnswer)
        return String(
          (
            await fetch(`${address.url}/requests/${DashboardFixture.RequestId}/answer`, {
              method: HttpMethod.Post,
              headers: authorized,
            })
          ).status,
        );
      if (scenario === DashboardScenario.AgentTokenOnDashboard)
        return String(
          (
            await get(DashboardRoute.Runs, {
              [HttpHeader.Authorization]: DashboardFixture.Bearer + address.token,
            })
          ).status,
        );
      if (scenario === DashboardScenario.PersonTokenOnDashboard)
        return String(
          (
            await get(DashboardRoute.Runs, {
              [HttpHeader.Authorization]: DashboardFixture.Bearer + person,
            })
          ).status,
        );
      if (scenario === DashboardScenario.AgentTokenMint)
        return String((await mint(address, address.token)).status);
      if (scenario === DashboardScenario.Numbers || scenario === DashboardScenario.Steps) {
        const page = (await (await get(runPath)).json()) as DashboardRun;
        if (scenario === DashboardScenario.Steps)
          return `${page.steps[0]?.id} ${page.steps[0]?.attempts[0]?.verdict} ${page.requests.length} ${page.answer_hint.includes("titan answer")}`;
        const usage = await client.usage(runId);
        const numbers = page.numbers;
        const overview = (await (await get(DashboardRoute.Runs)).json()) as DashboardRunList;
        assert.deepEqual(
          overview.runs.find((entry) => entry.summary.run_id === runId)?.numbers,
          numbers,
        );
        return [
          numbers.state,
          numbers.input_tokens.value,
          numbers.output_tokens.value,
          numbers.cost_usd.value,
          numbers.cost_usd.label,
          numbers.survived,
          numbers.attempts,
          usage.known.input_tokens === numbers.input_tokens.value,
          usage.known.cost_usd === (numbers.cost_usd.value ?? 0),
          usage.complete.cost_usd,
        ]
          .map(String)
          .join(" ");
      }
      if (scenario === DashboardScenario.Replay) {
        const response = await get(`${runPath}${DashboardRoute.EventsSuffix}`, {
          ...authorized,
          [DashboardHeader.LastEventId]: String(DashboardFixture.ReplayAfter),
        });
        const reader = response.body?.getReader();
        const chunk = await reader?.read();
        await reader?.cancel();
        return `${response.status} ${new TextDecoder().decode(chunk?.value).split("\n")[0]}`;
      }
      if (scenario === DashboardScenario.BadCursor)
        return String(
          (
            await get(`${runPath}${DashboardRoute.EventsSuffix}`, {
              ...authorized,
              [DashboardHeader.LastEventId]: DashboardFixture.BadCursor,
            })
          ).status,
        );
      if (scenario === DashboardScenario.UnknownRun)
        return String(
          (await get(`${DashboardRoute.RunPrefix}${DashboardFixture.UnknownRun}`)).status,
        );
      if (scenario === DashboardScenario.ProofCounts) {
        const events = (await client.events(runId)).events;
        const proof = (answer: string): RunEventView => ({
          id: events.length + 1,
          time: (events.at(-1)?.time ?? 0) + 1,
          type: "check_answered",
          data: { step_id: DashboardFixture.ProofStep, answer },
        });
        const numbers: RunNumbers = await runNumbers(
          RunSchema.parse(await client.get(runId)),
          await client.usage(runId),
          (async function* () {
            yield* events;
            yield proof("proven");
            yield proof("refuted");
            yield proof("not proven");
            yield proof("proven");
          })(),
        );
        return [numbers.proofs.proven, numbers.proofs.refuted, numbers.proofs.not_proven].join(" ");
      }
      await get(DashboardRoute.Page);
      await get(runPath);
      await get(DashboardRoute.Runs);
      const secrets = [code, cookie.split("=")[1] ?? ""];
      assert.ok(diagnostics.length > 0);
      const texts = [diagnostics.join("")];
      for (const file of await filesUnder(root))
        texts.push((await readFile(file)).toString("latin1"));
      return secrets.some(
        (secret) => secret.length > 0 && texts.some((text) => text.includes(secret)),
      )
        ? "leaked"
        : "clean";
    } finally {
      await server.stop();
    }
  }
  return withTemporaryDirectory(observe);
}
