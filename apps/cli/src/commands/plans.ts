import { CliOption, CliPositionals, ExitCode, TextSymbol } from "@titan/constants";
import { topPlans } from "@titan/knowledge";
import { CliDescription } from "@titan/messages";
import type { CommandDefinition } from "@titan/types";

export const plansDefinition: CommandDefinition = {
  description: CliDescription.Plans,
  positionals: CliPositionals.PlanKind,
  options: [CliOption.Home],
  handler: async ({ services, home, positionals }) => ({
    data: await topPlans(services.knowledge(home), positionals[0] ?? TextSymbol.Empty),
    exitCode: ExitCode.Success,
  }),
};
