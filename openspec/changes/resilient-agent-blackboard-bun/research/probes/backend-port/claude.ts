import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import type { AgentBackend, AgentSpec, AgentSession } from "./port";
function opts(spec: AgentSpec, resume?: string): Options {
  return {
    cwd: spec.cwd, model: spec.model, systemPrompt: spec.role, tools: spec.tools, skills: spec.skills,
    mcpServers: Object.fromEntries(spec.toolServers.map(s => [s.name, { type: "stdio" as const, command: s.command, args: s.args, env: s.env }])),
    outputFormat: { type: "json_schema", schema: spec.outputSchema }, resume,
  };
}
function session(spec: AgentSpec, first?: string): AgentSession {
  let id = first;
  return { async send(prompt) {
    for await (const m of query({ prompt, options: opts(spec, id) })) {
      if (m.type === "result" && m.subtype === "success") { id = m.session_id; return { output: m.structured_output, sessionId: m.session_id }; }
    }
    throw new Error("no result");
  } };
}
export const claudeBackend: AgentBackend = {
  id: "claude-sdk",
  capabilities: { systemPrompt: true, builtinTools: true, skills: true, toolServers: true, resume: true, structuredOutput: true },
  start: spec => session(spec), resume: (id, spec) => session(spec, id),
};
