// The common interface ("port") that every backend adapter must fit.
export type ToolServer = { name: string; command: string; args: string[]; env?: Record<string, string> };
export type AgentSpec = {
  role: string; model?: string; tools?: string[]; skills?: string[];
  toolServers: ToolServer[]; cwd: string; outputSchema: Record<string, unknown>;
};
export type Capabilities = {
  systemPrompt: boolean; builtinTools: boolean; skills: boolean;
  toolServers: boolean; resume: boolean; structuredOutput: boolean;
};
export type TurnResult = { output: unknown; sessionId: string };
export interface AgentSession { send(prompt: string): Promise<TurnResult> }
export interface AgentBackend {
  id: string;
  capabilities: Capabilities;
  start(spec: AgentSpec): AgentSession;
  resume(sessionId: string, spec: AgentSpec): AgentSession;
}
