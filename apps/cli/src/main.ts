#!/usr/bin/env bun
import { CliRuntime, ExitCode } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { cliFailure } from "@titan/messages";
import { createCli } from "./application.ts";
import { defaultServices } from "./bootstrap.ts";
import { failureEnvelope, outputOperation } from "./output.ts";
import { StdoutWriteError, writeStdoutLine } from "./stdout.ts";

export { commands } from "./catalog.ts";
export const main = createCli(defaultServices);
async function runCommand(
  args: string[],
  output: (line: string) => unknown,
  errorOutput: (line: string) => void,
): Promise<number> {
  try {
    return await main(args);
  } catch (error) {
    if (error instanceof StdoutWriteError) throw error;
    const failure = failureEnvelope(error, outputOperation(args));
    if (args.includes(CliRuntime.JsonFlag)) await output(JSON.stringify(failure));
    else errorOutput(cliFailure(failure.error.code, failure.error.message));
    return error instanceof TitanError ? error.exitCode : ExitCode.Input;
  }
}

export function runEntry(
  args: string[],
  output: (line: string) => unknown = writeStdoutLine,
  errorOutput = console.error,
): Promise<number> {
  return runCommand(args, output, errorOutput).catch((error: unknown) => {
    if (!(error instanceof StdoutWriteError)) throw error;
    errorOutput(error.message);
    return ExitCode.Transport;
  });
}

if (import.meta.main) process.exitCode = await runEntry(process.argv.slice(2));
