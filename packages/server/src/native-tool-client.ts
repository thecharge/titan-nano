import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import {
  ErrorCode,
  HttpHeader,
  LocalServer,
  McpIdentity,
  NativeTool,
  NativeToolPolicy,
  type NativeToolRole,
  TextSymbol,
} from "@titan/constants";
import { settle } from "@titan/core";
import { TitanError } from "@titan/errors";
import { NativeToolBridgeMessage } from "@titan/messages";
import {
  McpTextContentSchema,
  type NativeToolConnection,
  NativeToolConnectionSchema,
  NativeToolReadySchema,
  NativeToolScopeSchema,
} from "@titan/types/native-tools";
import { nativeToolFetch } from "./native-response.ts";

function exactTools(names: readonly string[], role: NativeToolRole): boolean {
  const policy = NativeToolPolicy[role];
  return (
    names.length === policy.length &&
    new Set(names).size === policy.length &&
    names.every((name) => policy.some((allowed) => allowed === name))
  );
}

export async function connectNativeTools(input: unknown, signal?: AbortSignal) {
  const parsed = NativeToolConnectionSchema.safeParse(input);
  if (!parsed.success) throw new TitanError(ErrorCode.Arguments, NativeToolBridgeMessage.Invalid);
  const connection = parsed.data;
  const resources = new AsyncDisposableStack();
  const client = new Client({ name: McpIdentity.Name, version: McpIdentity.Version });
  resources.defer(() => client.close());
  try {
    signal?.throwIfAborted();
    const headers = { [HttpHeader.Authorization]: LocalServer.Bearer + connection.token };
    const remote = new StreamableHTTPClientTransport(new URL(connection.url), {
      requestInit: { headers },
      fetch: nativeToolFetch(connection.timeout_ms),
    });
    const deadline = AbortSignal.timeout(connection.timeout_ms);
    const options = {
      timeout: connection.timeout_ms,
      signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
    };
    await client.connect(remote, options);
    const response = await client.callTool(
      { name: NativeTool.Ready },
      CallToolResultSchema,
      options,
    );
    if (response.isError)
      throw new TitanError(ErrorCode.PermissionDenied, NativeToolBridgeMessage.Startup);
    const content = McpTextContentSchema.parse(response.content);
    const ready = NativeToolReadySchema.parse(JSON.parse(content[0]?.text ?? TextSymbol.Empty));
    const { schema_version: _version, tools, ...binding } = ready;
    const scope = NativeToolScopeSchema.parse(binding);
    if (
      JSON.stringify(scope) !== JSON.stringify(connection.scope) ||
      !exactTools(tools, connection.scope.role)
    )
      throw new TitanError(ErrorCode.PermissionDenied, NativeToolBridgeMessage.Startup);
    const inventory = await client.listTools({}, options);
    if (
      !exactTools(
        inventory.tools.map((tool) => tool.name),
        connection.scope.role,
      )
    )
      throw new TitanError(ErrorCode.PermissionDenied, NativeToolBridgeMessage.Startup);
    return { connection, client, inventory, close: () => resources.disposeAsync() };
  } catch {
    await settle([() => resources.disposeAsync()]);
    throw new TitanError(ErrorCode.ServerUnavailable, NativeToolBridgeMessage.Startup);
  }
}

export async function nativeToolReady(connection: NativeToolConnection, signal: AbortSignal) {
  const remote = await connectNativeTools(connection, signal);
  await remote.close();
}
