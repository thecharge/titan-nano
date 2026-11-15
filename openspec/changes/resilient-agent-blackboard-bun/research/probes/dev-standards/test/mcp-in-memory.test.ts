import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

test("a tool server can be tested in memory, with no process and no network", async () => {
	const server = new McpServer({ name: "kb", version: "0.0.0" });
	server.registerTool(
		"kb_search",
		{ inputSchema: { q: z.string() } },
		async ({ q }) => ({ content: [{ type: "text", text: `hits for ${q}` }] }),
	);
	const [ct, st] = InMemoryTransport.createLinkedPair();
	await server.connect(st);
	const client = new Client({ name: "test", version: "0.0.0" });
	await client.connect(ct);
	const tools = await client.listTools();
	expect(tools.tools.map((t) => t.name)).toEqual(["kb_search"]);
	const r: any = await client.callTool({
		name: "kb_search",
		arguments: { q: "wilson" },
	});
	expect(r.content[0].text).toBe("hits for wilson");
});
