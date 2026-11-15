import { strict as assert } from "node:assert";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  Backend,
  ErrorCode,
  EventInspectionTransport,
  McpIdentity,
  RunStatus,
  ServerDatabaseAdapter,
  ServerFile,
  ServerSql,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { startServer } from "@titan/server";
import { call, createRunClient, parseRunListSearch } from "@titan/server/client";
import { startMcp } from "@titan/server/mcp";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type CatalogAction,
  McpTextContentSchema,
  type RunListQueryInput,
  RunPageSchema,
  RunSchema,
} from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { createFakeBackend } from "../support/backend.ts";
import { withClientResponse } from "../support/client.ts";

async function insert(home: string, id: string, client: string): Promise<void> {
  const db = new Bun.SQL({
    adapter: ServerDatabaseAdapter,
    filename: resolve(home, ServerFile.Database),
    strict: true,
  });
  try {
    await db.unsafe(ServerSql.Insert, [
      id,
      resolve(home, "missing", id),
      client,
      id,
      "request-hash",
    ]);
  } finally {
    await db.close();
  }
}

async function withCatalog<T>(action: CatalogAction<T>): Promise<T> {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    let server = await startServer(home, createFakeBackend);
    try {
      for (let index = 1; index <= 5; index++)
        await insert(home, `run-${index}`, index % 2 ? "codex" : "claude");
      return await action(home, async () => {
        await server.stop();
        server = await startServer(home, createFakeBackend);
      });
    } finally {
      await server.stop();
    }
  });
}

async function inspect(
  transport: EventInspectionTransport,
  home: string,
  query: RunListQueryInput,
) {
  if (transport === EventInspectionTransport.Http)
    return RunPageSchema.parse(
      await call(
        home,
        `/runs?${new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]))}`,
      ),
    );
  if (transport === EventInspectionTransport.Cli) {
    const output: unknown[] = [];
    const main = createCli({ ...defaultServices, output: (value) => output.push(value) });
    await main([
      "runs",
      "--home",
      home,
      "--json",
      ...Object.entries(query).flatMap(([key, value]) => [
        `--${key.replaceAll("_", "-")}`,
        String(value),
      ]),
    ]);
    return RunPageSchema.parse(output[0]);
  }
  const [left, right] = InMemoryTransport.createLinkedPair();
  const server = await startMcp(home, left);
  const client = new Client({ name: "catalog-fixture", version: "1" });
  try {
    await client.connect(right);
    const answer = await client.callTool({ name: McpIdentity.Runs, arguments: query });
    if (answer.isError) throw new TitanError(ErrorCode.Arguments, "MCP refused catalog selectors");
    return RunPageSchema.parse(
      JSON.parse(McpTextContentSchema.parse(answer.content)[0]?.text ?? ""),
    );
  } finally {
    await client.close();
    await server.close();
  }
}

export async function catalogInspection(
  transport: EventInspectionTransport,
  limit: number,
  client_id?: string,
  reload = false,
) {
  return withCatalog(async (home, restart) => {
    const ids: string[] = [];
    const origins: string[] = [];
    let before = Number.MAX_SAFE_INTEGER;
    let pages = 0;
    while (pages < 6) {
      const query = { before, limit, ...(client_id === undefined ? {} : { client_id }) };
      const page = await inspect(transport, home, query);
      assert.deepEqual(page, await createRunClient(home).list(query));
      assert.ok(page.runs.length <= limit);
      ids.push(...page.runs.map((run) => run.run_id));
      origins.push(...page.runs.map((run) => run.client_id));
      before = page.next_before;
      pages++;
      if (pages === 1) {
        await insert(home, "run-new", client_id ?? "codex");
        if (reload) await restart();
      }
      if (!page.has_more) break;
    }
    assert.ok(pages < 6);
    const empty = await createRunClient(home).list({
      before,
      limit,
      ...(client_id === undefined ? {} : { client_id }),
    });
    assert.equal(empty.runs.length, 0);
    assert.equal(empty.has_more, false);
    assert.equal(empty.next_before, before);
    const newest = await createRunClient(home).list({ limit: 1 });
    assert.equal(newest.runs[0]?.run_id, "run-new");
    return { ids, origins, pages };
  });
}

export function catalogSearch(value: unknown) {
  return parseRunListSearch(value);
}

export async function catalogResponse(value: unknown, query: RunListQueryInput = {}) {
  return withClientResponse(
    Response.json(value),
    async (client) => (await client.list(query)).runs.length,
  );
}

export async function catalogQuery(search: string) {
  return withCatalog(
    async (home) => RunPageSchema.parse(await call(home, `/runs?${search}`)).runs.length,
  );
}

export async function catalogScope(
  transport: EventInspectionTransport,
  input: RunListQueryInput,
  reload = false,
) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const first = resolve(root, "first");
    const second = resolve(root, "second");
    await mkdir(first);
    await mkdir(second);
    let server = await startServer(home, createFakeBackend);
    const client = createRunClient(home);
    const ids: string[] = [];
    try {
      for (const [caller, session, project] of [
        ["codex", "session-one", first],
        ["claude", "session-one", second],
        ["codex", "session-two", first],
        ["codex", "session-one", first],
        ["codex", undefined, first],
      ] as const) {
        const run = await client.submit({
          project,
          workflow: vendorRecoveryWorkflow(),
          backend: Backend.Fake,
          client_id: caller,
          submission_id: String(ids.length),
          ...(session === undefined ? {} : { harness_session_id: session }),
        });
        ids.push(run.run_id);
        assert.ok(
          await waitUntil(async () => (await client.get(run.run_id)).state === RunStatus.Passed),
        );
      }
      const versions: number[] = [];
      for (const id of ids) versions.push(RunSchema.parse(await client.get(id)).version);
      const query = {
        ...input,
        ...(input.project_path === undefined
          ? {}
          : { project_path: resolve(root, input.project_path) }),
      };
      const observed: number[] = [];
      let before = Number.MAX_SAFE_INTEGER;
      let pages = 0;
      while (pages < 7) {
        const selection = { ...query, limit: 1, before };
        const page = await inspect(transport, home, selection);
        assert.deepEqual(page, await client.list(selection));
        assert.equal(page.schema_version, 2);
        observed.push(...page.runs.map((run) => ids.indexOf(run.run_id)));
        assert.ok(page.next_before < before);
        before = page.next_before;
        pages++;
        if (pages === 1) {
          await insert(home, "newer-unavailable", "codex");
          if (reload) {
            await server.stop();
            server = await startServer(home, createFakeBackend);
          }
        }
        if (!page.has_more) break;
      }
      assert.ok(pages < 7);
      const final = await client.list({ ...query, limit: 1, before });
      assert.equal(final.runs.length, 0);
      assert.equal(final.has_more, false);
      assert.equal(final.next_before, before);
      for (const [index, id] of ids.entries())
        assert.equal((await client.get(id)).version, versions[index]);
      assert.equal((await client.list()).runs.length, 6);
      return observed;
    } finally {
      await server.stop();
    }
  });
}
