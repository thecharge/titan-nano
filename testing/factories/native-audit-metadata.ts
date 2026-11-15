import { strict as assert } from "node:assert";
import {
  ErrorCode,
  KnowledgeKind,
  KnowledgeSearchMode,
  KnowledgeTool,
  NativeTool,
  NativeToolAudit,
  NativeToolOutcome,
  type NativeToolRole,
} from "@titan/constants";
import { newId } from "@titan/core";
import { errorMessage } from "@titan/errors";
import { KnowledgeHub } from "@titan/knowledge";
import { NativeToolAuthority } from "@titan/server/native-tools";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type NativeToolAuditRecord, NativeToolAuditSchema } from "@titan/types";
import { knowledgeDraft } from "./knowledge.ts";
import { knowledgeAttemptScope } from "./knowledge-attempts.ts";
import { connectNative, nativeValue } from "./native-tools.ts";

export function nativeAuditMetadata(role: NativeToolRole, fail: boolean) {
  return withTemporaryDirectory((home) => auditAtHome(home, role, fail));
}

async function auditAtHome(home: string, role: NativeToolRole, fail: boolean) {
  await using resources = new AsyncDisposableStack();
  const hub = await KnowledgeHub.open(home);
  resources.defer(() => hub.close());
  const first = await hub.add(knowledgeDraft(KnowledgeKind.Fact));
  const second = await hub.add(knowledgeDraft(KnowledgeKind.Fact));
  const scope = { ...knowledgeAttemptScope(), execution_id: newId(), role };
  const entered = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  const records: NativeToolAuditRecord[] = [];
  const authority = new NativeToolAuthority(
    hub,
    { max_bindings: 1, max_pending_operations: 2 },
    async (identity, record) => {
      assert.deepEqual(identity, scope);
      NativeToolAuditSchema.parse(record);
      if (record.tool === KnowledgeTool.Search) {
        entered.resolve();
        await released.promise;
        if (fail) throw new Error("Private audit sink details");
      }
      records.push(record);
    },
  );
  resources.defer(() => authority.close());
  const clients = new AsyncDisposableStack();
  const lease = authority.open(scope, () => true);
  try {
    const client = await connectNative(authority, lease, clients);
    await nativeValue(client, NativeTool.Ready, {});
    await nativeValue(client, KnowledgeTool.Get, { id: first.entry.id });
    assert.deepEqual(
      records.map((record) => record.entry_ids),
      [[], [first.entry.id]],
    );
    let finished = false;
    const searching = client
      .callTool({
        name: KnowledgeTool.Search,
        arguments: { kind: KnowledgeKind.Fact, mode: KnowledgeSearchMode.Words },
      })
      .then(
        (value) => {
          finished = true;
          return value;
        },
        (error: unknown) => {
          finished = true;
          return error;
        },
      );
    await entered.promise;
    assert.equal(await waitUntil(async () => finished, 3), false);
    released.resolve();
    const result = await searching;
    if (fail) {
      assert.equal(records.length, 2);
      assert.equal(errorMessage(result).includes("Private audit sink details"), false);
      assert.throws(() => lease.guard(), { code: ErrorCode.DurableWrite });
      await assert.rejects(client.listTools());
      await assert.rejects(clients.disposeAsync(), { code: ErrorCode.DurableWrite });
      const replacement = authority.open({ ...scope, execution_id: newId() }, () => true);
      await replacement.close();
    } else {
      assert.equal(records.length, 3);
      const record = records[2];
      assert.equal(record?.outcome, NativeToolOutcome.Returned);
      assert.deepEqual(new Set(record?.entry_ids), new Set([first.entry.id, second.entry.id]));
      assert.equal(JSON.stringify(records).includes(first.entry.body), false);
      assert.equal(JSON.stringify(records).includes(lease.token), false);
      lease.guard();
    }
    return true;
  } finally {
    released.resolve();
    await clients.disposeAsync();
  }
}

export function nativeAuditRefusal(role: NativeToolRole, unknown: boolean) {
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
    const client = await connectNative(authority, lease, resources);
    await client.callTool({
      name: unknown ? "Private unknown tool name" : KnowledgeTool.Get,
      arguments: { id: newId() },
    });
    assert.equal(records.length, 1);
    assert.deepEqual(records[0], {
      tool: unknown ? NativeToolAudit.Unknown : KnowledgeTool.Get,
      outcome: NativeToolOutcome.Refused,
      entry_ids: [],
    });
    assert.equal(JSON.stringify(records).includes("Private unknown tool name"), false);
    lease.guard();
    return true;
  });
}
