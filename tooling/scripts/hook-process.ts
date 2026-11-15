import { HookEnvironment, HookLimit, OfflineTest, ProcessIo, TextSymbol } from "@titan/constants";
import { HookMessage, hookCommandFailed } from "@titan/messages";
import type { HookProcessOptions } from "@titan/types";

async function readOutput(source: AsyncIterable<Uint8Array>): Promise<string> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of source) {
    bytes += chunk.byteLength;
    if (bytes > HookLimit.OutputBytes) throw new Error(HookMessage.OutputLimit);
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks, bytes).toString();
}

export async function commandOutput(
  command: readonly string[],
  options: HookProcessOptions,
): Promise<string> {
  const child = Bun.spawn([...command], {
    cwd: options.cwd,
    env: options.environment ?? process.env,
    stdout: ProcessIo.Pipe,
    stderr: ProcessIo.Inherit,
  });
  try {
    const output = await readOutput(child.stdout);
    const code = await child.exited;
    if (code !== 0) throw new Error(hookCommandFailed(command, code));
    return options.raw ? output : output.trim();
  } finally {
    if (child.exitCode === null) child.kill();
    await child.exited;
  }
}

export async function commandStatus(
  command: readonly string[],
  cwd: string,
  input?: Uint8Array,
  environment?: NodeJS.ProcessEnv,
): Promise<number> {
  const child = Bun.spawn([...command], {
    cwd,
    stdout: ProcessIo.Inherit,
    stderr: ProcessIo.Inherit,
    stdin: input ?? ProcessIo.Ignore,
    ...(environment ? { env: environment } : {}),
  });
  return child.exited;
}

export async function cleanGitEnvironment(): Promise<NodeJS.ProcessEnv> {
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    if (name.startsWith(HookEnvironment.Prefix)) delete environment[name];
  }
  return environment;
}

export async function reportHookFailure(error: unknown): Promise<number> {
  const known =
    error instanceof Error && Object.values(HookMessage).some((value) => value === error.message);
  console.error(known ? error.message : HookMessage.Incomplete);
  return 1;
}

export async function environmentCommandStatus(
  command: readonly string[],
  cwd: string,
  environment: NodeJS.ProcessEnv,
): Promise<number> {
  return commandStatus(command, cwd, undefined, environment);
}

export async function verificationCommandStatus(
  command: readonly string[],
  cwd: string,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  return commandStatus(command, cwd, undefined, {
    ...environment,
    [OfflineTest.FastVariable]: TextSymbol.Empty,
  });
}
