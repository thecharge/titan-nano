import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import {
  ApprovalLevel,
  RequestDecision,
  RequestFormat,
  RequestKind,
  RequestLimit,
  RequestPageFixture,
  RequestPageFormat,
  RequestPageLimit,
  RequestState,
  RequestVersion,
  ServerSql,
  ServerState,
} from "@titan/constants";
import { listRequests } from "@titan/server/request-pages";
import { jsonByteLength } from "@titan/streams";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type OperationRequest,
  OperationRequestSchema,
  type RequestListQueryInput,
  type RequestListRun,
  RequestPageSchema,
  type RequestPageSource,
} from "@titan/types";

export function requestPageRecord(runId: string, requestId: string): OperationRequest {
  const content_hashes = {};
  return OperationRequestSchema.parse({
    schema_version: RequestFormat.Legacy,
    run_id: runId,
    request_id: requestId,
    kind: RequestKind.Tool,
    scope: {
      operation: "read",
      resource: "candidate",
      content_hashes,
      arguments: [],
      environment_names: [],
    },
    origin: { client_id: "codex", harness_session_id: "session-a" },
    expires_at: 2000,
    created_at: 1000,
    version: RequestVersion.Open,
    level: ApprovalLevel.Main,
    answer: null,
  });
}

export async function requestPages(mode: RequestPageFixture) {
  const inspect = async (directory: string) => {
    let db = new Bun.SQL({
      adapter: "sqlite",
      filename: resolve(directory, "catalog.db"),
      strict: true,
    });
    try {
      for (const statement of ServerSql.Initialize) await db.unsafe(statement);
      const stored = new Map<string, RequestListRun>();
      const count = mode === RequestPageFixture.Scan ? RequestPageLimit.Runs + 2 : 2;
      const seedRun = async (index: number): Promise<void> => {
        const id = `run-${index}`;
        await db.unsafe(ServerSql.Insert, [id, resolve(directory, id), "submitter", id, "hash"]);
        const requests = [requestPageRecord(id, "one"), requestPageRecord(id, "two")];
        if (
          [RequestPageFixture.EscalatedWaiting, RequestPageFixture.EscalatedAnswered].includes(mode)
        ) {
          const request = requests[0];
          assert.ok(request);
          request.level = ApprovalLevel.Human;
          request.version = RequestVersion.Escalated;
          request.escalation = {
            actor: { client_id: "main", authority: ApprovalLevel.Main },
            reason: "Passed up",
            escalated_at: 1200,
          };
          if (mode === RequestPageFixture.EscalatedAnswered) {
            request.version = RequestVersion.EscalatedAnswered;
            request.answer = {
              actor: { client_id: "person", authority: ApprovalLevel.Human },
              reason: "Reviewed",
              decision: RequestDecision.Approve,
              decided_at: 1500,
            };
          }
        }
        if (mode === RequestPageFixture.Scan && index >= 2)
          for (const request of requests) request.origin.client_id = "other";
        if (mode === RequestPageFixture.Bytes) {
          for (const request of requests) {
            request.scope.arguments = Array.from({ length: 24 }, () => "\0".repeat(2800));
            assert.ok(jsonByteLength(request, RequestLimit.InputBytes) <= RequestLimit.InputBytes);
          }
        }
        stored.set(id, {
          project_path: resolve(directory, index % 2 ? "second" : "first"),
          requests,
        });
      };
      for (let index = 0; index < count; index++) await seedRun(index);
      let reads = 0;
      const source: RequestPageSource = {
        database: db,
        read: async (row) => {
          reads++;
          const run = stored.get(row.id);
          assert.ok(run);
          if (row.id === "run-1" && mode === RequestPageFixture.Unavailable)
            throw new Error("unreadable journal");
          if (row.id === "run-1" && mode === RequestPageFixture.WrongRun)
            run.requests[0] = requestPageRecord("other", "one");
          if (row.id === "run-1" && mode === RequestPageFixture.Capacity)
            run.requests = Array.from({ length: RequestLimit.PerRun + 1 }, (_, index) =>
              requestPageRecord(row.id, `request-${index}`),
            );
          if (row.id === "run-1" && mode === RequestPageFixture.OversizedRecord) {
            const request = run.requests[0];
            assert.ok(request);
            request.scope.arguments = Array.from({ length: 32 }, () => "\0".repeat(2800));
          }
          if (row.id === "run-1" && mode === RequestPageFixture.BadProject)
            run.project_path = "x".repeat(RequestPageLimit.ProjectCharacters + 1);
          return run;
        },
      };
      const query: RequestListQueryInput = {};
      if (
        [
          RequestPageFixture.Count,
          RequestPageFixture.Restart,
          RequestPageFixture.ChangedCount,
          RequestPageFixture.ChangedFilter,
          RequestPageFixture.MissingCursorRun,
          RequestPageFixture.MissingCursorRequest,
        ].includes(mode)
      )
        query.limit = 1;
      if (mode === RequestPageFixture.Scan) query.client_id = "codex";
      if (mode === RequestPageFixture.EscalatedWaiting) query.state = RequestState.Waiting;
      if (mode === RequestPageFixture.EscalatedAnswered) query.state = RequestState.Answered;
      if (mode === RequestPageFixture.SingleRun) query.run_id = "run-0";
      if (mode === RequestPageFixture.Filters)
        Object.assign(query, {
          run_id: "run-0",
          client_id: "codex",
          harness_session_id: "session-a",
          project_path: resolve(directory, "first"),
        });
      if (mode === RequestPageFixture.BadLimit) query.limit = 0;
      if (mode === RequestPageFixture.BadCursor) query.cursor = "not-a-cursor";
      if (mode === RequestPageFixture.UnknownQuery) Reflect.set(query, "unexpected", true);
      const first = await listRequests(source, query);
      assert.deepEqual(RequestPageSchema.parse(first), first);
      assert.ok(jsonByteLength(first, RequestPageLimit.Bytes) <= RequestPageLimit.Bytes);
      if (
        [
          RequestPageFixture.Unavailable,
          RequestPageFixture.WrongRun,
          RequestPageFixture.Capacity,
          RequestPageFixture.OversizedRecord,
          RequestPageFixture.BadProject,
        ].includes(mode)
      ) {
        assert.deepEqual(first.unavailable, [
          { run_id: "run-1", client_id: "submitter", state: ServerState.ReadUnavailable },
        ]);
        assert.deepEqual(
          first.requests.map((item) => item.request.run_id),
          ["run-0", "run-0"],
        );
        return true;
      }
      const alterCursor = async (): Promise<void> => {
        assert.ok(first.next_cursor);
        const position = JSON.parse(
          Buffer.from(first.next_cursor, RequestPageFormat.CursorEncoding).toString(),
        );
        if (mode === RequestPageFixture.MissingCursorRun) position.run_id = "missing";
        if (mode === RequestPageFixture.MissingCursorRequest) position.after = "missing";
        await listRequests(source, {
          ...query,
          ...(mode === RequestPageFixture.ChangedFilter ? { client_id: "other" } : {}),
          cursor: Buffer.from(JSON.stringify(position)).toString(RequestPageFormat.CursorEncoding),
        });
      };
      if (
        [
          RequestPageFixture.ChangedFilter,
          RequestPageFixture.MissingCursorRun,
          RequestPageFixture.MissingCursorRequest,
        ].includes(mode)
      ) {
        await alterCursor();
        return true;
      }
      if (mode === RequestPageFixture.Scan) {
        assert.equal(first.requests.length, 0);
        assert.equal(first.has_more, true);
        assert.equal(reads, RequestPageLimit.Runs);
      }
      if (mode === RequestPageFixture.Bytes) {
        assert.equal(first.requests.length, 2);
        assert.equal(first.has_more, true);
      }
      if (mode === RequestPageFixture.Restart) {
        await db.close();
        db = new Bun.SQL({
          adapter: "sqlite",
          filename: resolve(directory, "catalog.db"),
          strict: true,
        });
        source.database = db;
        await db.unsafe(ServerSql.Insert, [
          "new-run",
          resolve(directory, "new-run"),
          "submitter",
          "new-run",
          "hash",
        ]);
        stored.set("new-run", {
          project_path: resolve(directory, "new"),
          requests: [requestPageRecord("new-run", "one")],
        });
      }
      const collected = [...first.requests];
      let page = first;
      let pages = 1;
      while (page.has_more) {
        assert.ok(pages <= count * 2);
        assert.ok(page.next_cursor);
        page = await listRequests(source, {
          ...query,
          ...(mode === RequestPageFixture.ChangedCount ? { limit: 2 } : {}),
          cursor: page.next_cursor,
        });
        collected.push(...page.requests);
        assert.ok(jsonByteLength(page, RequestPageLimit.Bytes) <= RequestPageLimit.Bytes);
        pages++;
      }
      const expected = [
        RequestPageFixture.SingleRun,
        RequestPageFixture.Filters,
        RequestPageFixture.EscalatedAnswered,
      ].includes(mode)
        ? 2
        : 4;
      assert.equal(collected.length, expected);
      if (
        [RequestPageFixture.EscalatedWaiting, RequestPageFixture.EscalatedAnswered].includes(mode)
      )
        assert.equal(collected.filter((item) => item.request.escalation !== undefined).length, 2);
      assert.equal(
        new Set(
          collected.map((item) => JSON.stringify([item.request.run_id, item.request.request_id])),
        ).size,
        expected,
      );
      if (mode === RequestPageFixture.Plain)
        assert.deepEqual(
          collected.map((item) => [item.request.run_id, item.request.request_id]),
          [
            ["run-1", "one"],
            ["run-1", "two"],
            ["run-0", "one"],
            ["run-0", "two"],
          ],
        );
      return true;
    } finally {
      await db.close();
    }
  };
  return withTemporaryDirectory(inspect);
}
