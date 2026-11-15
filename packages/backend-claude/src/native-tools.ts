import { setTimeout as pause } from "node:timers/promises";
import type {
  McpHttpServerConfig,
  McpServerStatus,
  Query,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import {
  ClaudeEventKind,
  ClaudeMcpStatus,
  ClaudeNativeTool,
  ErrorCode,
  HttpHeader,
  NativeTool,
  NativeToolBearerReference,
  NativeToolPolicy,
  NativeToolTransport,
  SignalEvent,
} from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { NativeToolBridgeMessage } from "@titan/messages";
import type { NativeToolBinding, NativeToolEnvironmentFactory } from "@titan/types";

function unavailable(): OperationalError {
  return new OperationalError(ErrorCode.ServerUnavailable, NativeToolBridgeMessage.Startup);
}

export function claudeNativeAllowed(binding: NativeToolBinding | undefined, name: string): boolean {
  return (
    binding !== undefined &&
    NativeToolPolicy[binding.connection.scope.role].some(
      (tool) => ClaudeNativeTool.Prefix + tool === name,
    )
  );
}

export function claudeNativeTools(
  binding: NativeToolBinding,
  environment?: NativeToolEnvironmentFactory,
) {
  if (!environment) throw unavailable();
  const transport =
    binding.transport === NativeToolTransport.Http
      ? ({
          type: NativeToolTransport.Http,
          url: binding.connection.url,
          headers: { [HttpHeader.Authorization]: NativeToolBearerReference },
        } satisfies McpHttpServerConfig)
      : { command: binding.launch.command, args: binding.launch.args };
  const mcpServers = {
    [NativeTool.Name]: {
      ...transport,
      timeout: binding.connection.timeout_ms,
      alwaysLoad: true,
    },
  };
  return { env: environment(binding.connection), mcpServers };
}

export async function* claudeNativePrompt(
  prompt: string,
  ready: Promise<void>,
  signal: AbortSignal,
): AsyncGenerator<SDKUserMessage> {
  await ready;
  signal.throwIfAborted();
  yield {
    type: ClaudeEventKind.User,
    message: { role: ClaudeEventKind.User, content: prompt },
    parent_tool_use_id: null,
  };
}

function assertInventory(server: McpServerStatus, binding: NativeToolBinding): void {
  const names =
    server.tools?.map((tool) =>
      tool.name.startsWith(ClaudeNativeTool.Prefix)
        ? tool.name.slice(ClaudeNativeTool.Prefix.length)
        : tool.name,
    ) ?? [];
  const policy = NativeToolPolicy[binding.connection.scope.role];
  if (
    names.length !== policy.length ||
    new Set(names).size !== policy.length ||
    !names.every((name) => policy.some((tool) => tool === name))
  )
    throw unavailable();
}

async function connected(
  query: Query,
  binding: NativeToolBinding,
  signal: AbortSignal,
): Promise<void> {
  await query.initializationResult();
  while (!signal.aborted) {
    const servers = await query.mcpServerStatus();
    const server = servers[0];
    if (servers.length !== 1 || server?.name !== NativeTool.Name) throw unavailable();
    if (server.status === ClaudeMcpStatus.Connected) {
      assertInventory(server, binding);
      return;
    }
    if (server.status !== ClaudeMcpStatus.Pending) throw unavailable();
    await pause(ClaudeNativeTool.PollMilliseconds, undefined, { signal });
  }
  throw unavailable();
}

export async function claudeNativeReady(
  query: Query,
  binding: NativeToolBinding,
  signal: AbortSignal,
): Promise<void> {
  const completion = Promise.withResolvers<void>();
  const cancellation = new AbortController();
  const stop = (): void => {
    cancellation.abort();
    completion.reject(unavailable());
  };
  const timer = setTimeout(stop, binding.connection.timeout_ms);
  signal.addEventListener(SignalEvent.Abort, stop, { once: true });
  if (signal.aborted) stop();
  void connected(query, binding, cancellation.signal).then(completion.resolve, () =>
    completion.reject(unavailable()),
  );
  try {
    await completion.promise;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener(SignalEvent.Abort, stop);
    cancellation.abort();
  }
}
