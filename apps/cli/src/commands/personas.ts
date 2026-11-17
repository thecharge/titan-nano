import {
  CliOption,
  CliPositionals,
  CliRuntime,
  ErrorCode,
  ExitCode,
  KnowledgeScope,
  PersonaCommand,
  PersonaState,
  TextSymbol,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { inspectPersona, listPersonaVersions, projectHubHome } from "@titan/knowledge";
import { CliDescription, CliDiagnostic, KnowledgeMessage } from "@titan/messages";
import { type CommandDefinition, KnowledgeScopeSchema } from "@titan/types";
import { createPersona } from "./authoring.ts";

export const personaDefinition: CommandDefinition = {
  description: CliDescription.Persona,
  options: [CliOption.Home],
  subcommands: {
    [PersonaCommand.Create]: {
      description: CliDescription.PersonaCreate,
      options: [CliOption.Home, CliOption.Tool, CliOption.Skill],
      positionals: CliPositionals.KnowledgeFile,
      handler: createPersona,
    },
    [PersonaCommand.List]: {
      description: CliDescription.PersonaList,
      options: [CliOption.Home, CliOption.Project, CliOption.Scope],
      handler: async ({ home, project, options }) => {
        const selected = KnowledgeScopeSchema.safeParse(options.scope ?? KnowledgeScope.Home);
        if (!selected.success)
          throw new TitanError(ErrorCode.Arguments, CliDiagnostic.PersonaScope);
        const scope = selected.data;
        const local = scope === KnowledgeScope.Project;
        const versions = await listPersonaVersions(local ? projectHubHome(project) : home);
        return {
          data: {
            scope,
            versions: versions.map(({ reference, ...record }) => ({
              ...record,
              reference,
              use:
                record.state === PersonaState.Deleted
                  ? null
                  : local
                    ? `${scope}${TextSymbol.Colon}${reference}`
                    : reference,
            })),
          },
          exitCode: ExitCode.Success,
        };
      },
    },
    [PersonaCommand.Show]: {
      description: CliDescription.PersonaShow,
      positionals: CliPositionals.Persona,
      options: [CliOption.Home, CliOption.Before, CliOption.Limit],
      handler: async ({ home, positionals, options }) => {
        for (const value of [options.before, options.limit])
          if (value !== undefined && !CliRuntime.PositiveIntegerPattern.test(value))
            throw new TitanError(ErrorCode.Arguments, KnowledgeMessage.PersonaInspection);
        return {
          data: await inspectPersona(home, {
            selector: positionals[0] ?? TextSymbol.Empty,
            ...(options.before === undefined ? {} : { before: Number(options.before) }),
            ...(options.limit === undefined ? {} : { limit: Number(options.limit) }),
          }),
          exitCode: ExitCode.Success,
        };
      },
    },
  },
};
