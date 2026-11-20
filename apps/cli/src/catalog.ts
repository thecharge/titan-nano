import {
  CliCommand,
  CliOption,
  CliPositionals,
  ErrorCode,
  ExitCode,
  SkillCommand,
  TextSymbol,
  WorkflowCommand,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { discoverWorkspaceSkills, showWorkspaceSkill } from "@titan/knowledge";
import { CliDescription, NativeToolBridgeMessage, WebResourceMessage } from "@titan/messages";
import type { CommandDefinition, CommandName } from "@titan/types";
import { artifactDefinition } from "./commands/artifacts.ts";
import { createWorkflow } from "./commands/authoring.ts";
import { configSubcommands } from "./commands/config.ts";
import { dashboardDefinition } from "./commands/dashboard.ts";
import { improveDefinition } from "./commands/improve.ts";
import { inspectHandlers } from "./commands/inspect.ts";
import { installSkill } from "./commands/install.ts";
import { knowledgeDefinition } from "./commands/knowledge.ts";
import { lessonsDefinition } from "./commands/lessons.ts";
import { personaDefinition } from "./commands/personas.ts";
import { plansDefinition } from "./commands/plans.ts";
import { requestDefinitions } from "./commands/requests.ts";
import { runHandlers, runListOptions, validateEventOptions } from "./commands/runs.ts";
import { serviceHandlers } from "./commands/services.ts";
import { updateDefinition } from "./commands/update.ts";
import { workflowHandlers } from "./commands/workflows.ts";

const inspectOptions = [
  CliOption.Home,
  CliOption.Project,
  CliOption.Config,
  CliOption.Backend,
  CliOption.Harness,
  CliOption.FakeScript,
  CliOption.MaxParallel,
  CliOption.Set,
] as const;
const runOptions = [CliOption.Home, CliOption.Watch] as const;
const pending: CommandDefinition = { description: CliDescription.Pending, options: [] };
const catalog = {
  [CliCommand.Update]: updateDefinition,
  [CliCommand.WebRead]: {
    description: WebResourceMessage.Description,
    positionals: CliPositionals.WebRead,
    options: [CliOption.Home],
    handler: async ({ services, home, positionals }) => {
      const [id, url, requestId] = positionals;
      const client = services.client(home);
      if (!id || !url || !client.webRead)
        throw new TitanError(ErrorCode.Arguments, WebResourceMessage.Selection);
      return { data: await client.webRead(id, url, requestId), exitCode: ExitCode.Success };
    },
  },
  [CliCommand.Guide]: {
    description: CliDescription.Guide,
    options: [],
    handler: inspectHandlers.guide,
  },
  [CliCommand.Schema]: {
    description: CliDescription.Schema,
    positionals: CliPositionals.Schema,
    options: [],
    handler: inspectHandlers.schema,
  },
  [CliCommand.Install]: {
    description: CliDescription.Install,
    options: [
      CliOption.Home,
      CliOption.Project,
      CliOption.Harness,
      CliOption.Force,
      CliOption.NoModel,
    ],
    handler: installSkill,
  },
  [CliCommand.Check]: {
    description: CliDescription.Check,
    positionals: CliPositionals.Workflows,
    options: inspectOptions,
    handler: workflowHandlers.check,
  },
  [CliCommand.Run]: {
    description: CliDescription.Run,
    positionals: CliPositionals.Workflow,
    options: [
      ...inspectOptions,
      CliOption.Watch,
      CliOption.Detach,
      CliOption.DryRun,
      CliOption.ClientId,
      CliOption.SubmissionId,
      CliOption.HarnessSessionId,
    ],
    handler: workflowHandlers.run,
  },
  [CliCommand.Resume]: {
    description: CliDescription.Resume,
    positionals: CliPositionals.Run,
    options: [...runOptions, CliOption.Backend],
    handler: runHandlers.resume,
  },
  ...requestDefinitions,
  [CliCommand.Improve]: improveDefinition,
  [CliCommand.Lessons]: lessonsDefinition,
  [CliCommand.Plans]: plansDefinition,
  [CliCommand.Policy]: pending,
  [CliCommand.Traces]: pending,
  [CliCommand.Persona]: personaDefinition,
  [CliCommand.Skill]: {
    description: CliDescription.Skill,
    options: [],
    subcommands: {
      [SkillCommand.List]: {
        description: CliDescription.SkillList,
        options: [CliOption.Project],
        handler: async ({ project, services }) => {
          const catalog = await discoverWorkspaceSkills(project, services.environment);
          return {
            data: [...catalog.values()].map(({ directory: _directory, ...entry }) => entry),
            exitCode: ExitCode.Success,
          };
        },
      },
      [SkillCommand.Show]: {
        description: CliDescription.SkillShow,
        positionals: CliPositionals.Skill,
        options: [CliOption.Project],
        handler: async ({ project, services, positionals }) => ({
          data: await showWorkspaceSkill(
            project,
            services.environment,
            positionals[0] ?? TextSymbol.Empty,
          ),
          exitCode: ExitCode.Success,
        }),
      },
    },
  },
  [CliCommand.Knowledge]: knowledgeDefinition,
  [CliCommand.Workflow]: {
    description: CliDescription.Workflow,
    options: [],
    subcommands: {
      [WorkflowCommand.Create]: {
        description: CliDescription.WorkflowCreate,
        positionals: CliPositionals.Workflow,
        options: [
          CliOption.Home,
          CliOption.Project,
          CliOption.Template,
          CliOption.Worker,
          CliOption.Reviewer,
          CliOption.Skill,
          CliOption.Verify,
        ],
        handler: createWorkflow,
      },
    },
  },
  [CliCommand.Backends]: {
    description: CliDescription.Backends,
    options: [],
    handler: inspectHandlers.backends,
  },
  [CliCommand.Doctor]: {
    description: CliDescription.Doctor,
    options: [CliOption.Home, CliOption.Project, CliOption.FetchModel, CliOption.Backup],
    handler: inspectHandlers.doctor,
  },
  [CliCommand.Serve]: {
    description: CliDescription.Serve,
    options: [CliOption.Home],
    handler: serviceHandlers.serve,
  },
  [CliCommand.Mcp]: {
    description: CliDescription.Mcp,
    options: [CliOption.Home],
    handler: serviceHandlers.mcp,
    protocol: true,
  },
  [CliCommand.Worker]: pending,
  [CliCommand.ToolServer]: {
    description: NativeToolBridgeMessage.Command,
    options: [],
    handler: serviceHandlers.toolServer,
    protocol: true,
  },
  [CliCommand.Trace]: pending,
  [CliCommand.Dashboard]: dashboardDefinition,
  [CliCommand.Proof]: pending,
  [CliCommand.Config]: {
    subcommands: configSubcommands,
    description: CliDescription.Config,
    positionals: CliPositionals.OptionalWorkflow,
    options: inspectOptions,
    handler: workflowHandlers.config,
  },
  [CliCommand.Runs]: {
    description: CliDescription.Runs,
    options: [
      CliOption.Home,
      CliOption.Before,
      CliOption.Limit,
      CliOption.ClientId,
      CliOption.HarnessSessionId,
      CliOption.ProjectPath,
      CliOption.HomeAfter,
      CliOption.State,
      CliOption.Scope,
      CliOption.Project,
    ],
    handler: runHandlers.list,
    validate: runListOptions,
  },
  [CliCommand.Status]: {
    description: CliDescription.Status,
    positionals: CliPositionals.Run,
    options: [...runOptions, CliOption.Compact],
    handler: runHandlers.status,
  },
  [CliCommand.Usage]: {
    description: CliDescription.Usage,
    positionals: CliPositionals.Run,
    options: [CliOption.Home],
    handler: runHandlers.usage,
  },
  [CliCommand.Events]: {
    description: CliDescription.Events,
    positionals: CliPositionals.Run,
    options: [CliOption.Home, CliOption.After, CliOption.Limit, CliOption.Follow, CliOption.Format],
    handler: runHandlers.events,
    validate: validateEventOptions,
  },
  [CliCommand.Pause]: {
    description: CliDescription.Pause,
    positionals: CliPositionals.Run,
    options: runOptions,
    handler: runHandlers.pause,
  },
  [CliCommand.Cancel]: {
    description: CliDescription.Cancel,
    positionals: CliPositionals.Run,
    options: runOptions,
    handler: runHandlers.cancel,
  },
  [CliCommand.Artifacts]: artifactDefinition,
  [CliCommand.Apply]: pending,
} satisfies Record<CommandName, CommandDefinition>;
export const commands = Object.values(CliCommand);
export function commandDefinition(name: string): CommandDefinition | undefined {
  return Object.hasOwn(catalog, name) ? catalog[name as CommandName] : undefined;
}

export function resolveCommand(positionals: readonly string[]) {
  let name = positionals[0] ?? TextSymbol.Empty;
  let definition = commandDefinition(name);
  let depth = 1;
  while (
    definition?.subcommands &&
    positionals[depth] &&
    Object.hasOwn(definition.subcommands, positionals[depth] ?? TextSymbol.Empty)
  ) {
    const child = positionals[depth] ?? TextSymbol.Empty;
    definition = definition.subcommands[child];
    name = [name, child].join(TextSymbol.Space);
    depth++;
  }
  return { name, definition, positionals: positionals.slice(depth) };
}
