import { strict as assert } from "node:assert";
import { unlink } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  ErrorCode,
  HttpHeader,
  HttpOriginHeader,
  HttpStatus,
  KnowledgeKind,
  KnowledgePublicationStage,
  KnowledgeSearchMode,
  KnowledgeTool,
  LocalServer,
  McpIdentity,
  NativeTool,
  NativeToolOutcome,
  NativeToolPolicy,
  NativeToolRole,
} from "@titan/constants";
import { newId } from "@titan/core";
import { KnowledgeHub } from "@titan/knowledge";
import { NativeToolMessage } from "@titan/messages";
import { NativeToolAuthority } from "@titan/server/native-tools";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type JsonSchema,
  KnowledgeEntryResultSchema,
  KnowledgeSearchPageSchema,
  KnowledgeViewEntrySchema,
  McpTextContentSchema,
  type NativeToolAuditRecord,
  type NativeToolLease,
} from "@titan/types";
import { knowledgeDraft } from "./knowledge.ts";
import { knowledgeAttemptScope } from "./knowledge-attempts.ts";
import { acceptNativeAudit } from "./native-audit.ts";

export async function connectNative(
  authority: NativeToolAuthority,
  lease: NativeToolLease,
  resources: AsyncDisposableStack,
) {
  resources.defer(() => lease.close());
  const client = new Client({ name: McpIdentity.Name, version: McpIdentity.Version });
  resources.defer(() => client.close());
  const headers = { [HttpHeader.Authorization]: LocalServer.Bearer + lease.token };
  const transport = new StreamableHTTPClientTransport(
    new URL(NativeTool.Route, "http://127.0.0.1"),
    {
      requestInit: { headers },
      fetch: (input, init) => authority.respond(new Request(input, init)),
    },
  );
  await client.connect(transport);
  return client;
}

export async function nativeValue(client: Client, name: string, input: JsonSchema) {
  const result = await client.callTool({ name, arguments: input });
  assert.equal(result.isError === true, false);
  return JSON.parse(McpTextContentSchema.parse(result.content)[0]?.text ?? "");
}

export async function nativeFileService(tool: string, available: boolean) {
  return withTemporaryDirectory(async (home) => {
    await using resources = new AsyncDisposableStack();
    const hub = await KnowledgeHub.open(home);
    resources.defer(() => hub.close());
    const records: NativeToolAuditRecord[] = [];
    const scope = {
      ...knowledgeAttemptScope(),
      execution_id: newId(),
      role: NativeToolRole.Worker,
    };
    const authority = new NativeToolAuthority(
      hub,
      { max_bindings: 1, max_pending_operations: 8 },
      async (identity, record) => {
        assert.deepEqual(identity, scope);
        records.push(record);
      },
      undefined,
      available
        ? async (identity, path) => {
            assert.deepEqual(identity, scope);
            return {
              observation: { path, version: null, hash: null, executable: null },
              content: null,
            };
          }
        : undefined,
      available
        ? async (identity, directory) => {
            assert.deepEqual(identity, scope);
            return { observation: { directory, files: [] } };
          }
        : undefined,
    );
    resources.defer(() => authority.close());
    const client = await connectNative(
      authority,
      authority.open(scope, () => true),
      resources,
    );
    const response = await client.callTool({
      name: tool,
      arguments:
        tool === NativeTool.WriteFile
          ? { path: "absent.txt", content: "Changed", expected_version: null }
          : tool === NativeTool.ReadFile
            ? { path: "absent.txt" }
            : { directory: "." },
    });
    assert.equal(response.isError === true, !available);
    const value: unknown = JSON.parse(McpTextContentSchema.parse(response.content)[0]?.text ?? "");
    assert.deepEqual(
      value,
      available
        ? tool === NativeTool.ReadFile
          ? {
              observation: { path: "absent.txt", version: null, hash: null, executable: null },
              content: null,
            }
          : { observation: { directory: ".", files: [] } }
        : { code: ErrorCode.ServerUnavailable, error: NativeToolMessage.Unavailable },
    );
    assert.equal(records.length, 1);
    assert.equal(records[0]?.tool, tool);
    assert.equal(
      records[0]?.outcome,
      available ? NativeToolOutcome.Returned : NativeToolOutcome.Refused,
    );
    return true;
  });
}

