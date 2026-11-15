import type { ProcessIo } from "@titan/constants";
import type { AgentHostOutput, AgentHostStart } from "../agent-host.ts";
import type { AgentBackend } from "./agents.ts";
import type { NativeToolPreflight } from "./native-tools.ts";

export interface AgentHostPort {
  receive(listener: (message: unknown) => void): void;
  disconnected(listener: () => void): void;
  send(message: AgentHostOutput): void;
  stop(): void;
}
export type AgentHostFactory = (
  request: AgentHostStart,
  readiness?: NativeToolPreflight,
) => AgentBackend | Promise<AgentBackend>;
export type AgentHostSpawn = (
  receive: (message: unknown) => void,
) => Bun.Subprocess<ProcessIo.Ignore, ProcessIo.Ignore, ProcessIo.Ignore>;

export interface NativeHostProcess {
  pid: number;
  connected: boolean | undefined;
  on(event: string, listener: (message: unknown) => void): unknown;
  send?(message: unknown): unknown;
  kill(pid: number, signal: NodeJS.Signals): unknown;
}
