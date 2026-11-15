import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { PassThrough } from "node:stream";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { nativeToolConnection, nativeToolEnvironment } from "@titan/config";
import {
  ErrorCode,
  FileEncoding,
  HttpMethod,
  KnowledgeKind,
  KnowledgeSearchMode,
  KnowledgeTool,
  LocalServer,
  McpIdentity,
  NativeTool,
  NativeToolBridgeFixture,
  NativeToolEnvironment,
  NativeToolPolicy,
  NativeToolRole,
  ServerCredential,
  ServerLimit,
} from "@titan/constants";
import { newId } from "@titan/core";
import { KnowledgeHub } from "@titan/knowledge";
import { NativeToolBridgeMessage } from "@titan/messages";
import {
  NativeStdioTransport,
  serveNativeToolServer,
  startNativeToolServer,
} from "@titan/server/native-tool-bridge";
import { connectNativeTools, nativeToolReady } from "@titan/server/native-tool-client";
import { NativeToolAuthority } from "@titan/server/native-tools";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { McpTextContentSchema, ObjectSchema } from "@titan/types";
import { knowledgeDraft } from "./knowledge.ts";
import { knowledgeAttemptScope } from "./knowledge-attempts.ts";
import { acceptNativeAudit } from "./native-audit.ts";

export function nativeBridgeConnection(role: NativeToolRole, directory: string) {
  return {
    url: "http://127.0.0.1:12345/native-tools",
    token: randomBytes(ServerCredential.RandomBytes).toString(FileEncoding.Hex),
    run_directory: directory,
    timeout_ms: 1000,
    scope: { ...knowledgeAttemptScope(), execution_id: newId(), role },
  };
}

export async function nativeBridgeEnvironment(
  role: NativeToolRole,
  field: string | null,
  value: string,
) {
  return withTemporaryDirectory(async (directory) => {
    const input = nativeBridgeConnection(role, directory);
    if (role === NativeToolRole.Checker) input.scope.part_id = "part";
    const environment = nativeToolEnvironment(input);
    if (field) {
      environment[field] = value;
      assert.throws(() => nativeToolConnection(environment), {
        code: ErrorCode.Arguments,
        message: NativeToolBridgeMessage.Invalid,
      });
    } else {
      assert.deepEqual(nativeToolConnection(environment), input);
      assert.deepEqual(
        new Set(Object.keys(environment)),
        new Set(Object.values(NativeToolEnvironment)),
      );
    }
    await assert.rejects(startNativeToolServer({}), {
      code: ErrorCode.Arguments,
      message: NativeToolBridgeMessage.Invalid,
    });
    return true;
  });
}

export async function nativeBridgeFlow(role: NativeToolRole, revoked: boolean) {
  return withTemporaryDirectory(async (home) => {
    await using resources = new AsyncDisposableStack();
    const hub = await KnowledgeHub.open(home);
    resources.defer(() => hub.close());
    const final = await hub.add(knowledgeDraft(KnowledgeKind.Fact));
    const authority = new NativeToolAuthority(
      hub,
      { max_bindings: 1, max_pending_operations: 8 },
      acceptNativeAudit,
    );
    resources.defer(() => authority.close());
    const input = nativeBridgeConnection(role, home);
    const lease = authority.open(input.scope, () => true);
    resources.defer(() => lease.close());
    const http = Bun.serve({
      hostname: LocalServer.Host,
      port: 0,
      fetch: (request) => authority.respond(request),
    });
    resources.defer(() => http.stop(true));
    input.url = new URL(NativeTool.Route, http.url).href;
    input.token = lease.token;
    const [left, right] = InMemoryTransport.createLinkedPair();
    const bridge = await startNativeToolServer(input, left);
    resources.defer(() => bridge.close());
    const client = new Client({ name: McpIdentity.Name, version: McpIdentity.Version });
    resources.defer(() => client.close());
    await client.connect(right);
    const listed = await client.listTools();
    assert.deepEqual(
      new Set(listed.tools.map((tool) => tool.name)),
      new Set(NativeToolPolicy[role]),
    );
    const read = await client.callTool({
      name: KnowledgeTool.Get,
      arguments: { id: final.entry.id },
    });
    assert.equal(read.isError === true, false);
    if (role === NativeToolRole.Worker) {
      const result = await client.callTool({
        name: KnowledgeTool.Add,
        arguments: { private_revision: null, entry: knowledgeDraft(KnowledgeKind.Lesson) },
      });
      assert.equal(result.isError === true, false);
      assert.equal(
        (await hub.search({ kind: KnowledgeKind.Lesson, mode: KnowledgeSearchMode.Words })).results
          .length,
        0,
      );
    }
    await assert.rejects(client.callTool({ name: McpIdentity.RequestAnswer, arguments: {} }));
    if (revoked) {
      await lease.close();
      await assert.rejects(client.callTool({ name: NativeTool.Ready, arguments: {} }));
    }
    await client.close();
    await bridge.closed;
    await bridge.close();
    return true;
  });
}

