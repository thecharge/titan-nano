import type { BackendContractVersion } from "@titan/constants";
import type {
  AgentAnswer,
  AgentEvent,
  AgentSpec,
  BackendCapabilities,
  BackendId,
} from "../agents.ts";
import type { EffectiveConfig } from "../config.ts";
import type { NativeToolBinding } from "../native-tool-launch.ts";

export type EventSink = (event: AgentEvent) => Promise<void>;
export type SessionIdSink = (id: string | null) => void;
export interface AgentSession {
  send(prompt: string, sink: EventSink, signal: AbortSignal): Promise<AgentAnswer>;
  cancel(reason: string): Promise<void>;
  close(): Promise<void>;
}
export interface AgentBackend {
  id: BackendId;
  specificationVersion: typeof BackendContractVersion;
  capabilities: BackendCapabilities;
  validateTurn?(
    spec: AgentSpec,
    prompt: string,
    sessionId: string | null,
    native?: NativeToolBinding,
  ): Promise<void>;
  start(spec: AgentSpec, native?: NativeToolBinding): Promise<AgentSession>;
  resume(sessionId: string, spec: AgentSpec, native?: NativeToolBinding): Promise<AgentSession>;
}
export type BackendFactory = (id: BackendId, config?: EffectiveConfig) => AgentBackend;
export type FakeHandler = (
  spec: AgentSpec,
  prompt: string,
  signal: AbortSignal,
  sink: EventSink,
) => Promise<Partial<AgentAnswer>>;

export interface CodexClient<TThread, TOptions> {
  startThread(options?: TOptions): TThread;
  resumeThread(id: string, options?: TOptions): TThread;
}
