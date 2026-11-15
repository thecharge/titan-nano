import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import {
  AgentHost,
  AgentHostKind,
  AgentRuntime,
  Backend,
  ErrorCode,
  FileAccessMode,
} from "@titan/constants";
import { all } from "@titan/core";
import { OperationalError } from "@titan/errors";
import {
  HostedBackend,
  hostedTurn,
  hostFrame,
  hostTurn,
  nativeHostBackend,
  nativeHostPort,
  serveAgentHost,
  spawnAgentHost,
  startAgentHost,
} from "@titan/runtime";
import { agentSpec, observeVendorIsolation } from "@titan/test-factories";
import { thrownBy, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type AgentHostOutput,
  AgentHostOutputSchema,
  type AgentHostPort,
  type AgentHostStart,
  type NativeBackendId,
  ObjectSchema,
} from "@titan/types";
import { createFakeBackend } from "../support/backend.ts";

export function hostBudget(bytes: number) {
  return hostFrame("x".repeat(bytes)).length;
}
export function hostValue(value: unknown) {
  return hostFrame(value);
}
export async function hostFailure(code: string, message: string) {
  return withTemporaryDirectory(async (root) => {
    await using resources = new AsyncDisposableStack();
    let receive!: (raw: unknown) => void;
    let disconnect!: () => void;
    let stopped = false;
    const failure = Promise.withResolvers<AgentHostOutput>();
    serveAgentHost(
      {
        receive(listener) {
          receive = listener;
        },
        disconnected(listener) {
          disconnect = listener;
        },
        stop() {
          stopped = true;
        },
        send(raw) {
          const output = AgentHostOutputSchema.parse(hostFrame(raw));
          if (output.type === AgentHostKind.Event) receive({ type: AgentHostKind.Ack });
          if (output.type === AgentHostKind.Error) failure.resolve(output);
        },
      },
      () =>
        new FakeBackend(async () => {
          throw new OperationalError(code, message, true, 50);
        }),
      resources,
    );
    receive(request(root));
    const result = await failure.promise;
    disconnect();
    return { ...result, stopped };
  });
}
function request(root: string, resume = false): AgentHostStart {
  return {
    type: AgentHostKind.Start,
    backend: Backend.Codex,
    launch: {},
    spec: agentSpec(root),
    session_id: resume ? "native-before" : null,
    prompt: "complete",
  };
}
export async function hostService(mode: string) {
  return withTemporaryDirectory(async (root) => {
    await using resources = new AsyncDisposableStack();
    let receive!: (raw: unknown) => void;
    let disconnect!: () => void;
    let stopped = false;
    let events = 0;
    let continued = false;
    let backpressure = false;
    const acked = Promise.withResolvers<void>();
    const complete = Promise.withResolvers<AgentHostOutput>();
    const delivered = Promise.withResolvers<void>();
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
        if (message.type === AgentHostKind.Event) {
          events++;
          setTimeout(() => {
            backpressure = !continued;
            receive({ type: AgentHostKind.Ack });
            acked.resolve();
          }, 10);
        }
        if (message.type === AgentHostKind.Answer) delivered.resolve();
        if (message.type === AgentHostKind.Answer || message.type === AgentHostKind.Error)
          complete.resolve(message);
      },
    };
    serveAgentHost(
      port,
      () =>
        new FakeBackend(async () => {
          continued = true;
          if (mode === "backend-error")
            throw new OperationalError(ErrorCode.SessionUnavailable, "native missing");
          return { json: { delivered: true } };
        }),
      resources,
    );
    if (mode === "ack") receive({ type: AgentHostKind.Ack });
    else if (mode === "invalid") receive({ unexpected: true });
    else {
      receive(request(root, mode === "resume"));
      if (mode === "duplicate") receive(request(root));
    }
    const result = await complete.promise;
    if (mode === "duplicate") await delivered.promise;
    if (events > 0) await acked.promise;
    disconnect();
    return result.type === AgentHostKind.Answer
      ? {
          answer: result.answer.json,
          resumed: result.answer.session_id === "native-before",
          events,
          stopped,
          backpressure,
        }
      : { failed: true, stopped };
  });
}
export async function hostLease(shared: boolean, resume: boolean) {
  return withTemporaryDirectory(async (root) => {
    await using first = new AsyncDisposableStack();
    await using second = new AsyncDisposableStack();
    const active = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const running = hostTurn(
      request(root, resume),
      () =>
        new FakeBackend(async () => {
          active.resolve();
          await release.promise;
          return {};
        }),
      async () => {},
      first,
    );
    await active.promise;
    try {
      await hostTurn(
        request(shared ? root : resolve(root, "other")),
        () => createFakeBackend(),
        async () => {},
        second,
      );
      return { independent: true };
    } finally {
      release.resolve();
      await running;
    }
  });
}
export function nativeHostPorts(pid: number, connected = true) {
  let receive!: (message: unknown) => void;
  let disconnect!: (message: unknown) => void;
  const messages: unknown[] = [];
  let killed = 0;
  const port = nativeHostPort({
    pid,
    connected,
    on(event, listener) {
      if (event === "message") receive = listener;
      else disconnect = listener;
    },
    send(message) {
      messages.push(message);
    },
    kill(pid) {
      killed = pid;
    },
  });
  port.receive((message) => messages.push(message));
  port.disconnected(() => port.stop());
  const stoppedBeforeMessages = killed !== 0;
  receive({ test: true });
  disconnect(null);
  port.send({ type: AgentHostKind.Ready });
  return { messages, killed, stoppedBeforeMessages };
}
export async function nativeHostComposition(backend: Backend, malformed: boolean) {
  return withTemporaryDirectory(async (root) => {
    const value = request(root);
    value.backend = backend === Backend.Claude ? Backend.Claude : Backend.Codex;
    const adapter = await nativeHostBackend(value);
    let receive!: (message: unknown) => void;
    let disconnect!: () => void;
    let stopped = false;
    const finished = Promise.withResolvers<boolean>();
    await using _resources = startAgentHost({
      receive: (listener) => {
        receive = listener;
      },
      disconnected(listener) {
        disconnect = listener;
      },
      stop() {
        stopped = true;
      },
      send(message) {
        if (message.type === AgentHostKind.Error) finished.resolve(true);
      },
    });
    receive(malformed ? { type: "invalid" } : { type: AgentHostKind.Ack });
    const failed = await finished.promise;
    disconnect();
    if (!stopped) throw new Error("Host entry did not stop after disconnect");
    return { backend: adapter.id, failed };
  });
}
export async function hostTransport(
  mode: string,
  sinkFailure = false,
  prompt: string | null = null,
) {
  return withTemporaryDirectory(async (root) => {
    const signal = new AbortController();
    let events = 0;
    const start = request(root);
    if (prompt !== null) start.prompt = prompt;
    let spawned = false;
    try {
      const answer = await hostedTurn(
        start,
        async () => {
          events++;
          if (sinkFailure) throw new Error("durable sink unavailable");
          if (mode === "abort") signal.abort(new Error("cancelled turn"));
        },
        signal.signal,
        (receive) => {
          spawned = true;
          return Bun.spawn([process.execPath, resolve("testing/fixtures/host-probe.mjs"), mode], {
            detached: true,
            stdin: "ignore",
            stdout: "ignore",
            stderr: "ignore",
            ipc: receive,
            serialization: "json",
          });
        },
        mode === "silent" ? 30 : undefined,
      );
      return { answer: answer.json, events };
    } catch (error) {
      if (prompt !== null && Buffer.byteLength(JSON.stringify(prompt)) > AgentHost.MessageBytes)
        assert.equal(spawned, false);
      throw error;
    }
  });
}

