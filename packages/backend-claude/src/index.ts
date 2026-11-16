import { type Options, type Query, query } from "@anthropic-ai/claude-agent-sdk";
import {
  AgentTool,
  Backend,
  BackendContractVersion,
  ClaudePermission,
  ClaudeToolPolicy,
  ErrorCode,
  NativeToolTransport,
  SignalEvent,
  StructuredOutputKind,
} from "@titan/constants";
import { nativeBinding, requireProgram } from "@titan/core";
import { OperationalError } from "@titan/errors";
import { ClaudeMessage, NativeToolBridgeMessage, nativeWriteRole } from "@titan/messages";
import type {
  AgentBackend,
  AgentSession,
  AgentSpec,
  ClaudeLaunch,
  NativeToolBinding,
  NativeToolEnvironmentFactory,
  NativeToolPreflight,
} from "@titan/types";
import { claudeTurn } from "./events.ts";
import { claudeNativePrompt, claudeNativeReady, claudeNativeTools } from "./native-tools.ts";
import { claudeHooks, claudePermission } from "./options.ts";
import { ClaudeShellSandbox } from "./sandbox.ts";

export class ClaudeBackend implements AgentBackend {
  readonly id = Backend.Claude;
  readonly specificationVersion = BackendContractVersion;
  readonly capabilities = { resume: true, builtinTools: true, structuredOutput: true };
  constructor(
    private invoke: typeof query = query,
    private launch: ClaudeLaunch = {},
    private environment?: NativeToolEnvironmentFactory,
    private preflight?: NativeToolPreflight,
  ) {}
  private session(input: AgentSpec, id: string | null, binding?: NativeToolBinding): AgentSession {
    const spec = structuredClone(input);
    const bound = nativeBinding(spec, binding);
    const preflight = this.preflight;
    const http = bound?.transport === NativeToolTransport.Http;
    if (http && !preflight)
      throw new OperationalError(ErrorCode.PermissionDenied, NativeToolBridgeMessage.Startup);
    const native = bound ? claudeNativeTools(bound, this.environment) : { mcpServers: {} };
    const supported: readonly string[] = spec.writable
      ? ClaudeToolPolicy.Writable
      : ClaudeToolPolicy.ReadOnly;
    if (spec.tools.some((tool) => !supported.includes(tool)))
      throw new OperationalError(ErrorCode.PermissionDenied, ClaudeMessage.UnsupportedTools);
    const tools = spec.tools;
    const scope = spec.file_scope;
    const sandbox =
      scope && tools.includes(AgentTool.Bash) ? new ClaudeShellSandbox(spec) : undefined;
    const abortController = new AbortController();
    let stream: Query | null = null;
    let session_id = id;
    function closeStream(): void {
      stream?.close();
      stream = null;
    }
    return {
      send: async (prompt, sink, signal) => {
        const combined = AbortSignal.any([signal, abortController.signal]);
        combined.throwIfAborted();
        if (http && bound && preflight) await preflight(bound.connection, combined);
        combined.throwIfAborted();
        const abort = (): void => abortController.abort(signal.reason);
        signal.addEventListener(SignalEvent.Abort, abort, { once: true });
        const ready = Promise.withResolvers<void>();
        let released = bound === undefined;
        const outputFormat = spec.output_schema
          ? { type: StructuredOutputKind.JsonSchema, schema: spec.output_schema }
          : undefined;
        const options: Options = {
          ...(this.launch.executable ? { pathToClaudeCodeExecutable: this.launch.executable } : {}),
          ...(this.launch.runtime ? { executable: this.launch.runtime } : {}),
          cwd: spec.cwd,
          systemPrompt: spec.writable && scope && bound ? nativeWriteRole(spec.role) : spec.role,
          tools,
          settingSources: [],
          ...native,
          strictMcpConfig: true,
          hooks: claudeHooks(spec.cwd, tools, combined, bound, scope, sandbox),
          permissionMode: ClaudePermission.Default,
          persistSession: true,
          abortController,
          maxTurns: spec.max_turns,
          ...(spec.model ? { model: spec.model } : {}),
          ...(session_id ? { resume: session_id } : {}),
          ...(outputFormat ? { outputFormat } : {}),
          canUseTool: claudePermission(spec.cwd, tools, combined, bound, scope, sandbox),
        };
        try {
          stream = this.invoke({
            prompt: bound ? claudeNativePrompt(prompt, ready.promise, combined) : prompt,
            options,
          });
          if (bound) {
            await claudeNativeReady(stream, bound, combined);
            released = true;
            ready.resolve();
          }
          return await claudeTurn(stream, sink, combined, session_id, (id) => {
            session_id = id;
          });
        } finally {
          if (!released) {
            abortController.abort(
              new OperationalError(ErrorCode.ServerUnavailable, NativeToolBridgeMessage.Startup),
            );
            ready.resolve();
          }
          signal.removeEventListener(SignalEvent.Abort, abort);
          closeStream();
        }
      },
      async cancel(reason) {
        abortController.abort(new Error(reason));
        closeStream();
        await sandbox?.close();
      },
      async close() {
        abortController.abort();
        closeStream();
        await sandbox?.close();
      },
    };
  }
  async start(spec: AgentSpec, binding?: NativeToolBinding): Promise<AgentSession> {
    if (this.launch.executable) await requireProgram(this.launch.executable, false);
    return this.session(spec, null, binding);
  }
  async resume(id: string, spec: AgentSpec, binding?: NativeToolBinding): Promise<AgentSession> {
    if (this.launch.executable) await requireProgram(this.launch.executable, false);
    return this.session(spec, id, binding);
  }
}
