import { strict as assert } from "node:assert";
import { ExitCode, IoLimit, ProcessIo, ProcessSignal, SdkProcessFixture } from "@titan/constants";
import { all } from "@titan/core";
import { readBytes } from "@titan/streams";
import { CliOutputSchema, type OwnedTestProcess } from "@titan/types";

export async function stopCommand(child: OwnedTestProcess): Promise<void> {
  if (child.exitCode === null) child.kill(ProcessSignal.Kill);
  await child.exited;
}

export async function runCliCommand(
  cli: string,
  home: string,
  args: string[],
  expected: number = ExitCode.Success,
) {
  const { output, error, code } = await captureCli(cli, [...args, "--home", home, "--json"]);
  assert.equal(code, expected, error.toString());
  const envelope = CliOutputSchema.parse(JSON.parse(output.toString()));
  return envelope.data ?? envelope.error;
}

export async function captureCli(
  cli: string,
  args: string[],
  cwd?: string,
  environment?: Record<string, string | undefined>,
) {
  const child = Bun.spawn([process.execPath, cli, ...args], {
    ...(cwd ? { cwd } : {}),
    ...(environment ? { env: environment } : {}),
    stdin: ProcessIo.Ignore,
    stdout: ProcessIo.Pipe,
    stderr: ProcessIo.Pipe,
    timeout: SdkProcessFixture.CommandTimeout,
  });
  try {
    const [output, error, code] = await all([
      () => readBytes(child.stdout, IoLimit.ResponseBytes),
      () => readBytes(child.stderr, IoLimit.ResponseBytes),
      () => child.exited,
    ]);
    return { output, error, code };
  } finally {
    await stopCommand(child);
  }
}
