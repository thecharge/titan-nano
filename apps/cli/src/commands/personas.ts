import {
  CliOption,
  CliPositionals,
  CliRuntime,
  ErrorCode,
  ExitCode,
  PersonaCommand,
  TextSymbol,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { inspectPersona } from "@titan/knowledge";
import { CliDescription, KnowledgeMessage } from "@titan/messages";
import type { CommandDefinition } from "@titan/types";

export const personaDefinition: CommandDefinition = {
  description: CliDescription.Persona,
  options: [CliOption.Home],
  subcommands: {
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
