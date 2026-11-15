import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { resolveConfig, workflowSettings } from "@titan/config";
import { CliCommand, ErrorCode, McpIdentity, RunAction } from "@titan/constants";
import { errorMessage, TitanError } from "@titan/errors";
import { RunnerMessage, runOperationDescription, ServerMessage } from "@titan/messages";
import {
  type ClientConnector,
  type ClientRuntimeRecovery,
  EventQuerySchema,
  McpArtifactSchema,
  McpCheckFields,
  McpRunFields,
  McpRunSelectorFields,
  RunListQuerySchema,
} from "@titan/types";

import { validatePlanTools, validateWorkflow, workflowJsonSchema } from "@titan/workflow";
import { createRunClient } from "./client.ts";
import { registerKnowledgeTools } from "./knowledge-mcp.ts";
import { registerRequestTools } from "./request-mcp.ts";

export function createMcp(
  home: string,
  connect?: ClientConnector,
  recover?: ClientRuntimeRecovery,
): McpServer {
  const server = new McpServer({ name: McpIdentity.Name, version: McpIdentity.Version });
  registerRequestTools(server, home, connect, recover);
  registerKnowledgeTools(server, home, connect);
  const runs = createRunClient(home, connect, recover);
  const result = (value: unknown) => ({
    content: [{ type: McpIdentity.Text, text: JSON.stringify(value) }],
  });
  server.registerTool(
    McpIdentity.Config,
    { description: ServerMessage.Config, inputSchema: McpRunSelectorFields },
    async ({ run_id }) => result(await runs.configuration(run_id)),
  );
  server.registerTool(
    McpIdentity.Usage,
    { description: runOperationDescription(CliCommand.Usage), inputSchema: McpRunSelectorFields },
    async ({ run_id }) => result(await runs.usage(run_id)),
  );
  server.registerTool(
    McpIdentity.Artifact,
    {
      description: ServerMessage.Artifact,
      inputSchema: McpArtifactSchema,
    },
    async ({ run_id, artifact_id, offset, limit }) => {
      try {
        return result(await runs.artifact(run_id, artifact_id, { offset, limit }));
      } catch (error) {
        return {
          ...result({
            code: error instanceof TitanError ? error.code : ErrorCode.ArtifactInvalid,
            error: errorMessage(error),
          }),
          isError: true,
        };
      }
    },
  );
  server.registerTool(
    McpIdentity.Schema,
    {
      description: ServerMessage.Schema,
      inputSchema: {},
    },
    async () => result(workflowJsonSchema()),
  );
  server.registerTool(
    McpIdentity.Check,
    {
      description: ServerMessage.Check,
      inputSchema: McpCheckFields,
    },
    async ({ workflow, project, backend }) => {
      const overrides = backend ? { defaults: { backend } } : undefined;
      const config = await resolveConfig({
        home,
        project: resolve(project ?? home),
        workflow: workflowSettings(workflow),
        ...(overrides ? { overrides } : {}),
      });
      const plan = validateWorkflow(workflow, config.value.limits.max_group_depth);
      if (plan.nodes.length > config.value.limits.max_steps)
        throw new TitanError(ErrorCode.StepLimit, RunnerMessage.StepLimit);
      validatePlanTools(plan, config.value.defaults.backend ?? undefined);
      return result(plan);
    },
  );
  server.registerTool(
    McpIdentity.Run,
    {
      description: ServerMessage.Run,
      inputSchema: McpRunFields,
    },
    async (input) => result(await runs.submit(input)),
  );
  server.registerTool(
    McpIdentity.Runs,
    { description: ServerMessage.Runs, inputSchema: RunListQuerySchema },
    async (query) => result(await runs.list(query)),
  );
  server.registerTool(
    McpIdentity.Events,
    {
      description: runOperationDescription(CliCommand.Events),
      inputSchema: { ...McpRunSelectorFields, ...EventQuerySchema.shape },
    },
    async ({ run_id, after, limit }) => result(await runs.events(run_id, { after, limit })),
  );
  server.registerTool(
    McpIdentity.Artifacts,
    {
      description: runOperationDescription(CliCommand.Artifacts),
      inputSchema: McpRunSelectorFields,
    },
    async ({ run_id }) => {
      try {
        return result(await runs.artifacts(run_id));
      } catch (error) {
        return {
          ...result({
            code: error instanceof TitanError ? error.code : ErrorCode.ArtifactInvalid,
            error: errorMessage(error),
          }),
          isError: true,
        };
      }
    },
  );
  for (const action of [CliCommand.Status, ...Object.values(RunAction)] as const) {
    server.registerTool(
      `${McpIdentity.Prefix}${action}`,
      {
        description: runOperationDescription(action),
        inputSchema: McpRunSelectorFields,
      },
      async ({ run_id }) => {
        return result(
          action === CliCommand.Status
            ? await runs.get(run_id)
            : await runs.control(run_id, action),
        );
      },
    );
  }
  return server;
}
export async function startMcp(
  home: string,
  transport: Transport = new StdioServerTransport(),
  connect?: ClientConnector,
  recover?: ClientRuntimeRecovery,
): Promise<McpServer> {
  const server = createMcp(home, connect, recover);
  await server.connect(transport);
  return server;
}
