import { exportArtifact } from "@titan/artifacts";
import {
  ArtifactCommand,
  CliOption,
  CliPositionals,
  ErrorCode,
  ExitCode,
  TextSymbol,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { ArtifactMessage, CliDescription } from "@titan/messages";
import type { CliOptions, CommandDefinition, CommandHandler } from "@titan/types";
import { ArtifactExportDestinationSchema, RunSchema } from "@titan/types";
import { artifactOptions, runHandlers } from "./runs.ts";

const exportDelivery: CommandHandler = async ({ services, home, options, positionals }) => ({
  data: await exportArtifact(
    RunSchema.parse(await services.client(home).get(positionals[0] ?? TextSymbol.Empty)),
    positionals[1] ?? TextSymbol.Empty,
    options[CliOption.Output] ?? TextSymbol.Empty,
  ),
  exitCode: ExitCode.Success,
});

function validateExport(options: CliOptions): void {
  if (!ArtifactExportDestinationSchema.safeParse(options.output).success)
    throw new TitanError(ErrorCode.Arguments, ArtifactMessage.Destination);
}
const artifactSubcommands = {
  [ArtifactCommand.Export]: {
    description: CliDescription.ArtifactExport,
    positionals: CliPositionals.Artifact,
    options: [CliOption.Home, CliOption.Output],
    handler: exportDelivery,
    validate: validateExport,
  },
  [ArtifactCommand.List]: {
    description: CliDescription.Artifacts,
    positionals: CliPositionals.Run,
    options: [CliOption.Home],
    handler: runHandlers.artifacts,
  },
  [ArtifactCommand.Show]: {
    description: CliDescription.Artifact,
    positionals: CliPositionals.Artifact,
    options: [CliOption.Home, CliOption.Offset, CliOption.Limit],
    handler: runHandlers.artifact,
    validate: artifactOptions,
  },
} satisfies Record<string, CommandDefinition>;
export const artifactDefinition: CommandDefinition = {
  description: CliDescription.Artifacts,
  positionals: CliPositionals.Run,
  options: [CliOption.Home],
  handler: runHandlers.artifacts,
  subcommands: artifactSubcommands,
};