export async function nativeKnowledgeOwnership(kind: KnowledgeKind, discard: boolean) {
  async function observe(home: string) {
    await using resources = new AsyncDisposableStack();
    const hub = await KnowledgeHub.open(home);
    resources.defer(() => hub.close());
    const authority = new NativeToolAuthority(
      hub,
      { max_bindings: 2, max_pending_operations: 8 },
      acceptNativeAudit,
    );
    resources.defer(() => authority.close());
    const scope = knowledgeAttemptScope();
    const identity = { ...scope, execution_id: newId(), role: NativeToolRole.Worker };
    const ownerLease = authority.open(identity, () => true);
    const owner = await connectNative(authority, ownerLease, resources);
    const peerScope = { ...identity, run_id: newId(), execution_id: newId() };
    const peer = await connectNative(
      authority,
      authority.open(peerScope, () => true),
      resources,
    );
    const tools = await owner.listTools();
    assert.deepEqual(new Set(tools.tools.map((tool) => tool.name)), new Set(ownerLease.tools));
    assert.deepEqual(ownerLease.tools, NativeToolPolicy[NativeToolRole.Worker]);
    const ready = await nativeValue(owner, NativeTool.Ready, {});
    assert.equal(ready.run_id, scope.run_id);
    assert.equal(ready.execution_id, identity.execution_id);
    assert.equal(JSON.stringify(ready).includes(ownerLease.token), false);
    const proposal = KnowledgeViewEntrySchema.parse(
      await nativeValue(owner, KnowledgeTool.Add, {
        private_revision: null,
        entry: knowledgeDraft(kind),
      }),
    );
    const read = KnowledgeViewEntrySchema.parse(
      await nativeValue(owner, KnowledgeTool.Get, { id: proposal.entry.id }),
    );
    assert.deepEqual(read, proposal);
    const changed = await nativeValue(owner, KnowledgeTool.Update, {
      id: proposal.entry.id,
      version: 1,
      private_revision: 1,
      entry: { ...knowledgeDraft(kind), body: "Updated private time zones" },
    });
    assert.equal(changed.entry.version, 1);
    assert.equal(changed.private_revision, 2);
    const temporary = await nativeValue(owner, KnowledgeTool.Add, {
      private_revision: 2,
      entry: knowledgeDraft(kind),
    });
    await nativeValue(owner, KnowledgeTool.Delete, {
      id: temporary.entry.id,
      version: 1,
      private_revision: 3,
    });
    const query = { kind, mode: KnowledgeSearchMode.Words };
    assert.equal((await hub.search(query)).results.length, 0);
    const missing = await peer.callTool({
      name: KnowledgeTool.Get,
      arguments: { id: proposal.entry.id },
    });
    assert.equal(missing.isError, true);
    const error = JSON.parse(McpTextContentSchema.parse(missing.content)[0]?.text ?? "");
    assert.equal(error.code, ErrorCode.KnowledgeMissing);
    const forged = await owner.callTool({
      name: KnowledgeTool.Get,
      arguments: { id: proposal.entry.id, run_id: peerScope.run_id },
    });
    assert.equal(forged.isError, true);
    const ownPage = await nativeValue(owner, KnowledgeTool.Search, query);
    assert.equal(ownPage.private_revision, 4);
    assert.equal(ownPage.results[0]?.id, proposal.entry.id);
    const peerPage = await nativeValue(peer, KnowledgeTool.Search, query);
    assert.equal(peerPage.results.length, 0);
    assert.equal(peerPage.private_revision, null);
    if (discard) await hub.attempts.discard(scope, 4);
    else await hub.attempts.publish(scope, 4);
    assert.equal((await hub.search(query)).results.length, discard ? 0 : 1);
    return true;
  }
  return withTemporaryDirectory(observe);
}

