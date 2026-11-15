import { lstat, opendir, realpath } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { runtimeBuild } from "@titan/config";
import {
  CliRuntime,
  ExitCode,
  HookFile,
  IoLimit,
  Packaging,
  ProbeOption,
  RuntimeLimit,
  UpdateFile,
} from "@titan/constants";
import { captureCommand } from "@titan/process";
import { readFileBytes } from "@titan/streams";
import {
  CliOutputSchema,
  type CliServices,
  type CommandContext,
  type DaemonStartupServices,
  UpdateVersionSchema,
} from "@titan/types";
import { daemonStartupServices, ensureDaemon, stopIdleDaemon } from "./daemon.ts";

async function retainedRelease(
  release: string,
  runtime: string,
  version: string,
  requiredBuild?: string,
) {
  try {
    const entry = join(release, Packaging.InstalledPath, Packaging.Bundle);
    if (!(await lstat(entry)).isFile() || (await realpath(entry)) !== entry) return null;
    const manifest = UpdateVersionSchema.parse(
      JSON.parse(
        (
          await readFileBytes(join(dirname(entry), HookFile.Manifest), IoLimit.DataBytes)
        ).toString(),
      ),
    );
    if (manifest.version !== version) return null;
    const build = await runtimeBuild(entry);
    if (requiredBuild !== undefined && build !== requiredBuild) return null;
    const result = await captureCommand(
      [runtime, entry, ProbeOption.Version, CliRuntime.JsonFlag],
      release,
      { timeout_ms: Packaging.OutputMilliseconds, maximum_bytes: Packaging.OutputBytes },
    );
    if (result.exit_code !== ExitCode.Success) return null;
    if ((await runtimeBuild(entry)) !== build) return null;
    const output = CliOutputSchema.parse(JSON.parse(result.stdout.toString()));
    return !output.error && UpdateVersionSchema.parse(output.data).version === version
      ? { entry, build }
      : null;
  } catch {
    return null;
  }
}

async function requiredRelease(services: CliServices, version: string, build?: string) {
  const executable = services.executable;
  if (!executable) return null;
  const entry = await realpath(executable[1]).catch(() => null);
  if (!entry) return null;
  const release = resolve(dirname(entry), Packaging.ReleaseFromBundle);
  if (
    basename(dirname(release)) !== Packaging.Releases ||
    !basename(release).startsWith(Packaging.ArchivePrefix) ||
    entry !== resolve(release, Packaging.InstalledPath, Packaging.Bundle)
  )
    return null;
  const installation = resolve(release, Packaging.InstallationFromRelease);
  const launcher = await lstat(join(installation, UpdateFile.Launcher)).catch(() => null);
  if (!launcher?.isSymbolicLink()) return null;
  const releases = await opendir(dirname(release));
  let count = 0;
  let selected: Awaited<ReturnType<typeof retainedRelease>> = null;
  for await (const candidate of releases) {
    count += 1;
    if (count > RuntimeLimit.PendingOperations) return null;
    if (!candidate.isDirectory() || !candidate.name.startsWith(Packaging.ArchivePrefix)) continue;
    const compatible = await retainedRelease(
      join(dirname(release), candidate.name),
      executable[0],
      version,
      build,
    );
    if (!compatible) continue;
    if (selected && selected.build !== compatible.build) return null;
    selected ??= compatible;
  }
  return selected?.entry ?? null;
}

export async function recoverRunRuntime(
  context: CommandContext,
  args: readonly string[],
  version: string,
  build?: string,
): Promise<number | null> {
  if (!context.services.handoff || context.services.environment[UpdateFile.PinnedRuntime])
    return null;
  const entry = await requiredRelease(context.services, version, build);
  if (!entry) return null;
  await stopIdleDaemon(context.home);
  return context.services.handoff(entry, args, context.project, version);
}

export async function recoverRuntimeConnection(
  home: string,
  version: string,
  services: CliServices,
  startup: DaemonStartupServices = daemonStartupServices,
  requiredBuild?: string,
): Promise<boolean> {
  if (services.environment[UpdateFile.PinnedRuntime]) return false;
  const entry = await requiredRelease(services, version, requiredBuild);
  if (!entry) return false;
  const build = await runtimeBuild(entry);
  await stopIdleDaemon(home);
  await ensureDaemon(home, {
    ...startup,
    probe: (home, timeout) => startup.probe(home, timeout, version, build),
    launch: (home) => startup.launch(home, entry, version),
  });
  return true;
}
