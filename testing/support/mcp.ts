import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CliCommand, McpIdentity, ProbeOption, RequestLimit } from "@titan/constants";
import { startMcp } from "@titan/server/mcp";

export async function withStdioMcp<T>(
  command: string,
  args: string[],
  use: (client: Client) => Promise<T>,
): Promise<T> {
  const transport = new StdioClientTransport({
    command,
    args,
    maxBufferSize: RequestLimit.InputBytes * 2,
  });
  const client = new Client({ name: McpIdentity.Name, version: McpIdentity.Version });
  try {
    await client.connect(transport);
    return await use(client);
  } finally {
    await client.close();
  }
}

export async function withMemoryMcp<T>(
  home: string,
  use: (client: Client) => Promise<T>,
): Promise<T> {
  await using lifetime = new AsyncDisposableStack();
  const [left, right] = InMemoryTransport.createLinkedPair();
  const server = await startMcp(home, left);
  lifetime.defer(() => server.close());
  const client = new Client({ name: McpIdentity.Name, version: McpIdentity.Version });
  lifetime.defer(() => client.close());
  await client.connect(right);
  return await use(client);
}

export async function withMcp<T>(
  home: string,
  cli: string | undefined,
  use: (client: Client) => Promise<T>,
): Promise<T> {
  if (!cli) return withMemoryMcp(home, use);
  return withStdioMcp(process.execPath, [cli, CliCommand.Mcp, ProbeOption.Home, home], use);
}
