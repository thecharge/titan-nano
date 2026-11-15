import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import {
  AgentHost,
  AgentHostKind,
  Backend,
  ErrorCode,
  HostReadinessFixture,
  HostReadinessMode,
  HttpStatus,
  LocalServer,
  NativeTool,
  NativeToolRole,
  NativeToolTransport,
  ProcessIo,
  TextSymbol,
} from "@titan/constants";
import { OperationalError, TitanError } from "@titan/errors";
import { AgentHostMessage, localServerUrl } from "@titan/messages";
import { hostedTurn, nativeHostBackend, serveAgentHost, type spawnAgentHost } from "@titan/runtime";
import { agentSpec } from "@titan/test-factories";
import { processExited, thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type {
  AgentAnswer,
  AgentEvent,
  AgentHostOutput,
  AgentHostPort,
  AgentHostSpawn,
  AgentHostStart,
  NativeBackendId,
  NativeToolPreflight,
} from "@titan/types";
import { createFakeBackend } from "../support/backend.ts";
import { nativeBridgeConnection } from "./native-tool-bridge.ts";

async function collectEvent(events: AgentEvent[], event: AgentEvent) {
  events.push(event);
}

function readinessRequest(root: string, backend: NativeBackendId): AgentHostStart {
  const request: AgentHostStart = {
    type: AgentHostKind.Start,
    backend,
    launch: {},
    spec: agentSpec(root),
    session_id: null,
    prompt: TextSymbol.Empty,
  };
  const connection = nativeBridgeConnection(
    backend === Backend.Codex ? NativeToolRole.Worker : NativeToolRole.Checker,
    root,
  );
  request.spec.run_id = connection.scope.run_id;
  request.spec.execution_id = connection.scope.execution_id;
  const launch = { command: process.execPath, args: [] };
  request.native_tools = { transport: NativeToolTransport.Http, connection, launch };
  return request;
}

export async function hostReadiness(
  mode: HostReadinessMode,
  backend: NativeBackendId,
  expectedCode: ErrorCode | null,
  expectedChecks: number,
  retryAfter = 0,
) {
  return withTemporaryDirectory((root) =>
    hostReadinessAtRoot(root, mode, backend, expectedCode, expectedChecks, retryAfter),
  );
}

async function hostReadinessAtRoot(
  root: string,
  mode: HostReadinessMode,
  backend: NativeBackendId,
  expectedCode: ErrorCode | null,
  expectedChecks: number,
  retryAfter: number,
) {
  const request = readinessRequest(root, backend);
  const controller = new AbortController();
  let child: ReturnType<typeof spawnAgentHost> | undefined;
  let checks = 0;
  const events: AgentEvent[] = [];
  let answer: AgentAnswer | undefined;
  const preflight: NativeToolPreflight = (connection, signal) => {
    checks++;
    assert.deepEqual(connection, request.native_tools?.connection);
    assert.equal(signal, controller.signal);
    if (mode === HostReadinessMode.Refused)
      throw new TitanError(ErrorCode.ServerUnavailable, AgentHostMessage.Stopped);
    if (mode === HostReadinessMode.RateLimited)
      throw new OperationalError(
        ErrorCode.RateLimited,
        AgentHostMessage.Stopped,
        true,
        HostReadinessFixture.RetryMilliseconds,
      );
    if (mode === HostReadinessMode.Aborted)
      controller.abort(
        new OperationalError(ErrorCode.ExecutionInterrupted, AgentHostMessage.Stopped),
      );
    if (mode === HostReadinessMode.PendingAnswer) {
      assert(child);
      child.send({ type: AgentHostKind.NativeReady });
      return child.exited.then(() => {});
    }
    return Bun.sleep(HostReadinessFixture.WaitMilliseconds);
  };
  const spawn: AgentHostSpawn = (receive) => {
    child = Bun.spawn([process.execPath, resolve(HostReadinessFixture.Probe), mode], {
      detached: true,
      stdin: ProcessIo.Ignore,
      stdout: ProcessIo.Ignore,
      stderr: ProcessIo.Ignore,
      ipc: receive,
      serialization: AgentHost.Serialization,
    });
    return child;
  };
  if (mode === HostReadinessMode.MissingBinding) delete request.native_tools;
  const failure = await thrownBy(async () => {
    answer = await hostedTurn(
      request,
      collectEvent.bind(null, events),
      controller.signal,
      spawn,
      undefined,
      preflight,
    );
  });
  assert.equal(checks, expectedChecks);
  assert.equal(events.length, mode === HostReadinessMode.Accepted ? 1 : 0);
  assert(child);
  assert(await processExited(child.pid));
  if (expectedCode) {
    assert(failure instanceof OperationalError);
    assert.equal(failure.code, expectedCode);
    assert.equal(failure.retryable, retryAfter > 0);
    assert.equal(failure.retryAfterMs, retryAfter);
    assert.equal(answer, undefined);
  } else {
    assert.equal(failure, undefined);
    assert.equal(answer?.session_id, HostReadinessFixture.Session);
    assert.deepEqual(answer?.json, { delivered: true });
  }
  return true;
}

export async function standaloneReadiness(backend: NativeBackendId, invalid: boolean) {
  return withTemporaryDirectory((root) => standaloneReadinessAtRoot(root, backend, invalid));
}

async function standaloneReadinessAtRoot(root: string, backend: NativeBackendId, invalid: boolean) {
  await using resources = new AsyncDisposableStack();
  const request = readinessRequest(root, backend);
  const server = Bun.serve({
    hostname: LocalServer.Host,
    port: 0,
    fetch: () => new Response(null, { status: HttpStatus.Forbidden }),
  });
  resources.defer(() => server.stop(true));
  assert(request.native_tools);
  request.native_tools.connection.url = localServerUrl(server.port ?? 0) + NativeTool.Route;
  if (invalid) request.spec.execution_id = HostReadinessFixture.Session;
  const adapter = await nativeHostBackend(request);
  const events: AgentEvent[] = [];
  const failure = await thrownBy(async () => {
    const session = await adapter.start(request.spec, request.native_tools);
    try {
      await session.send(
        request.prompt,
        collectEvent.bind(null, events),
        new AbortController().signal,
      );
    } finally {
      await session.close();
    }
  });
  assert.equal(events.length, 0);
  assert(failure instanceof TitanError);
  assert.equal(failure.code, invalid ? ErrorCode.PermissionDenied : ErrorCode.ServerUnavailable);
  return true;
}

export async function serviceReadiness(backend: NativeBackendId, refused: boolean) {
  return withTemporaryDirectory((root) => serviceReadinessAtRoot(root, backend, refused));
}

async function serviceReadinessAtRoot(root: string, backend: NativeBackendId, refused: boolean) {
  await using resources = new AsyncDisposableStack();
  const request = readinessRequest(root, backend);
  assert(request.native_tools);
  const connection = request.native_tools.connection;
  const requested = Promise.withResolvers<void>();
  const complete = Promise.withResolvers<AgentHostOutput>();
  let receive!: (message: unknown) => void;
  let disconnect!: () => void;
  let continued = false;
  let stopped = false;
  let checks = 0;
  let events = 0;
  const port: AgentHostPort = {
    receive: (listener) => {
      receive = listener;
    },
    disconnected: (listener) => {
      disconnect = listener;
    },
    stop: () => {
      stopped = true;
    },
    send: (message) => {
      if (message.type === AgentHostKind.NativeReady) {
        checks++;
        requested.resolve();
      }
      if (message.type === AgentHostKind.Event) {
        events++;
        receive({ type: AgentHostKind.Ack });
      }
      if (message.type === AgentHostKind.Answer || message.type === AgentHostKind.Error)
        complete.resolve(message);
    },
  };
  serveAgentHost(
    port,
    async (value, readiness) => {
      assert.deepEqual(value, request);
      assert(readiness);
      await readiness(connection, new AbortController().signal);
      continued = true;
      if (refused)
        throw new OperationalError(
          ErrorCode.RateLimited,
          AgentHostMessage.Stopped,
          true,
          HostReadinessFixture.RetryMilliseconds,
        );
      return createFakeBackend();
    },
    resources,
  );
  receive(request);
  await requested.promise;
  await Bun.sleep(HostReadinessFixture.WaitMilliseconds);
  assert.equal(continued, false);
  assert.equal(events, 0);
  receive({ type: AgentHostKind.Ack });
  const result = await complete.promise;
  assert.equal(continued, true);
  assert.equal(checks, 1);
  assert.equal(result.type, refused ? AgentHostKind.Error : AgentHostKind.Answer);
  assert.equal(events, refused ? 0 : 1);
  if (result.type === AgentHostKind.Error) {
    assert.equal(result.code, ErrorCode.RateLimited);
    assert.equal(result.retryable, true);
    assert.equal(result.retry_after_ms, HostReadinessFixture.RetryMilliseconds);
  }
  disconnect();
  assert.equal(stopped, true);
  return true;
}
