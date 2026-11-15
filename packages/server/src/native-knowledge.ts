import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, KnowledgeTool, McpIdentity, NativeToolRole } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage, NativeToolMessage } from "@titan/messages";
import {
  type KnowledgeNativeHub,
  KnowledgeSearchSchema,
  KnowledgeSelectionSchema,
  KnowledgeViewAddSchema,
  KnowledgeViewDeleteSchema,
  KnowledgeViewUpdateSchema,
  type NativeToolScope,
} from "@titan/types";

export function nativeToolResult(value: unknown) {
  return { content: [{ type: McpIdentity.Text, text: JSON.stringify(value) }] };
}

export async function nativeToolOperation(work: () => Promise<unknown>) {
  try {
    return nativeToolResult(await work());
  } catch (error) {
    return {
      ...nativeToolResult({
        code: error instanceof TitanError ? error.code : ErrorCode.KnowledgeInvalid,
        error: error instanceof TitanError ? error.message : NativeToolMessage.Unavailable,
      }),
      isError: true,
    };
  }
}

export function registerNativeKnowledge(
  server: McpServer,
  hub: KnowledgeNativeHub,
  input: NativeToolScope,
): void {
  const { execution_id: _execution, role, ...scope } = input;
  const worker = role === NativeToolRole.Worker;
  const view = hub.view(scope);
  server.registerTool(
    KnowledgeTool.Get,
    { description: KnowledgeMessage.Get, inputSchema: KnowledgeSelectionSchema },
    async ({ id }) => nativeToolOperation(() => (worker ? view.get(id) : hub.get(id))),
  );
  server.registerTool(
    KnowledgeTool.Search,
    { description: KnowledgeMessage.SearchTool, inputSchema: KnowledgeSearchSchema },
    async (query) => nativeToolOperation(() => (worker ? view.search(query) : hub.search(query))),
  );
  if (!worker) return;
  server.registerTool(
    KnowledgeTool.Add,
    { description: KnowledgeMessage.Add, inputSchema: KnowledgeViewAddSchema },
    async (change) => nativeToolOperation(() => view.add(change)),
  );
  server.registerTool(
    KnowledgeTool.Update,
    { description: KnowledgeMessage.Update, inputSchema: KnowledgeViewUpdateSchema },
    async (change) => nativeToolOperation(() => view.update(change)),
  );
  server.registerTool(
    KnowledgeTool.Delete,
    { description: KnowledgeMessage.Delete, inputSchema: KnowledgeViewDeleteSchema },
    async (change) => nativeToolOperation(() => view.delete(change)),
  );
}
