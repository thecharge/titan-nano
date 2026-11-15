import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { nativeToolEnvironment } from "@titan/config";
import {
  KnowledgeKind,
  KnowledgeTool,
  LocalServer,
  McpIdentity,
  NativeTool,
  NativeToolPolicy,
  type NativeToolRole,
  ServerLimit,
  TestProcessLimit,
} from "@titan/constants";
import { newId } from "@titan/core";
import { KnowledgeHub } from "@titan/knowledge";
import { NativeToolBridgeMessage } from "@titan/messages";
import { NativeToolAuthority } from "@titan/server/native-tools";
import { readBytes } from "@titan/streams";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { knowledgeDraft } from "./knowledge.ts";
import { acceptNativeAudit } from "./native-audit.ts";
import { nativeBridgeConnection } from "./native-tool-bridge.ts";

export async function nativeToolProcess(role: NativeToolRole, substituted: boolean) {
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
    if (substituted) input.scope.execution_id = newId();
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [resolve("apps/cli/src/main.ts"), "tool-server"],
      env: nativeToolEnvironment(input),
      stderr: "pipe",
      maxBufferSize: ServerLimit.RequestBytes,
    });
    const stderr = transport.stderr;
    assert.ok(stderr instanceof Readable);
    const diagnostics = readBytes(stderr, ServerLimit.RequestBytes);
    const client = new Client({ name: McpIdentity.Name, version: McpIdentity.Version });
    resources.defer(() => client.close());
    const connecting = client.connect(transport, { timeout: TestProcessLimit.DefaultMilliseconds });
    if (substituted) await assert.rejects(connecting);
    else {
      await connecting;
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
      const ready = await client.callTool({ name: NativeTool.Ready, arguments: {} });
      assert.equal(JSON.stringify(ready).includes(input.token), false);
    }
    await client.close();
    const output = (await diagnostics).toString();
    if (substituted) assert.equal(output.includes(NativeToolBridgeMessage.Startup), true);
    else assert.equal(output, "");
    assert.equal(output.includes(input.token), false);
    assert.equal(output.includes(home), false);
    return true;
  });
}
