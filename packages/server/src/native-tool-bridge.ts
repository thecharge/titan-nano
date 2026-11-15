import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  type CallToolRequest,
  CallToolRequestSchema,
  CallToolResultSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { nativeToolConnection } from "@titan/config/native-tools";
import { ErrorCode, McpIdentity, NativeToolPolicy } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { NativeToolBridgeMessage } from "@titan/messages";
import {
  type NativeToolBridge,
  type NativeToolConnection,
  NativeToolConnectionSchema,
} from "@titan/types/native-tools";
import { NativeStdioTransport } from "./native-stdio.ts";
import { connectNativeTools } from "./native-tool-client.ts";

export { nativeToolFetch } from "./native-response.ts";
export { NativeStdioTransport } from "./native-stdio.ts";

export async function startNativeToolServer(
  input: unknown,
  transport?: Transport,
): Promise<NativeToolBridge> {
  const parsed = NativeToolConnectionSchema.safeParse(input);
  if (!parsed.success) throw new TitanError(ErrorCode.Arguments, NativeToolBridgeMessage.Invalid);
  const connection = parsed.data;
  const resources = new AsyncDisposableStack();
  const finished = Promise.withResolvers<void>();
  let stopping: Promise<void> | undefined;
  const close = () => {
    stopping ??= Promise.resolve().then(() => resources.disposeAsync());
    void stopping.then(finished.resolve, finished.reject);
    return stopping;
  };
  try {
    const remote = await connectNativeTools(connection);
    resources.defer(remote.close);
    const { client, inventory } = remote;
    const capabilities = { tools: {} };
    const server = new McpServer(
      { name: McpIdentity.Name, version: McpIdentity.Version },
      { capabilities },
    );
    resources.defer(() => server.close());
    server.server.setRequestHandler(ListToolsRequestSchema, async () => inventory);
    server.server.setRequestHandler(CallToolRequestSchema, async (request) =>
      callNativeTool(client, connection, request),
    );
    server.server.onclose = () => {
      void close();
    };
    await server.connect(
      transport ?? new NativeStdioTransport(process.stdin, process.stdout, connection.timeout_ms),
    );
    return { closed: finished.promise, close };
  } catch {
    await close().catch(finished.reject);
    await finished.promise.catch(finished.resolve);
    throw new TitanError(ErrorCode.ServerUnavailable, NativeToolBridgeMessage.Startup);
  }
}

async function callNativeTool(
  client: Client,
  connection: NativeToolConnection,
  request: CallToolRequest,
) {
  if (!NativeToolPolicy[connection.scope.role].some((name) => name === request.params.name))
    throw new TitanError(ErrorCode.PermissionDenied, NativeToolBridgeMessage.Denied);
  return client.callTool(request.params, CallToolResultSchema, { timeout: connection.timeout_ms });
}

export async function serveNativeToolServer(
  input: unknown = nativeToolConnection(),
  transport?: Transport,
): Promise<void> {
  const server = await startNativeToolServer(input, transport);
  await server.closed;
}

if (import.meta.main) await serveNativeToolServer();
