import { Codex, type Thread } from "@openai/codex-sdk";
import type { AgentBackend, AgentSpec, AgentSession } from "./port";
function client(spec: AgentSpec) {
  // Tool servers go in as Codex config: [mcp_servers.<name>] command/args/env
  const mcp = Object.fromEntries(spec.toolServers.map(s => [s.name, { command: s.command, args: s.args, env: s.env ?? {} }]));
  return new Codex({ config: { mcp_servers: mcp } });
}
function wrap(t: Thread, spec: AgentSpec): AgentSession {
  let first = true;
  return { async send(prompt) {
    // No system prompt option in the SDK types: the role goes in front of the first prompt.
    const text = first ? `${spec.role}\n\n${prompt}` : prompt; first = false;
    const r = await t.run(text, { outputSchema: spec.outputSchema });
    return { output: JSON.parse(r.finalResponse), sessionId: t.id ?? "" };
  } };
}
export const codexBackend: AgentBackend = {
  id: "codex-sdk",
  capabilities: { systemPrompt: false, builtinTools: true, skills: false, toolServers: true, resume: true, structuredOutput: true },
  start: spec => wrap(client(spec).startThread({ workingDirectory: spec.cwd, model: spec.model, skipGitRepoCheck: true }), spec),
  resume: (id, spec) => wrap(client(spec).resumeThread(id, { workingDirectory: spec.cwd, model: spec.model }), spec),
};
