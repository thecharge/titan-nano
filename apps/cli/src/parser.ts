import {
  backendIds,
  CliCommand,
  CliInvocationKind,
  CliOption,
  CliRuntime,
  ErrorCode,
} from "@titan/constants";
import { errorMessage, TitanError } from "@titan/errors";
import {
  CliDiagnostic,
  CliMessage,
  extraArguments,
  pendingCommand,
  unknownCommand,
  unsupportedBackend,
  unsupportedOption,
} from "@titan/messages";
import type { OptionName } from "@titan/types";
import { resolveCommand } from "./catalog.ts";
import { parseRaw } from "./options.ts";
import { validatePositionals } from "./positionals.ts";
import { cliSettingOverrides } from "./setting-overrides.ts";

export function parseInvocation(args: string[]) {
  let parsed: ReturnType<typeof parseRaw>;
  try {
    parsed = parseRaw(args);
  } catch (error) {
    throw new TitanError(ErrorCode.Arguments, errorMessage(error));
  }
  const { values, positionals } = parsed;
  const rootName = positionals[0];
  if (values.version) {
    if (
      positionals.length ||
      Object.keys(values).some(
        (option) => option !== CliOption.Version && option !== CliOption.Json,
      )
    )
      throw new TitanError(ErrorCode.Arguments, CliDiagnostic.VersionOptions);
    return { kind: CliInvocationKind.Version as const, values };
  }
  if (!rootName) {
    if (
      Object.keys(values).some((option) => option !== CliOption.Help && option !== CliOption.Json)
    )
      throw new TitanError(ErrorCode.Arguments, CliDiagnostic.CommandRequired);
    return { kind: CliInvocationKind.Help as const, values };
  }
  const { name, definition, positionals: arguments_ } = resolveCommand(positionals);
  if (!definition) throw new TitanError(ErrorCode.UnknownCommand, unknownCommand(name));
  const allowed = new Set<OptionName>([CliOption.Help, CliOption.Json, ...definition.options]);
  for (const option of Object.keys(values)) {
    if (!allowed.has(option as OptionName))
      throw new TitanError(ErrorCode.Arguments, unsupportedOption(name, option));
  }
  if (definition.protocol && values.json)
    throw new TitanError(ErrorCode.ProtocolJson, CliMessage.ProtocolJson);
  if (
    arguments_.length > (definition.positionals?.length ?? 0) &&
    !definition.positionals?.at(-1)?.multiple
  )
    throw new TitanError(ErrorCode.Arguments, extraArguments(name));
  if (values.help)
    return { kind: CliInvocationKind.CommandHelp as const, name, definition, values };
  if (!definition.handler) throw new TitanError(ErrorCode.NotBuilt, pendingCommand(name));
  validatePositionals(definition.positionals ?? [], arguments_);
  definition.validate?.(values);
  if (values.backend && !backendIds.some((backend) => backend === values.backend))
    throw new TitanError(ErrorCode.Backend, unsupportedBackend(values.backend));
  const parallel = values[CliOption.MaxParallel];
  if (
    parallel !== undefined &&
    (!CliRuntime.PositiveIntegerPattern.test(parallel) || !Number.isSafeInteger(Number(parallel)))
  )
    throw new TitanError(ErrorCode.Arguments, CliDiagnostic.ParallelLimit);
  if (values.set || (values.harness && name !== CliCommand.Install)) cliSettingOverrides(values);
  if (values[CliOption.DryRun] && values.watch)
    throw new TitanError(ErrorCode.Arguments, CliDiagnostic.DryRunWatch);
  if (values[CliOption.Detach] && values.watch)
    throw new TitanError(ErrorCode.Arguments, CliDiagnostic.RunObservation);
  if (values[CliOption.DryRun] && values[CliOption.Detach])
    throw new TitanError(ErrorCode.Arguments, CliDiagnostic.DryRunDetach);
  if (
    values[CliOption.DryRun] &&
    (values[CliOption.ClientId] !== undefined ||
      values[CliOption.SubmissionId] !== undefined ||
      values[CliOption.HarnessSessionId] !== undefined)
  )
    throw new TitanError(ErrorCode.Arguments, CliDiagnostic.DryRunIdentity);
  if (name === CliCommand.Run && values.config)
    throw new TitanError(ErrorCode.ConfigFile, CliDiagnostic.RunConfig);
  if (name === CliCommand.Run && !values[CliOption.DryRun])
    values.watch = !values[CliOption.Detach];
  return {
    kind: CliInvocationKind.Command as const,
    name,
    definition,
    values,
    positionals: arguments_,
  };
}
