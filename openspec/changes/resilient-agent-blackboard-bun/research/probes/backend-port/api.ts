import { generateText, Output, jsonSchema, stepCountIs, type LanguageModel, type ModelMessage } from "ai";
import { createMCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import type { AgentBackend, AgentSpec, AgentSession } from "./port";
function apiBackend(id: string, make: (m: string) => LanguageModel, defaultModel: string): AgentBackend {
  const session = (spec: AgentSpec, history: ModelMessage[] = []): AgentSession => ({
    async send(prompt) {
      const clients = await Promise.all(spec.toolServers.map(s =>
        createMCPClient({ transport: new Experimental_StdioMCPTransport({ command: s.command, args: s.args, env: s.env }) })));
      const tools = Object.assign({}, ...(await Promise.all(clients.map(c => c.tools()))));
      history.push({ role: "user", content: prompt });
      const r = await generateText({
        model: make(spec.model ?? defaultModel), system: spec.role, messages: history, tools,
        stopWhen: stepCountIs(20), output: Output.object({ schema: jsonSchema(spec.outputSchema as any) }),
      });
      history.push(...r.response.messages);
      await Promise.all(clients.map(c => c.close()));
      return { output: r.output, sessionId: id };
    },
  });
  return {
    id,
    capabilities: { systemPrompt: true, builtinTools: false, skills: false, toolServers: true, resume: false, structuredOutput: true },
    start: spec => session(spec), resume: (_id, spec) => session(spec),
  };
}
export const backends = [
  apiBackend("anthropic-api", m => anthropic(m), "model-set-in-workflow"),
  apiBackend("openai-api", m => openai(m), "model-set-in-workflow"),
  apiBackend("gemini-api", m => google(m), "model-set-in-workflow"),
];
