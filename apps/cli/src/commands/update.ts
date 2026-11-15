import { CliOption, ErrorCode, ExitCode } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { CliDescription, UpdateMessage } from "@titan/messages";
import type { CommandDefinition } from "@titan/types";
import { installUpdate } from "../update-install.ts";
import { inspectLatestRelease } from "../updates.ts";

export const updateDefinition = {
  description: CliDescription.Update,
  options: [CliOption.Home, CliOption.Check, CliOption.From, CliOption.Force, CliOption.Project],
  validate(options) {
    if (options.check === true && (options.from || options.force))
      throw new TitanError(ErrorCode.Arguments, UpdateMessage.CheckRequired);
  },
  handler: async (context) => ({
    data:
      context.options.check === true
        ? await inspectLatestRelease(context.home, context.services.version)
        : await installUpdate(context),
    exitCode: ExitCode.Success,
  }),
} satisfies CommandDefinition;
