import { resolve } from "node:path";
import { homePath } from "@titan/config";
import {
  CliCommand,
  CliInvocationKind,
  CliOption,
  CliOutputOperation,
  ExitCode,
  UpdateFile,
} from "@titan/constants";
import { RunRuntimeError } from "@titan/errors";
import { CliDiagnostic, CliMessage } from "@titan/messages";
import type { CliServices, CommandResult } from "@titan/types";
import { commandDefinition, commands } from "./catalog.ts";
import { parseInvocation } from "./parser.ts";

export function createCli(services: CliServices) {
  return async (args: string[]): Promise<number> => {
    const invocation = parseInvocation(args);
    const home = homePath(invocation.values.home);
    const operation =
      invocation.kind === CliInvocationKind.Version
        ? CliOutputOperation.Version
        : invocation.kind === CliInvocationKind.Help
          ? CliOutputOperation.Help
          : invocation.name;
    const emit = (value: unknown) =>
      services.output(value, invocation.values.json ?? false, { operation });
    if (invocation.kind === CliInvocationKind.Version) {
      await emit({ version: services.version, release: CliDiagnostic.Release });
      return ExitCode.Success;
    }
    if (invocation.kind === CliInvocationKind.Help) {
      await emit({
        usage: CliMessage.Usage,
        commands: commands.map((name) => ({
          name,
          status: commandDefinition(name)?.handler ? CliMessage.Preview : CliMessage.Pending,
          description: commandDefinition(name)?.description,
        })),
        readiness: CliMessage.Readiness,
      });
      return ExitCode.Success;
    }
    if (invocation.kind === CliInvocationKind.CommandHelp) {
      const { definition, name } = invocation;
      await emit({
        command: name,
        description: definition.description,
        positionals: definition.positionals ?? [],
        subcommands: Object.keys(definition.subcommands ?? {}),
        options: [
          CliOption.Help,
          ...(definition.protocol ? [] : [CliOption.Json]),
          ...definition.options,
        ],
        status: definition.handler ? CliMessage.Preview : CliMessage.Pending,
      });
      return ExitCode.Success;
    }
    const context = {
      options: invocation.values,
      positionals: invocation.positionals,
      home,
      project: resolve(invocation.values.project ?? services.cwd()),
      services,
      emit,
    };
    if (
      invocation.name !== CliCommand.Update &&
      services.environment[UpdateFile.PinnedRuntime] !== services.version &&
      !(invocation.name === CliCommand.Doctor && invocation.values.backup)
    ) {
      const notice = await services.updateNotice?.(home, services.version);
      if (notice) {
        const exit = await services.autoUpdate?.(context, args);
        if (exit !== null && exit !== undefined) return exit;
        services.notice(notice);
      }
    }
    const result = await invocation.definition
      .handler?.(context)
      .catch(async (error: unknown): Promise<CommandResult> => {
        if (!(error instanceof RunRuntimeError)) throw error;
        const exit = await services.recoverRuntime?.(
          context,
          args,
          error.requiredRuntime,
          error.requiredBuild,
        );
        if (exit === null || exit === undefined) throw error;
        return { exitCode: exit };
      });
    if (result?.data !== undefined)
      await services.output(result.data, invocation.values.json ?? false, {
        operation,
        ...(result.events ? { events: result.events } : {}),
      });
    return result?.exitCode ?? ExitCode.Input;
  };
}
