import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
const s = new McpServer({ name: "s", version: "0" });
s.registerTool("io", { inputSchema: { ms: z.number() } }, async ({ ms }) => { await Bun.sleep(ms); return { content: [{ type: "text", text: "ok" }] }; });
s.registerTool("cpu", { inputSchema: { ms: z.number() } }, async ({ ms }) => { Bun.sleepSync(ms); return { content: [{ type: "text", text: "ok" }] }; });
s.registerTool("env", {}, async () => ({ content: [{ type: "text", text: JSON.stringify({ keys: Object.keys(process.env).filter(k => !k.startsWith("BUN") ), canReadHome: await Bun.file(process.env.HOME + "/.gitconfig").exists() }) }] }));
await s.connect(new StdioServerTransport());
