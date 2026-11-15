#!/usr/bin/env bun
import { CliRuntime, ExitCode } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { cliFailure } from "@titan/messages";
import { createCli } from "./application.ts";
import { defaultServices } from "./bootstrap.ts";
import { failureEnvelope, outputOperation } from "./output.ts";

export { commands } from "./catalog.ts";
export const main = createCli(defaultServices);
export async function runEntry(
  args: string[],
  output = console.log,
  errorOutput = console.error,
): Promise<number> {
  try {
    return await main(args);
  } catch (error) {
    const failure = failureEnvelope(error, outputOperation(args));
    if (args.includes(CliRuntime.JsonFlag)) output(JSON.stringify(failure));
    else errorOutput(cliFailure(failure.error.code, failure.error.message));
    return error instanceof TitanError ? error.exitCode : ExitCode.Input;
  }
}

if (import.meta.main) process.exitCode = await runEntry(process.argv.slice(2));