function nativeRequest(token: string) {
  return new Request(new URL(NativeTool.Route, "http://127.0.0.1"), {
    headers: { [HttpHeader.Authorization]: LocalServer.Bearer + token },
  });
}

export async function nativeAuthorityLifecycle(role: NativeToolRole, stale: boolean) {
  async function observe(home: string) {
    await using resources = new AsyncDisposableStack();
    const hub = await KnowledgeHub.open(home);
    resources.defer(() => hub.close());
    const authority = new NativeToolAuthority(
      hub,
      { max_bindings: 1, max_pending_operations: 8 },
      acceptNativeAudit,
    );
    resources.defer(() => authority.close());
    const scope = { ...knowledgeAttemptScope(), execution_id: newId(), role };
    let current = true;
    const active = () => current;
    const lease = authority.open(scope, active);
    const client = await connectNative(authority, lease, resources);
    assert.equal(
      (await nativeValue(client, NativeTool.Ready, {})).execution_id,
      scope.execution_id,
    );
    assert.throws(() => authority.open({}, active), { code: ErrorCode.Arguments });
    assert.throws(() => authority.open(scope, active), { code: ErrorCode.Capacity });
    assert.throws(() => authority.open(scope, () => false), { code: ErrorCode.PermissionDenied });
    if (stale) current = false;
    else await lease.close();
    assert.equal(
      (await authority.respond(nativeRequest(lease.token))).status,
      HttpStatus.Forbidden,
    );
    await lease.close();
    await lease.close();
    const next = authority.open({ ...scope, execution_id: newId() }, () => true);
    const replacement = await connectNative(authority, next, resources);
    assert.notEqual(next.token, lease.token);
    assert.equal((await nativeValue(replacement, NativeTool.Ready, {})).role, role);
    await authority.close();
    assert.equal((await authority.respond(nativeRequest(next.token))).status, HttpStatus.Forbidden);
    assert.throws(() => authority.open(scope, active), { code: ErrorCode.PermissionDenied });
    return true;
  }
  return withTemporaryDirectory(observe);
}

