import { configJsonSchema, parseData } from "@titan/config";
import { inspectConfigFile, writeConfigFile } from "@titan/config/files";
import {
  CliOption,
  CliPositionals,
  ConfigCommand,
  ErrorCode,
  ExitCode,
  TextSymbol,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { CliDescription, ConfigFileMessage } from "@titan/messages";
import {
  type CliOptions,
  type CommandContext,
  type CommandDefinition,
  type CommandHandler,
  ConfigFileTargetSchema,
  ConfigSettingSchema,
  Sha256Schema,
} from "@titan/types";
import { configShowOptions, showConfig } from "./config-show.ts";

function scope(options: CliOptions): void {
  if (!ConfigFileTargetSchema.shape.scope.safeParse(options.scope).success)
    throw new TitanError(ErrorCode.Arguments, ConfigFileMessage.Input);
}

function version(options: CliOptions): string {
  scope(options);
  const parsed = Sha256Schema.safeParse(options[CliOption.ExpectedVersion]);
  if (!parsed.success) throw new TitanError(ErrorCode.Arguments, ConfigFileMessage.Input);
  return parsed.data;
}

function target(context: CommandContext) {
  return ConfigFileTargetSchema.parse({
    home: context.home,
    project: context.project,
    scope: context.options.scope,
  });
}

function patch(positionals: readonly string[]): unknown {
  const name = ConfigSettingSchema.safeParse(positionals[0]);
  if (!name.success) throw new TitanError(ErrorCode.Arguments, ConfigFileMessage.Setting);
  let value: unknown = parseData(positionals[1] ?? TextSymbol.Empty);
  for (const key of name.data.split(TextSymbol.Dot).reverse()) value = { [key]: value };
  return value;
}

const handlers = {
  init: async (context) => {
    const change = { ...target(context), expected_version: null, patch: {} };
    return { data: await writeConfigFile(change), exitCode: ExitCode.Success };
  },
  validate: async (context) => ({
    data: await inspectConfigFile(target(context)),
    exitCode: ExitCode.Success,
  }),
  set: async (context) => ({
    data: await writeConfigFile({
      ...target(context),
      expected_version: version(context.options),
      patch: patch(context.positionals),
    }),
    exitCode: ExitCode.Success,
  }),
  schema: async () => ({ data: configJsonSchema(), exitCode: ExitCode.Success }),
} satisfies Record<string, CommandHandler>;

const options = [CliOption.Home, CliOption.Project, CliOption.Scope] as const;

export const configSubcommands = {
  [ConfigCommand.Show]: {
    description: CliDescription.ConfigShow,
    options: [
      CliOption.Home,
      CliOption.Project,
      CliOption.Scope,
      CliOption.RunId,
      CliOption.Sources,
    ],
    validate: configShowOptions,
    handler: showConfig,
  },
  [ConfigCommand.Init]: {
    description: ConfigFileMessage.Init,
    options,
    validate: scope,
    handler: handlers.init,
  },
  [ConfigCommand.Validate]: {
    description: ConfigFileMessage.Validate,
    options,
    validate: scope,
    handler: handlers.validate,
  },
  [ConfigCommand.Set]: {
    description: ConfigFileMessage.Set,
    options: [...options, CliOption.ExpectedVersion],
    positionals: CliPositionals.ConfigSet,
    validate: version,
    handler: handlers.set,
  },
  [ConfigCommand.Schema]: {
    description: ConfigFileMessage.Schema,
    options: [],
    handler: handlers.schema,
  },
} satisfies Record<string, CommandDefinition>;
