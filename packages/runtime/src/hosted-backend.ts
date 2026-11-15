import { resolve } from "node:path";
import { agentHostEnvironment } from "@titan/config";
import {
  AgentHost,
  AgentHostKind,
  BackendContractVersion,
  ConfigDefault,
  ErrorCode,
  ErrorField,
  MissingProcessCode,
  NativeToolTransport,
  ProcessIo,
  SignalEvent,
} from "@titan/constants";
import { nativeBinding } from "@titan/core";
import { classifyError, OperationalError } from "@titan/errors";
import { AgentHostMessage } from "@titan/messages";
import {
  type AgentAnswer,
  type AgentBackend,
  AgentHostOutputSchema,
  type AgentHostSettings,
  AgentHostSettingsSchema,
  type AgentHostSpawn,
  type AgentHostStart,
  type AgentSession,
  type AgentSpec,
  type ClaudeLaunch,
  type EventSink,
  type NativeBackendId,
  type NativeToolBinding,
  type NativeToolConnection,
  type NativeToolPreflight,
} from "@titan/types";
import { hostFrame, hostProtocolError } from "./host-protocol.ts";

export function spawnAgentHost(
  receive: (message: unknown) => void,
  platform: string = process.platform,
  settings: AgentHostSettings = AgentHostSettingsSchema.parse({}),
) {
  if (platform !== AgentHost.Platform)
    throw new OperationalError(ErrorCode.ExecutionInterrupted, AgentHostMessage.Platform);
  const entry = resolve(
    import.meta.dir,
    import.meta.path.endsWith(AgentHost.SourceExtension) ? AgentHost.Entry : AgentHost.Bundle,
  );
  return Bun.spawn([process.execPath, AgentHost.SmallHeap, entry], {
    detached: true,
    env: agentHostEnvironment(settings.gc_markers, settings.worker_threads),
    stdin: ProcessIo.Ignore,
    stdout: ProcessIo.Ignore,
    stderr: ProcessIo.Ignore,
    ipc: receive,
    serialization: AgentHost.Serialization,
  });
}

async function checkNativeTools(connection: NativeToolConnection, signal: AbortSignal) {
  const { nativeToolReady } = await import("@titan/server/native-tool-client");
  await nativeToolReady(connection, signal);
}

export async function hostedTurn(
  request: AgentHostStart,
  sink: EventSink,
  signal: AbortSignal,
  spawn: AgentHostSpawn = spawnAgentHost,
  startupMilliseconds: number = ConfigDefault.HostStartupMilliseconds,
  preflight: NativeToolPreflight = checkNativeTools,
): Promise<AgentAnswer> {
  signal.throwIfAborted();
  hostFrame(request);
  const result = Promise.withResolvers<AgentAnswer>();
  let ready = false;
  let nativeReady = false;
  let pending: Promise<void> | null = null;
  let done = false;
  const acknowledge = (): void => {
    pending = null;
    if (!signal.aborted && !done) child.send({ type: AgentHostKind.Ack });
  };
  const receive = (raw: unknown): void => {
    const message = AgentHostOutputSchema.parse(hostFrame(raw));
    if (done || pending) throw hostProtocolError();
    if (message.type === AgentHostKind.Ready) {
      if (ready) throw hostProtocolError();
      ready = true;
      clearTimeout(starting);
      child.send(hostFrame(request));
      return;
    }
    if (!ready) throw hostProtocolError();
    if (message.type === AgentHostKind.NativeReady) {
      if (nativeReady || request.native_tools?.transport !== NativeToolTransport.Http)
        throw hostProtocolError();
      nativeReady = true;
      pending = Promise.resolve(request.native_tools.connection)
        .then((connection) => preflight(connection, signal))
        .then(acknowledge)
        .catch((error) => result.reject(classifyError(error)));
      return;
    }
    if (
      request.native_tools?.transport === NativeToolTransport.Http &&
      !nativeReady &&
      message.type !== AgentHostKind.Error
    )
      throw hostProtocolError();
    if (message.type === AgentHostKind.Event) {
      pending = sink(message.event).then(acknowledge).catch(result.reject);
      return;
    }
    done = true;
    if (message.type === AgentHostKind.Answer) result.resolve(message.answer);
    else
      result.reject(
        new OperationalError(
          message.code,
          message.message,
          message.retryable,
          message.retry_after_ms,
        ),
      );
  };
  const child = spawn((raw) => {
    try {
      receive(raw);
    } catch (error) {
      result.reject(error);
    }
  });
  const starting = setTimeout(
    () =>
      result.reject(new OperationalError(ErrorCode.ExecutionInterrupted, AgentHostMessage.Stopped)),
    startupMilliseconds,
  );
  let killed = false;
  const kill = (): void => {
    if (killed) return;
    killed = true;
    try {
      process.kill(-child.pid, AgentHost.Kill);
    } catch (error) {
      if (!(error instanceof Error) || Reflect.get(error, ErrorField.Code) !== MissingProcessCode)
        throw error;
    }
  };
  const abort = (): void => {
    result.reject(signal.reason);
    kill();
  };
  const exited = child.exited.then(() => {
    result.reject(new OperationalError(ErrorCode.ExecutionInterrupted, AgentHostMessage.Stopped));
  });
  signal.addEventListener(SignalEvent.Abort, abort, { once: true });
  if (signal.aborted) abort();
  try {
    return await result.promise;
  } finally {
    done = true;
    clearTimeout(starting);
    signal.removeEventListener(SignalEvent.Abort, abort);
    kill();
    await exited;
    if (pending) await pending;
  }
}

export class HostedBackend implements AgentBackend {
  readonly specificationVersion = BackendContractVersion;
  readonly capabilities = { resume: true, builtinTools: true, structuredOutput: true };
  constructor(
    readonly id: NativeBackendId,
    private launch: ClaudeLaunch,
    private settings: AgentHostSettings = AgentHostSettingsSchema.parse({}),
  ) {}
  private request(
    spec: AgentSpec,
    native: string | null,
    prompt: string,
    binding?: NativeToolBinding,
  ): AgentHostStart {
    return {
      type: AgentHostKind.Start,
      backend: this.id,
      launch: this.launch,
      spec,
      session_id: native,
      prompt,
      ...(binding ? { native_tools: binding } : {}),
    };
  }
  async validateTurn(
    spec: AgentSpec,
    prompt: string,
    sessionId: string | null,
    binding?: NativeToolBinding,
  ): Promise<void> {
    hostFrame(this.request(spec, sessionId, prompt, nativeBinding(spec, binding)));
  }
  private session(
    spec: AgentSpec,
    native: string | null,
    binding?: NativeToolBinding,
  ): AgentSession {
    const bound = nativeBinding(spec, binding);
    const cancellation = new AbortController();
    return {
      send: async (prompt, sink, signal) => {
        const request = this.request(spec, native, prompt, bound);
        const answer = await hostedTurn(
          request,
          sink,
          AbortSignal.any([signal, cancellation.signal]),
          (receive) => spawnAgentHost(receive, process.platform, this.settings),
          this.settings.startup_timeout_ms,
        );
        native = answer.session_id;
        return answer;
      },
      async cancel(reason) {
        cancellation.abort(new Error(reason));
      },
      async close() {
        cancellation.abort();
      },
    };
  }
  async start(spec: AgentSpec, binding?: NativeToolBinding): Promise<AgentSession> {
    return this.session(spec, null, binding);
  }
  async resume(id: string, spec: AgentSpec, binding?: NativeToolBinding): Promise<AgentSession> {
    return this.session(spec, id, binding);
  }
}