export async function nativeAuthorityDrain(kind: KnowledgeKind, fail: boolean) {
  async function observe(home: string) {
    const entered = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const admitted = Promise.withResolvers<void>();
    let waiting = false;
    const hub = await KnowledgeHub.open(home, {}, async (stage) => {
      if (stage !== KnowledgePublicationStage.Journal) return;
      entered.resolve();
      await released.promise;
      if (fail) throw new Error("Interrupted native publication");
    });
    await using resources = new AsyncDisposableStack();
    resources.defer(() => hub.close());
    observeKnowledgeAdmission(hub, () => {
      if (waiting) admitted.resolve();
    });
    const authority = new NativeToolAuthority(
      hub,
      { max_bindings: 1, max_pending_operations: 1 },
      acceptNativeAudit,
    );
    resources.defer(() => authority.close());
    const scope = knowledgeAttemptScope();
    const current = () => true;
    const lease = authority.open(
      { ...scope, execution_id: newId(), role: NativeToolRole.Worker },
      current,
    );
    const client = await connectNative(authority, lease, resources);
    try {
      const writing = fail
        ? assert.rejects(hub.add(knowledgeDraft(kind)), {
            message: "Interrupted native publication",
          })
        : hub.add(knowledgeDraft(kind));
      await entered.promise;
      waiting = true;
      const changing = client.callTool({
        name: KnowledgeTool.Add,
        arguments: { private_revision: null, entry: knowledgeDraft(kind) },
      });
      await admitted.promise;
      const full = await authority.respond(nativeRequest(lease.token));
      assert.equal(full.status, HttpStatus.Conflict);
      assert.equal((await full.json()).code, ErrorCode.Capacity);
      const stopping = lease.close();
      assert.equal(
        (await authority.respond(nativeRequest(lease.token))).status,
        HttpStatus.Forbidden,
      );
      await Promise.resolve();
      assert.throws(
        () =>
          authority.open({ ...scope, execution_id: newId(), role: NativeToolRole.Worker }, current),
        { code: ErrorCode.Capacity },
      );
      released.resolve();
      await writing;
      const result = await changing;
      assert.equal(result.isError === true, fail);
      await stopping;
      assert.equal(
        (await authority.respond(nativeRequest(lease.token))).status,
        HttpStatus.Forbidden,
      );
      return true;
    } finally {
      released.resolve();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function nativeAuthorityGuards(role: NativeToolRole, origin: boolean) {
  async function observe(home: string) {
    await using resources = new AsyncDisposableStack();
    const hub = await KnowledgeHub.open(home);
    resources.defer(() => hub.close());
    assert.throws(
      () =>
        new NativeToolAuthority(
          hub,
          { max_bindings: 0, max_pending_operations: 1 },
          acceptNativeAudit,
        ),
    );
    assert.throws(
      () =>
        new NativeToolAuthority(
          hub,
          { max_bindings: 1, max_pending_operations: 0 },
          acceptNativeAudit,
        ),
    );
    const authority = new NativeToolAuthority(
      hub,
      { max_bindings: 1, max_pending_operations: 8 },
      acceptNativeAudit,
    );
    resources.defer(() => authority.close());
    const scope = { ...knowledgeAttemptScope(), execution_id: newId(), role };
    let broken = false;
    const lease = authority.open(scope, () => {
      if (broken) throw new Error("Private execution details must stay inside the owner");
      return true;
    });
    const client = await connectNative(authority, lease, resources);
    const listed = await client.listTools();
    assert.deepEqual(new Set(listed.tools.map((tool) => tool.name)), new Set(lease.tools));
    const forged = await authority.respond(nativeRequest(scope.run_id));
    assert.equal(forged.status, HttpStatus.Forbidden);
    const request = nativeRequest(lease.token);
    if (origin) request.headers.set(HttpOriginHeader, "http://example.invalid");
    else request.headers.delete(HttpHeader.Authorization);
    assert.equal((await authority.respond(request)).status, HttpStatus.Forbidden);
    const misplaced = new Request(new URL("/", request.url), nativeRequest(lease.token));
    assert.equal((await authority.respond(misplaced)).status, HttpStatus.Forbidden);
    broken = true;
    const failure = await authority.respond(nativeRequest(lease.token));
    assert.equal(failure.status, HttpStatus.Internal);
    assert.equal((await failure.text()).includes("Private execution details"), false);
    return true;
  }
  return withTemporaryDirectory(observe);
}

export async function nativeKnowledgeReadOnly(kind: KnowledgeKind, attack: boolean) {
  async function observe(home: string) {
    await using resources = new AsyncDisposableStack();
    const hub = await KnowledgeHub.open(home);
    resources.defer(() => hub.close());
    const final = await hub.add(knowledgeDraft(kind));
    const scope = knowledgeAttemptScope();
    const proposal = await hub
      .view(scope)
      .add({ private_revision: null, entry: knowledgeDraft(kind) });
    const authority = new NativeToolAuthority(
      hub,
      { max_bindings: 1, max_pending_operations: 8 },
      acceptNativeAudit,
    );
    resources.defer(() => authority.close());
    const lease = authority.open(
      { ...scope, execution_id: newId(), role: NativeToolRole.Checker },
      () => true,
    );
    const checker = await connectNative(authority, lease, resources);
    assert.deepEqual(lease.tools, NativeToolPolicy[NativeToolRole.Checker]);
    const read = KnowledgeEntryResultSchema.parse(
      await nativeValue(checker, KnowledgeTool.Get, { id: final.entry.id }),
    );
    assert.deepEqual(read, final);
    const page = KnowledgeSearchPageSchema.parse(
      await nativeValue(checker, KnowledgeTool.Search, { kind, mode: KnowledgeSearchMode.Words }),
    );
    assert.equal(page.results.length, 1);
    assert.equal(page.results[0]?.id, final.entry.id);
    const missing = await checker.callTool({
      name: KnowledgeTool.Get,
      arguments: { id: proposal.entry.id },
    });
    assert.equal(missing.isError, true);
    const name = attack ? KnowledgeTool.Add : KnowledgeTool.Reindex;
    const result = await checker.callTool({ name, arguments: {} });
    assert.equal(result.isError, true);
    const decision = await checker.callTool({ name: McpIdentity.RequestAnswer, arguments: {} });
    assert.equal(decision.isError, true);
    const path = page.results[0]?.path;
    assert.ok(path);
    await unlink(path);
    const unreadable = await checker.callTool({
      name: KnowledgeTool.Get,
      arguments: { id: final.entry.id },
    });
    assert.equal(unreadable.isError, true);
    const failure = JSON.parse(McpTextContentSchema.parse(unreadable.content)[0]?.text ?? "");
    assert.equal(failure.error, NativeToolMessage.Unavailable);
    assert.equal(JSON.stringify(unreadable).includes(home), false);
    return true;
  }
  return withTemporaryDirectory(observe);
}

export async function nativeAuthorityQueued(role: NativeToolRole, stale: boolean) {
  async function observe(home: string) {
    const entered = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const admitted = Promise.withResolvers<void>();
    let waiting = false;
    const hub = await KnowledgeHub.open(home, {}, async (stage) => {
      if (stage !== KnowledgePublicationStage.Journal) return;
      entered.resolve();
      await released.promise;
    });
    await using resources = new AsyncDisposableStack();
    resources.defer(() => hub.close());
    observeKnowledgeAdmission(hub, () => {
      if (waiting) admitted.resolve();
    });
    const authority = new NativeToolAuthority(
      hub,
      { max_bindings: 1, max_pending_operations: 2 },
      acceptNativeAudit,
    );
    resources.defer(() => authority.close());
    let current = true;
    const lease = authority.open(
      { ...knowledgeAttemptScope(), execution_id: newId(), role },
      () => current,
    );
    const client = await connectNative(authority, lease, resources);
    try {
      const writing = hub.add(knowledgeDraft(KnowledgeKind.Fact));
      await entered.promise;
      waiting = true;
      const reading = client.callTool({
        name: KnowledgeTool.Search,
        arguments: { kind: KnowledgeKind.Fact, mode: KnowledgeSearchMode.Words },
      });
      await admitted.promise;
      const queued = authority.respond(nativeRequest(lease.token));
      if (stale) current = false;
      const stopping = stale ? Promise.resolve() : lease.close();
      released.resolve();
      await writing;
      assert.equal((await reading).isError === true, false);
      assert.equal((await queued).status, HttpStatus.Forbidden);
      await stopping;
      await lease.close();
      return true;
    } finally {
      released.resolve();
    }
  }
  return withTemporaryDirectory(observe);
}

function observeKnowledgeAdmission(hub: KnowledgeHub, admitted: () => void): void {
  const search = hub.search.bind(hub);
  hub.search = (input) => {
    admitted();
    return search(input);
  };
  const view = hub.view.bind(hub);
  hub.view = (scope) => {
    const owned = view(scope);
    const add = owned.add.bind(owned);
    owned.add = (input) => {
      admitted();
      return add(input);
    };
    const search = owned.search.bind(owned);
    owned.search = (input) => {
      admitted();
      return search(input);
    };
    return owned;
  };
}
