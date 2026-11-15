import { strict as assert } from "node:assert";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  ApprovalLevel,
  Backend,
  ErrorCode,
  HttpMethod,
  HttpStatus,
  McpIdentity,
  RequestDecision,
  RequestKind,
  RequestPageSurface,
  RequestPageTransport,
  RequestState,
  RunStatus,
} from "@titan/constants";
import { call, readAddress, startServer } from "@titan/server";
import { startMcp } from "@titan/server/mcp";
import { createRequestClient } from "@titan/server/requests";
import { thrownBy, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  McpTextContentSchema,
  type RequestListQueryInput,
  RequestPageSchema,
  RunSnapshotSchema,
} from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { createFakeBackend } from "../support/backend.ts";
import { checkedWorkflow } from "./hardening.ts";

export async function requestPageSurface(
  transport: RequestPageTransport,
  mode: RequestPageSurface,
) {
  return withTemporaryDirectory(async (directory) => {
    const home = resolve(directory, "home");
    const projects = [resolve(directory, "one"), resolve(directory, "two")];
    for (const project of projects) await mkdir(project);
    const server = await startServer(home, () => createFakeBackend());
    const [left, right] = InMemoryTransport.createLinkedPair();
    const mcp = await startMcp(home, left);
    const client = new Client({ name: "request-page-fixture", version: "1" });
    try {
      await client.connect(right);
      const requests = createRequestClient(home);
      const runs: string[] = [];
      for (let index = 0; index < 4; index++) {
        const run = RunSnapshotSchema.parse(
          await call(home, "/runs", HttpMethod.Post, {
            project: projects[index % 2],
            workflow: checkedWorkflow(),
            backend: Backend.Fake,
            client_id: index < 2 ? "codex" : "claude",
            submission_id: `run-${index}`,
          }),
        );
        assert.ok(
          await waitUntil(
            async () =>
              RunSnapshotSchema.parse(await call(home, `/runs/${run.run_id}`)).state ===
              RunStatus.Passed,
          ),
        );
        runs.push(run.run_id);
        const request = await requests.open(run.run_id, {
          request_id: "permission",
          kind: RequestKind.Tool,
          scope: {
            operation: "read",
            resource: "candidate",
            content_hashes: {},
            arguments: [],
            environment_names: [],
          },
          origin: {
            client_id: index < 2 ? "codex" : "claude",
            harness_session_id: index < 2 ? "session-a" : "session-b",
          },
          expires_at: Date.now() + 60000,
        });
        if (mode === RequestPageSurface.Answered && index === 0)
          await requests.answer(
            {
              run_id: run.run_id,
              request_id: request.request_id,
              version: request.version,
              decision: RequestDecision.Approve,
              reason: "Reviewed",
              client_id: "reviewer",
            },
            ApprovalLevel.Main,
          );
      }
      const query: RequestListQueryInput = { limit: 1 };
      if (mode === RequestPageSurface.Sessions) query.harness_session_id = "session-a";
      if (mode === RequestPageSurface.Project)
        Object.assign(query, { client_id: "claude", project_path: projects[0] });
      if (mode === RequestPageSurface.Run) query.run_id = runs[1];
      if (mode === RequestPageSurface.Answered) query.state = RequestState.Answered;
      if (mode === RequestPageSurface.InvalidLimit) query.limit = 0;
      if (mode === RequestPageSurface.Unknown) Reflect.set(query, "unexpected", "value");
      const invalid = [
        RequestPageSurface.Unknown,
        RequestPageSurface.InvalidLimit,
        RequestPageSurface.Duplicate,
        RequestPageSurface.Method,
      ].includes(mode);
      const output: unknown[] = [];
      let accesses = 0;
      const cli = createCli({
        ...defaultServices,
        output: (value) => output.push(value),
        requests: (selected) => {
          accesses++;
          assert.equal(selected, home);
          return requests;
        },
      });
      const invoke = async (selection: RequestListQueryInput) => {
        if (transport === RequestPageTransport.Http) {
          const address = await readAddress(home);
          const search = new URLSearchParams(
            Object.entries(selection).map(([key, value]) => [key, String(value)]),
          );
          if (mode === RequestPageSurface.Duplicate) search.append("limit", "2");
          const response = await fetch(`${address.url}/requests?${search}`, {
            method: mode === RequestPageSurface.Method ? HttpMethod.Post : HttpMethod.Get,
            headers: { authorization: `Bearer ${address.token}` },
          });
          const value = await response.json();
          assert.equal(response.status, invalid ? HttpStatus.BadRequest : HttpStatus.Ok);
          if (invalid) {
            assert.equal(
              value.code,
              mode === RequestPageSurface.Method ? ErrorCode.Method : ErrorCode.Arguments,
            );
            return null;
          }
          return value;
        }
        if (transport === RequestPageTransport.Mcp) {
          const response = await client.callTool({
            name: McpIdentity.Requests,
            arguments: selection,
          });
          assert.equal(response.isError === true, invalid);
          return invalid
            ? null
            : JSON.parse(McpTextContentSchema.parse(response.content)[0]?.text ?? "");
        }
        output.length = 0;
        const args = [
          "requests",
          "--home",
          home,
          "--json",
          ...Object.entries(selection).flatMap(([key, value]) => [
            `--${key.replaceAll("_", "-")}`,
            String(value),
          ]),
        ];
        if (invalid) {
          const error = await thrownBy(() => cli(args));
          assert.equal(Reflect.get(Object(error), "code"), ErrorCode.Arguments);
          assert.equal(accesses, 0);
          assert.equal(output.length, 0);
          return null;
        }
        await cli(args);
        return output[0];
      };
      const selected: string[] = [];
      let cursor: string | undefined;
      let pages = 0;
      do {
        const value = await invoke({ ...query, ...(cursor === undefined ? {} : { cursor }) });
        if (invalid) {
          assert.equal(value, null);
          assert.equal((await requests.list()).requests.length, 4);
          return true;
        }
        const page = RequestPageSchema.parse(value);
        assert.equal(page.requests.length, 1);
        assert.deepEqual(page.unavailable, []);
        for (const item of page.requests) {
          selected.push(item.request.run_id);
          assert.equal(item.request.request_id, "permission");
          assert.ok(item.request.origin.harness_session_id);
          assert.ok(item.request.origin.client_id);
        }
        cursor = page.next_cursor ?? undefined;
        assert.ok(++pages <= 4);
      } while (cursor !== undefined);
      const expected =
        mode === RequestPageSurface.Sessions
          ? runs.slice(0, 2)
          : mode === RequestPageSurface.Project
            ? [runs[2]]
            : mode === RequestPageSurface.Run
              ? [runs[1]]
              : mode === RequestPageSurface.Answered
                ? [runs[0]]
                : runs;
      assert.deepEqual(selected.sort(), [...expected].sort());
      return true;
    } finally {
      await client.close();
      await mcp.close();
      await server.stop();
    }
  });
}
