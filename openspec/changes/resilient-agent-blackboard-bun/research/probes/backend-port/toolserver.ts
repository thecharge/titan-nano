import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
const s = new McpServer({ name: "titan", version: "0.0.0" });
s.registerTool("kb_search", { description: "Search the knowledge hub", inputSchema: { question: z.string() } },
  async ({ question }) => ({ content: [{ type: "text", text: `match for: ${question}` }] }));
await s.connect(new StdioServerTransport());
