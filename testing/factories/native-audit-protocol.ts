import { strict as assert } from "node:assert";
import {
  HttpHeader,
  HttpMethod,
  KnowledgeTool,
  LocalServer,
  NativeTool,
  NativeToolAudit,
  NativeToolOutcome,
  type NativeToolRole,
} from "@titan/constants";
import { newId } from "@titan/core";
import { KnowledgeHub } from "@titan/knowledge";
import { NativeToolAuthority } from "@titan/server/native-tools";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type NativeToolAuditRecord, NativeToolAuditSchema } from "@titan/types";
import { knowledgeAttemptScope } from "./knowledge-attempts.ts";

export function nativeAuditProtocol(role: NativeToolRole, malformed: boolean) {
  return withTemporaryDirectory(async (home) => {
    await using resources = new AsyncDisposableStack();
    const hub = await KnowledgeHub.open(home);
    resources.defer(() => hub.close());
    const records: NativeToolAuditRecord[] = [];
    const authority = new NativeToolAuthority(
      hub,
      { max_bindings: 1, max_pending_operations: 2 },
      async (_scope, record) => {
        records.push(NativeToolAuditSchema.parse(record));
      },
    );
    resources.defer(() => authority.close());
    const scope = { ...knowledgeAttemptScope(), execution_id: newId(), role };
    const lease = authority.open(scope, () => true);
    resources.defer(() => lease.close());
    const params = { name: KnowledgeTool.Get, arguments: { id: "not-an-entry-id" } };
    const response = await authority.respond(
      new Request(new URL(NativeTool.Route, "http://127.0.0.1"), {
        method: HttpMethod.Post,
        headers: {
          [HttpHeader.Authorization]: LocalServer.Bearer + lease.token,
          [HttpHeader.ContentType]: LocalServer.Json,
          accept: "application/json, text/event-stream",
        },
        body: malformed
          ? "{"
          : JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: NativeToolAudit.Method,
              params,
            }),
      }),
    );
    assert.equal(response.status, malformed ? 400 : 200);
    assert.equal(records.length, malformed ? 0 : 1);
    if (!malformed)
      assert.deepEqual(records[0], {
        tool: KnowledgeTool.Get,
        outcome: NativeToolOutcome.Refused,
        entry_ids: [],
      });
    lease.guard();
    return true;
  });
}
