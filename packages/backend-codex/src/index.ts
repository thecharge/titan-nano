import { Codex, type Thread, type ThreadOptions } from "@openai/codex-sdk";
import {
  Backend,
  BackendContractVersion,
  ErrorCode,
  NativeToolTransport,
  SignalEvent,
  TextSymbol,
} from "@titan/constants";
import { emptyUsage, nativeBinding, requireProgram } from "@titan/core";
import { OperationalError } from "@titan/errors";
import { codexPrompt, NativeToolBridgeMessage } from "@titan/messages";
import type {
  AgentBackend,
  AgentSession,
  AgentSpec,
  BackendLaunch,
  CodexClient,
  NativeToolBinding,
  NativeToolEnvironmentFactory,
  NativeToolPreflight,
} from "@titan/types";
import { CodexTurnStateSchema } from "@titan/types/codex-turn";
import { assertCodexEvent, codexAnswer, codexEvent } from "./events.ts";
import { codexClientOptions, codexThreadOptions } from "./options.ts";
export class CodexBackend implements AgentBackend {
  readonly id = Backend.Codex;
  readonly specificationVersion = BackendContractVersion;
  readonly capabilities = { resume: true, builtinTools: true, structuredOutput: true };
  private client: CodexClient<Thread, ThreadOptions> | undefined;
  constructor(
    client?: CodexClient<Thread, ThreadOptions>,
    private launch: BackendLaunch = {},
    private environment?: NativeToolEnvironmentFactory,
    private preflight?: NativeToolPreflight,
  ) {
    this.client = client;
  }
  private session(input: AgentSpec, id: string | null, binding?: NativeToolBinding): AgentSession {
    const spec = structuredClone(input);
    const bound = nativeBinding(spec, binding);
    const preflight = this.preflight;
    const http = bound?.transport === NativeToolTransport.Http;
    if (http && !preflight)
      throw new OperationalError(ErrorCode.PermissionDenied, NativeToolBridgeMessage.Startup);
    if (bound && this.client)
      throw new OperationalError(ErrorCode.PermissionDenied, NativeToolBridgeMessage.Startup);
    const role = spec.role;
    const options = codexThreadOptions(spec);
    const client =
      this.client ?? new Codex(codexClientOptions(spec, this.launch, bound, this.environment));
    const cancellation = new AbortController();
    let session_id = id;
    return {
      async send(prompt, sink, signal) {
        const combined = AbortSignal.any([signal, cancellation.signal]);
        combined.throwIfAborted();
        if (http && bound && preflight) await preflight(bound.connection, combined);
        combined.throwIfAborted();
        const state = CodexTurnStateSchema.parse({
          text: TextSymbol.Empty,
          complete: false,
          session_id,
          usage: emptyUsage(),
        });
        const transport = new AbortController();
        const abort = (): void => transport.abort(combined.reason);
        combined.addEventListener(SignalEvent.Abort, abort, { once: true });
        try {
          const thread = session_id
            ? client.resumeThread(session_id, options)
            : client.startThread(options);
          const stream = await thread.runStreamed(codexPrompt(role, prompt), {
            signal: transport.signal,
            ...(spec.output_schema ? { outputSchema: spec.output_schema } : {}),
          });
          for await (const event of stream.events) {
            combined.throwIfAborted();
            const observed = codexEvent(state, event);
            session_id = state.session_id;
            await sink(observed);
            combined.throwIfAborted();
            assertCodexEvent(event);
          }
          combined.throwIfAborted();
          return codexAnswer(spec, state);
        } finally {
          combined.removeEventListener(SignalEvent.Abort, abort);
        }
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
    if (this.launch.executable) await requireProgram(this.launch.executable, true);
    return this.session(spec, null, binding);
  }
  async resume(id: string, spec: AgentSpec, binding?: NativeToolBinding): Promise<AgentSession> {
    if (this.launch.executable) await requireProgram(this.launch.executable, true);
    return this.session(spec, id, binding);
  }
}
