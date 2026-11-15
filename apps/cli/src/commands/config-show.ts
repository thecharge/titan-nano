import { describeConfigFile } from "@titan/config/files";
import { CliOption, ErrorCode, ExitCode } from "@titan/constants";
import { assertSafeId } from "@titan/core";
import { TitanError } from "@titan/errors";
import { ConfigFileMessage } from "@titan/messages";
import { type CliOptions, type CommandHandler, ConfigFileTargetSchema } from "@titan/types";

export function configShowOptions(options: CliOptions): void {
  const id = options[CliOption.RunId];
  if (id !== undefined) {
    if (options.scope !== undefined || options.project !== undefined)
      throw new TitanError(ErrorCode.Arguments, ConfigFileMessage.SelectorConflict);
    assertSafeId(id);
    return;
  }
  if (!ConfigFileTargetSchema.shape.scope.safeParse(options.scope).success)
    throw new TitanError(ErrorCode.Arguments, ConfigFileMessage.ShowTarget);
}

export const showConfig: CommandHandler = async ({ options, home, project, services }) => {
  const id = options[CliOption.RunId];
  const report =
    id !== undefined
      ? await services.client(home).configuration(id)
      : await describeConfigFile(
          ConfigFileTargetSchema.parse({ home, project, scope: options.scope }),
        );
  const config = options.sources
    ? report.config
    : { value: report.config.value, hash: report.config.hash };
  return {
    data: { ...report, config },
    exitCode: ExitCode.Success,
  };
};
