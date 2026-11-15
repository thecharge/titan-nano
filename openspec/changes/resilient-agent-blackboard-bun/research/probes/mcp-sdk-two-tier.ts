import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ToolListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
const server = new McpServer({ name: "s", version: "0.0.1" });
server.registerTool("div", { description: "divide", inputSchema: { a: z.number(), b: z.number() } },
  async ({ a, b }) => b === 0
    ? { isError: true, content: [{ type: "text", text: JSON.stringify({ retryable: true, fix: "call div with b != 0" }) }] }
    : { content: [{ type: "text", text: String(a / b) }] });
const [ct, st] = InMemoryTransport.createLinkedPair();
await server.connect(st);
const client = new Client({ name: "c", version: "0.0.1" });
let changed = 0;
client.setNotificationHandler(ToolListChangedNotificationSchema, async () => { changed++; });
await client.connect(ct);
console.log("tools/list:", (await client.listTools()).tools.map(t => t.name));
console.log("ok:", JSON.stringify(await client.callTool({ name: "div", arguments: { a: 6, b: 3 } })));
console.log("tier2:", JSON.stringify(await client.callTool({ name: "div", arguments: { a: 6, b: 0 } })));
try { console.log("unknown-tool result:", JSON.stringify(await client.callTool({ name: "nope", arguments: {} }))); } catch (e: any) { console.log("tier1 thrown:", e.code, e.message); }
try { console.log("bad-args result:", JSON.stringify(await client.callTool({ name: "div", arguments: { a: "x" } }))); } catch (e: any) { console.log("bad-args thrown:", e.code, e.message); }
try { await (client as any).request({ method: "no/such" }, (await import("zod")).z.any()); } catch (e: any) { console.log("unknown method thrown:", e.code, e.message); }
server.registerTool("added", { description: "new" }, async () => ({ content: [{ type: "text", text: "x" }] }));
await new Promise(r => setTimeout(r, 50));
console.log("list_changed received:", changed, "now:", (await client.listTools()).tools.map(t => t.name));
