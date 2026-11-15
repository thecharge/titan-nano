import { strict as assert } from "node:assert";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { RunStore, readEventPage } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  BoardLimit,
  ErrorCode,
  EventInspectionTransport,
  RunEventKind,
  RunStatus,
} from "@titan/constants";
import { Engine } from "@titan/runner";
import { startServer } from "@titan/server";
import { createRunClient, parseEventSearch } from "@titan/server/client";
import { startMcp } from "@titan/server/mcp";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  EventPageSchema,
  type EventQueryInput,
  McpTextContentSchema,
  RunSchema,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { createFakeBackend } from "../support/backend.ts";
import { withClientResponse } from "../support/client.ts";

export async function journalPage(sizes: number[], after: number, limit: number) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    await mkdir(project);
    const engine = new Engine(() => createFakeBackend());
    const run = await engine.create({
      project,
      plan: validateWorkflow(vendorRecoveryWorkflow()),
      config: await resolveConfig({ home: resolve(root, "home"), project }),
      backend: Backend.Fake,
      client_id: "event-fixture",
      submission_id: "one",
    });
    const store = new RunStore(run.root);
    await store.read();
    for (const size of sizes) await store.commit(run, "event-fixture", "x".repeat(size));
    const page = await readEventPage(
      store.events((await store.snapshot()).version),
      { after, limit },
      run.run_id,
    );
    assert.ok(Buffer.byteLength(JSON.stringify(page)) <= BoardLimit.EventPageBytes);
    assert.ok(page.events.every((event) => !Object.hasOwn(event, "state")));
    return {
      ids: page.events.map((event) => event.id),
      cursor: page.next_cursor,
      more: page.has_more,
    };
  });
}

export async function eventInspection(
  transport: EventInspectionTransport,
  limit: number,
  future: boolean,
  extraQuery = "",
) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(project);
    const http = await startServer(home, () => createFakeBackend());
    const api = createRunClient(home);
    const client = new Client({ name: "event-fixture", version: "1" });
    const [left, right] = InMemoryTransport.createLinkedPair();
    const mcp = await startMcp(home, left);
    try {
      await client.connect(right);
      const run = await api.submit({
        project,
        workflow: vendorRecoveryWorkflow(),
        backend: Backend.Fake,
        client_id: "events",
        submission_id: "one",
      });
      assert.ok(
        await waitUntil(async () => (await api.get(run.run_id)).state === RunStatus.Passed),
      );
      assert.ok(
        await waitUntil(
          async () => (await api.events(run.run_id)).events.at(-1)?.type === RunEventKind.Passed,
        ),
      );
      const latest = RunSchema.parse(await api.get(run.run_id)).version;
      const ids: number[] = [];
      let after = future ? latest + 1 : 0;
      let pages = 0;
      while (true) {
        const rejected = limit < 1 || future || Boolean(extraQuery);
        let value: unknown;
        if (transport === EventInspectionTransport.Http) {
          const response = await fetch(
            `${http.address.url}/runs/${run.run_id}/events?after=${after}&limit=${limit}${extraQuery}`,
            { headers: { authorization: `Bearer ${http.address.token}` } },
          );
          if (rejected) {
            assert.equal(response.status, future ? 409 : 400);
            assert.equal(
              Reflect.get(await response.json(), "code"),
              future ? ErrorCode.EventCursor : ErrorCode.Arguments,
            );
            return true;
          }
          assert.equal(response.status, 200);
          value = await response.json();
        } else if (transport === EventInspectionTransport.Cli) {
          const output: unknown[] = [];
          const main = createCli({ ...defaultServices, output: (value) => output.push(value) });
          const error = await thrownBy(async () => {
            assert.equal(
              await main([
                "events",
                run.run_id,
                "--home",
                home,
                "--after",
                String(after),
                "--limit",
                String(limit),
                "--json",
              ]),
              0,
            );
          });
          if (rejected) {
            assert.equal(
              Reflect.get(Object(error), "code"),
              future ? ErrorCode.EventCursor : ErrorCode.Arguments,
            );
            return true;
          }
          assert.equal(error, undefined);
          value = output[0];
        } else {
          const answer = await client.callTool({
            name: "titan_events",
            arguments: { run_id: run.run_id, after, limit },
          });
          if (rejected) {
            assert.equal(answer.isError, true);
            assert.ok(McpTextContentSchema.parse(answer.content)[0]?.text);
            return true;
          }
          assert.notEqual(answer.isError, true);
          value = JSON.parse(McpTextContentSchema.parse(answer.content)[0]?.text ?? "");
        }
        const page = EventPageSchema.parse(value);
        assert.equal(page.run_id, run.run_id);
        assert.equal(page.after, after);
        assert.ok(page.events.length <= limit);
        assert.ok(Buffer.byteLength(JSON.stringify(page)) <= BoardLimit.EventPageBytes);
        ids.push(...page.events.map((event) => event.id));
        after = page.next_cursor;
        assert.ok(++pages < 100);
        if (!page.has_more) break;
      }
      assert.deepEqual(
        ids,
        Array.from({ length: latest }, (_, index) => index + 1),
      );
      assert.equal(after, latest);
      return true;
    } finally {
      await client.close();
      await mcp.close();
      await http.stop();
    }
  });
}

export function eventSearch(value: unknown) {
  return parseEventSearch(value);
}

export async function eventResponse(value: unknown, query: EventQueryInput = {}) {
  await withClientResponse(Response.json(value), async (client) => {
    EventPageSchema.parse(await client.events("run", query));
  });
  return true;
}