async function alteredBridgeResponse(
  request: Request,
  authority: NativeToolAuthority,
  mode: NativeToolBridgeFixture,
) {
  if (request.method !== HttpMethod.Post) return authority.respond(request);
  const body = ObjectSchema.parse(await request.clone().json());
  const response = await authority.respond(request);
  if (!response.ok || mode === NativeToolBridgeFixture.Ready) return response;
  if (body.method !== "tools/list" && body.method !== "tools/call") return response;
  const message = ObjectSchema.parse(await response.json());
  const result = ObjectSchema.parse(message.result);
  message.result = result;
  if (body.method === "tools/list" && mode === NativeToolBridgeFixture.ListedTools) {
    result.tools = [];
    return Response.json(message);
  }
  if (body.method !== "tools/call") return Response.json(message);
  const content = McpTextContentSchema.parse(result.content);
  const ready = ObjectSchema.parse(JSON.parse(content[0]?.text ?? ""));
  if (mode === NativeToolBridgeFixture.Scope) ready.execution_id = newId();
  if (mode === NativeToolBridgeFixture.ReadyTools) ready.tools = [NativeTool.Ready];
  if (mode === NativeToolBridgeFixture.NoReady) result.isError = true;
  result.content = [
    {
      type: McpIdentity.Text,
      text: mode === NativeToolBridgeFixture.Malformed ? "{" : JSON.stringify(ready),
    },
  ];
  return Response.json(message);
}

export async function nativeBridgeStartup(role: NativeToolRole, mode: NativeToolBridgeFixture) {
  return withTemporaryDirectory(async (home) => {
    await using resources = new AsyncDisposableStack();
    const hub = await KnowledgeHub.open(home);
    resources.defer(() => hub.close());
    const authority = new NativeToolAuthority(
      hub,
      { max_bindings: 1, max_pending_operations: 8 },
      acceptNativeAudit,
    );
    resources.defer(() => authority.close());
    const input = nativeBridgeConnection(role, home);
    const lease = authority.open(input.scope, () => true);
    resources.defer(() => lease.close());
    const http = Bun.serve({
      hostname: LocalServer.Host,
      port: 0,
      fetch: (request) => alteredBridgeResponse(request, authority, mode),
    });
    resources.defer(() => http.stop(true));
    input.url = new URL(NativeTool.Route, http.url).href;
    input.token = lease.token;
    const [left, right] = InMemoryTransport.createLinkedPair();
    if (mode === NativeToolBridgeFixture.Transport)
      left.start = async () => {
        throw new Error("Private transport details");
      };
    if (mode === NativeToolBridgeFixture.Ready) {
      const started = Promise.withResolvers<void>();
      const start = left.start.bind(left);
      left.start = async () => {
        await start();
        started.resolve();
      };
      const serving = serveNativeToolServer(input, left);
      const client = new Client({ name: McpIdentity.Name, version: McpIdentity.Version });
      resources.defer(() => client.close());
      await started.promise;
      await client.connect(right);
      await client.listTools();
      await client.close();
      await serving;
    } else {
      await assert.rejects(startNativeToolServer(input, left), {
        code: ErrorCode.ServerUnavailable,
        message: NativeToolBridgeMessage.Startup,
      });
    }
    return true;
  });
}

