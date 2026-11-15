import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
process.env.FAKE_GH_TOKEN = "secret";
const c = new Client({ name: "c", version: "0" });
await c.connect(new StdioClientTransport({ command: "bun", args: [import.meta.dir + "/mcp-srv.ts"] }));
for (const tool of ["io", "cpu"]) {
  const s = performance.now();
  await Promise.all(Array.from({ length: 20 }, () => c.callTool({ name: tool, arguments: { ms: 100 } })));
  console.log(`20 concurrent calls of 100 ms '${tool}' tool over one stdio connection: ${(performance.now() - s).toFixed(0)} ms`);
}
console.log("server sees:", (await c.callTool({ name: "env", arguments: {} }) as any).content[0].text);
await c.close();
