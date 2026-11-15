import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApprovalLevel, ErrorCode, McpIdentity, RequestState } from "@titan/constants";
import { errorMessage, TitanError } from "@titan/errors";
import { RequestMessage } from "@titan/messages";
import {
  type ClientConnector,
  type ClientRuntimeRecovery,
  McpRequestOpenSchema,
  McpRequestReadSchema,
  McpRequestResultSchema,
  type OperationRequest,
  RequestAnswerSubmissionSchema,
  RequestEscalationSubmissionSchema,
  RequestListQuerySchema,
} from "@titan/types";
import { createRequestClient } from "./request-client.ts";

function result(value: unknown) {
  return { content: [{ type: McpIdentity.Text, text: JSON.stringify(value) }] };
}

async function operation(work: () => Promise<unknown>) {
  try {
    return result(await work());
  } catch (error) {
    return {
      ...result({
        code: error instanceof TitanError ? error.code : ErrorCode.InvalidRequest,
        error: errorMessage(error),
      }),
      isError: true,
    };
  }
}

function requestOperation(work: () => Promise<OperationRequest>) {
  return operation(async () => {
    const request = await work();
    return McpRequestResultSchema.parse({
      state: request.answer === null ? RequestState.Waiting : RequestState.Answered,
      request,
    });
  });
}

export function registerRequestTools(
  server: McpServer,
  home: string,
  connect?: ClientConnector,
  recover?: ClientRuntimeRecovery,
): void {
  const client = createRequestClient(home, connect, recover);
  server.registerTool(
    McpIdentity.RequestEscalate,
    { description: RequestMessage.EscalateTool, inputSchema: RequestEscalationSubmissionSchema },
    async (input) => requestOperation(() => client.escalate(input)),
  );
  server.registerTool(
    McpIdentity.Requests,
    { description: RequestMessage.ListTool, inputSchema: RequestListQuerySchema },
    async (query) => operation(() => client.list(query)),
  );
  server.registerTool(
    McpIdentity.RequestOpen,
    { description: RequestMessage.OpenTool, inputSchema: McpRequestOpenSchema },
    async ({ run_id, input }) => requestOperation(() => client.open(run_id, input)),
  );
  server.registerTool(
    McpIdentity.RequestRead,
    { description: RequestMessage.ReadTool, inputSchema: McpRequestReadSchema },
    async ({ run_id, request_id }) => requestOperation(() => client.get(run_id, request_id)),
  );
  server.registerTool(
    McpIdentity.RequestAnswer,
    { description: RequestMessage.AnswerTool, inputSchema: RequestAnswerSubmissionSchema },
    async (input) => requestOperation(() => client.answer(input, ApprovalLevel.Main)),
  );
}