export async function nativeBridgeCli(args: string[], allowed: boolean) {
  const { createCli } = await import("../../apps/cli/src/application.ts");
  const { defaultServices } = await import("../../apps/cli/src/bootstrap.ts");
  let calls = 0;
  const output: unknown[] = [];
  const main = createCli({
    ...defaultServices,
    toolServer: async () => {
      calls++;
    },
    output: (value) => {
      output.push(value);
    },
  });
  if (allowed) assert.equal(await main(args), 0);
  else
    await assert.rejects(main(args), {
      code: args.includes("--json") ? ErrorCode.ProtocolJson : ErrorCode.Arguments,
    });
  assert.equal(calls, allowed && !args.includes("--help") ? 1 : 0);
  assert.equal(output.length, args.includes("--help") ? 1 : 0);
  return true;
}

export async function nativeStdioLifecycle(
  endedBeforeStart: boolean,
  overflow: boolean,
  repeated: boolean,
) {
  await using resources = new AsyncDisposableStack();
  const input = new PassThrough();
  resources.defer(() => {
    input.destroy();
  });
  const output = new PassThrough();
  resources.defer(() => {
    output.destroy();
  });
  const transport = new NativeStdioTransport(input, output);
  resources.defer(() => transport.close());
  const closed = Promise.withResolvers<void>();
  const errors: Error[] = [];
  transport.onclose = closed.resolve;
  transport.onerror = (error) => {
    errors.push(error);
  };
  if (endedBeforeStart) {
    input.resume();
    const ended = once(input, "end");
    input.end();
    await ended;
  }
  await transport.start();
  if (repeated) await assert.rejects(transport.start(), /already started/);
  if (overflow) input.write(Buffer.alloc(ServerLimit.RequestBytes + 1, 97));
  else if (!endedBeforeStart) input.end();
  await closed.promise;
  assert.equal(input.listenerCount("end"), 0);
  assert.equal(input.listenerCount("data"), 0);
  assert.equal(errors.length, overflow ? 1 : 0);
  await transport.close();
  return true;
}

export async function nativeHttpReadiness(
  role: NativeToolRole,
  mode: NativeToolBridgeFixture,
  cancelled = false,
) {
  return withTemporaryDirectory(async (home) => {
    await using resources = new AsyncDisposableStack();
    const hub = await KnowledgeHub.open(home);
    resources.defer(() => hub.close());
    const authority = new NativeToolAuthority(
      hub,
      { max_bindings: 1, max_pending_operations: 8 },
      acceptNativeAudit,
    );
    resources.defer(() => authority.close());
    const input = nativeBridgeConnection(role, home);
    const lease = authority.open(input.scope, () => true);
    resources.defer(() => lease.close());
    let requests = 0;
    const http = Bun.serve({
      hostname: LocalServer.Host,
      port: 0,
      fetch: (request) => {
        requests++;
        return alteredBridgeResponse(request, authority, mode);
      },
    });
    resources.defer(() => http.stop(true));
    input.url = new URL(NativeTool.Route, http.url).href;
    input.token = lease.token;
    await assert.rejects(connectNativeTools({}), { code: ErrorCode.Arguments });
    const signal = cancelled ? AbortSignal.abort() : AbortSignal.timeout(input.timeout_ms);
    if (mode === NativeToolBridgeFixture.Ready && !cancelled) {
      await nativeToolReady(input, signal);
      assert.ok(requests > 0);
      await nativeToolReady(input, signal);
    } else {
      await assert.rejects(nativeToolReady(input, signal), {
        code: ErrorCode.ServerUnavailable,
        message: NativeToolBridgeMessage.Startup,
      });
    }
    if (cancelled) assert.equal(requests, 0);
    return true;
  });
}
