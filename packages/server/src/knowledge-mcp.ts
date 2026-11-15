import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, KnowledgeTool, McpIdentity } from "@titan/constants";
import { errorMessage, TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import {
  type ClientConnector,
  KnowledgeDeleteSchema,
  KnowledgeInputSchema,
  KnowledgeReindexSchema,
  KnowledgeSearchSchema,
  KnowledgeSelectionSchema,
  KnowledgeUpdateSchema,
} from "@titan/types";
import { createKnowledgeClient } from "./knowledge-client.ts";

function result(value: unknown) {
  return { content: [{ type: McpIdentity.Text, text: JSON.stringify(value) }] };
}

async function operation(work: () => Promise<unknown>) {
  try {
    return result(await work());
  } catch (error) {
    return {
      ...result({
        code: error instanceof TitanError ? error.code : ErrorCode.KnowledgeInvalid,
        error: errorMessage(error),
      }),
      isError: true,
    };
  }
}

export function registerKnowledgeTools(
  server: McpServer,
  home: string,
  connect?: ClientConnector,
): void {
  const client = createKnowledgeClient(home, connect);
  server.registerTool(
    KnowledgeTool.Add,
    { description: KnowledgeMessage.Add, inputSchema: KnowledgeInputSchema },
    async (input) => operation(() => client.add(input)),
  );
  server.registerTool(
    KnowledgeTool.Get,
    { description: KnowledgeMessage.Get, inputSchema: KnowledgeSelectionSchema },
    async ({ id }) => operation(() => client.get(id)),
  );
  server.registerTool(
    KnowledgeTool.Update,
    { description: KnowledgeMessage.Update, inputSchema: KnowledgeUpdateSchema },
    async (input) => operation(() => client.update(input)),
  );
  server.registerTool(
    KnowledgeTool.Delete,
    { description: KnowledgeMessage.Delete, inputSchema: KnowledgeDeleteSchema },
    async (input) => operation(() => client.delete(input)),
  );
  server.registerTool(
    KnowledgeTool.Search,
    { description: KnowledgeMessage.SearchTool, inputSchema: KnowledgeSearchSchema },
    async (input) => operation(() => client.search(input)),
  );
  server.registerTool(
    KnowledgeTool.Reindex,
    { description: KnowledgeMessage.Reindex, inputSchema: KnowledgeReindexSchema },
    async () => operation(() => client.reindex()),
  );
}
