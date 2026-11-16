import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { ClaudeBackend } from "@titan/backend-claude";
import { CodexBackend } from "@titan/backend-codex";
import { nativeAgentEnvironment } from "@titan/config";
import {
  AgentRuntime,
  Backend,
  FileAccessMode,
  HttpMethod,
  KnowledgeKind,
  KnowledgeTool,
  LocalServer,
  NativeTool,
  type NativeToolRole,
  NativeToolTransport,
  VendorFixture,
  VendorStubMode,
} from "@titan/constants";
import { newId } from "@titan/core";
import { KnowledgeHub } from "@titan/knowledge";
import { HostedBackend } from "@titan/runtime";
import { nativeToolReady } from "@titan/server/native-tool-client";
import { NativeToolAuthority } from "@titan/server/native-tools";
import { agentSpec } from "@titan/test-factories";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { NativeBackendId, NativeToolBinding } from "@titan/types";
import { exists } from "@titan/workspace";
import { knowledgeDraft } from "./knowledge.ts";
import { acceptNativeAudit } from "./native-audit.ts";
import { nativeBridgeConnection } from "./native-tool-bridge.ts";

function adapter(backend: NativeBackendId, hosted: boolean, preflight: boolean) {
  const launch = {
    executable: resolve(
      "testing/fixtures/vendors",
      backend === Backend.Codex ? "codex-0.167.0.mjs" : "claude-0.3.319.mjs",
    ),
    ...(backend === Backend.Claude ? { runtime: AgentRuntime.Bun } : {}),
  };
  if (hosted) return new HostedBackend(backend, launch);
  if (backend === Backend.Codex)
    return new CodexBackend(
      undefined,
      launch,
      nativeAgentEnvironment,
      preflight ? nativeToolReady : undefined,
    );
  return new ClaudeBackend(
    undefined,
    launch,
    nativeAgentEnvironment,
    preflight ? nativeToolReady : undefined,
  );
}

export async function nativeRuntimeBinding(
  backend: NativeBackendId,
  role: NativeToolRole,
  hosted: boolean,
  forged: boolean,
  transport = NativeToolTransport.Stdio,
  preflight = true,
  scoped = false,
) {
  return withTemporaryDirectory(async (home) => {
    await using resources = new AsyncDisposableStack();
    const hub = await KnowledgeHub.open(home);
    resources.defer(() => hub.close());
    await hub.add(knowledgeDraft(KnowledgeKind.Fact));
    const authority = new NativeToolAuthority(
      hub,
      { max_bindings: 1, max_pending_operations: 8 },
      acceptNativeAudit,
    );
    resources.defer(() => authority.close());
    const connection = nativeBridgeConnection(role, home);
    connection.timeout_ms = 2000;
    const lease = authority.open(connection.scope, () => true);
    resources.defer(() => lease.close());
    let searches = 0;
    let reads = 0;
    const http = Bun.serve({
      hostname: LocalServer.Host,
      port: 0,
      async fetch(request) {
        if (request.method !== HttpMethod.Post) return authority.respond(request);
        const body = await request.clone().json();
        if (body.params?.name === KnowledgeTool.Search) searches++;
        if (body.params?.name === KnowledgeTool.Get) reads++;
        return authority.respond(request);
      },
    });
    resources.defer(() => http.stop(true));
    connection.url = new URL(NativeTool.Route, http.url).href;
    connection.token = lease.token;
    if (forged) connection.scope.execution_id = newId();
    const binding: NativeToolBinding = {
      ...(transport === NativeToolTransport.Stdio ? {} : { transport }),
      connection,
      launch: { command: process.execPath, args: [resolve("apps/cli/src/main.ts"), "tool-server"] },
    };
    const spec = {
      ...agentSpec(home),
      run_id: connection.scope.run_id,
      execution_id: connection.scope.execution_id,
      ...(scoped
        ? { writable: true, file_scope: { mode: FileAccessMode.Write, paths: ["absent.txt"] } }
        : {}),
    };
    const backendInstance = adapter(backend, hosted, preflight);
    let completed = 0;
    const failure = await thrownBy(async () => {
      const session = await backendInstance.start(spec, binding);
      resources.defer(() => session.close());
      const first = await session.send(
        VendorStubMode.NativeTools,
        async () => {},
        AbortSignal.timeout(10000),
      );
      completed++;
      await session.close();
      const restored = await backendInstance.resume(first.session_id, spec, binding);
      resources.defer(() => restored.close());
      const second = await restored.send(
        VendorStubMode.NativeTools,
        async () => {},
        AbortSignal.timeout(10000),
      );
      assert.equal(second.session_id, first.session_id);
      completed++;
    });
    const refused = forged || !preflight;
    if (!refused && failure) throw failure;
    assert.equal(failure instanceof Error, refused);
    assert.equal(String(failure).includes(connection.token), false);
    assert.equal(completed, refused ? 0 : 2);
    assert.equal(searches, refused ? 0 : 2);
    assert.equal(reads, refused ? 0 : 2);
    assert.equal(
      await exists(resolve(home, VendorFixture.StateDirectory, "calls.jsonl")),
      !refused,
    );
    return true;
  });
}