export async function hostPlatform(platform: string) {
  const ready = Promise.withResolvers<void>();
  const child = spawnAgentHost(() => ready.resolve(), platform);
  try {
    await ready.promise;
    return true;
  } finally {
    process.kill(-child.pid, "SIGKILL");
    await child.exited;
  }
}
export async function hostedNative(backend: NativeBackendId, cancel: boolean) {
  return withTemporaryDirectory(async (root) => {
    const adapter = hostedAdapter(backend);
    const spec = agentSpec(root);
    const first = await adapter.start(spec);
    let id = "";
    try {
      const answer = await first.send("complete", async () => {}, AbortSignal.timeout(5000));
      id = answer.session_id;
    } finally {
      await first.close();
    }
    const resumed = await adapter.resume(id, spec);
    try {
      const answer = await resumed.send(
        cancel ? "cancel" : "complete",
        async () => {
          if (cancel) await resumed.cancel("cancelled native");
        },
        AbortSignal.timeout(5000),
      );
      return { preserved: answer.session_id === id, completed: Boolean(answer.json) };
    } finally {
      await resumed.close();
    }
  });
}

function hostedAdapter(backend: NativeBackendId) {
  return new HostedBackend(backend, {
    executable: resolve(
      "testing/fixtures/vendors",
      backend === Backend.Codex ? "codex-0.167.0.mjs" : "claude-0.3.319.mjs",
    ),
    ...(backend === Backend.Claude ? { runtime: AgentRuntime.Bun } : {}),
  });
}

export async function hostedIsolation(backend: NativeBackendId, cancel: boolean) {
  return withTemporaryDirectory((root) =>
    observeVendorIsolation(hostedAdapter(backend), root, cancel, backend === Backend.Claude),
  );
}

export async function hostedShared(backend: NativeBackendId, cancel: boolean) {
  return withTemporaryDirectory(async (root) => {
    const adapter = hostedAdapter(backend);
    const firstSpec = agentSpec(root);
    const secondSpec = agentSpec(root);
    firstSpec.execution_id = "first-shared";
    secondSpec.execution_id = "second-shared";
    firstSpec.file_scope = { mode: FileAccessMode.Write, paths: ["one.txt"] };
    secondSpec.file_scope = { mode: FileAccessMode.Write, paths: ["two.txt"] };
    const first = await adapter.start(firstSpec);
    const second = await adapter.start(secondSpec);
    let firstSeen = false;
    let secondSeen = false;
    let shared = false;
    try {
      const results = await all([
        () =>
          thrownBy(async () => {
            const answer = await first.send(
              "complete",
              async () => {
                firstSeen = true;
                assert.equal(await waitUntil(async () => secondSeen), true);
                if (cancel) await first.cancel("cancelled shared");
              },
              AbortSignal.timeout(5000),
            );
            assert.equal(ObjectSchema.parse(answer.json).marker, root);
          }),
        () =>
          thrownBy(async () => {
            const answer = await second.send(
              "complete",
              async () => {
                secondSeen = true;
                assert.equal(await waitUntil(async () => firstSeen), true);
              },
              AbortSignal.timeout(5000),
            );
            shared = ObjectSchema.parse(answer.json).marker === root;
          }),
      ]);
      assert.equal(results[0] instanceof Error, cancel);
      assert.equal(results[1], undefined);
      return { shared, overlapped: firstSeen && secondSeen, cancelled: cancel };
    } finally {
      await first.close();
      await second.close();
    }
  });
}
