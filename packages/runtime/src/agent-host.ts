import { nativeAgentEnvironment } from "@titan/config/native-tools";
import { AgentHost, Backend, NativeToolTransport } from "@titan/constants";
import type { AgentHostFactory, AgentHostPort, NativeHostProcess } from "@titan/types";
import { hostProtocolError } from "./host-protocol.ts";
import { serveAgentHost } from "./host-service.ts";

export const nativeHostBackend: AgentHostFactory = async (request, readiness) => {
  const ready =
    readiness ??
    (request.native_tools?.transport === NativeToolTransport.Http
      ? (await import("@titan/server/native-tool-client")).nativeToolReady
      : undefined);
  if (request.backend === Backend.Codex) {
    const { CodexBackend } = await import("@titan/backend-codex");
    return new CodexBackend(undefined, request.launch, nativeAgentEnvironment, ready);
  }
  const { ClaudeBackend } = await import("@titan/backend-claude");
  return new ClaudeBackend(undefined, request.launch, nativeAgentEnvironment, ready);
};

export function startAgentHost(port: AgentHostPort): AsyncDisposableStack {
  const resources = new AsyncDisposableStack();
  serveAgentHost(port, nativeHostBackend, resources);
  return resources;
}

export function nativeHostPort(source: NativeHostProcess = process): AgentHostPort {
  if (!Number.isSafeInteger(source.pid) || source.pid <= 1) throw hostProtocolError();
  return {
    receive: (listener) => {
      source.on(AgentHost.Message, listener);
    },
    disconnected: (listener) => {
      source.on(AgentHost.Disconnect, listener);
      if (!source.connected) listener();
    },
    send: (message) => {
      source.send?.(message);
    },
    stop: () => {
      source.kill(-source.pid, AgentHost.Kill);
    },
  };
}

if (import.meta.main) startAgentHost(nativeHostPort());
