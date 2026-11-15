import {
  ExitCode,
  HarnessPlugin,
  ProcessIo,
  ProcessSignal,
  SpawnIgnore,
  UpdateFile,
} from "@titan/constants";

export async function launch(
  command: readonly string[],
  environment: Record<string, string | undefined>,
  cwd?: string,
  timeout: number = HarnessPlugin.RegistrationMilliseconds,
): Promise<number> {
  const child = Bun.spawn([...command], {
    env: environment,
    ...(cwd === undefined ? {} : { cwd }),
    timeout,
    killSignal: ProcessSignal.Kill,
    stdin: SpawnIgnore.Ignore,
    stdout: SpawnIgnore.Ignore,
    stderr: SpawnIgnore.Ignore,
  });
  const code = await child.exited;
  return child.signalCode === null ? code : ExitCode.Unsuccessful;
}

export async function handoff(
  launcher: string,
  args: readonly string[],
  project: string,
  pinnedRuntime?: string,
): Promise<number> {
  const child = Bun.spawn([process.execPath, launcher, ...args], {
    cwd: project,
    env: {
      ...process.env,
      ...(pinnedRuntime ? { [UpdateFile.PinnedRuntime]: pinnedRuntime } : {}),
    },
    stdin: ProcessIo.Inherit,
    stdout: ProcessIo.Inherit,
    stderr: ProcessIo.Inherit,
  });
  return child.exited;
}
