import { CliOption, ExitCode } from "@titan/constants";
import { CliDescription } from "@titan/messages";
import type { CommandDefinition } from "@titan/types";

export const dashboardDefinition = {
  description: CliDescription.Dashboard,
  options: [CliOption.Home],
  handler: async ({ services, home, options }) => {
    const { link } = await services.dashboard(home).login();
    return { data: options.json ? { link } : link, exitCode: ExitCode.Success };
  },
} satisfies CommandDefinition;
