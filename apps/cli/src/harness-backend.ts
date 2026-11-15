import { detectHarness } from "@titan/config";
import { CliOption, ErrorCode, HarnessBackends, HarnessCommands } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { unsupportedBackend } from "@titan/messages";
import type { CommandContext } from "@titan/types";

export function detectedBackend(context: CommandContext, workflow: string | undefined): string {
  const choice = detectHarness({
    flag: context.options[CliOption.Harness],
    workflow,
    env: context.services.environment,
    found: HarnessCommands.filter((entry) => context.services.program(entry.command) !== null).map(
      (entry) => entry.command,
    ),
  });
  const backend = Object.entries(HarnessBackends).find(([name]) => name === choice.harness)?.[1];
  if (!backend) throw new TitanError(ErrorCode.Backend, unsupportedBackend(choice.harness));
  return backend;
}
