import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readlink,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import {
  CliCommand,
  ErrorCode,
  ErrorField,
  ExitCode,
  FileErrorCode,
  FileOpenMode,
  Harness,
  HookFile,
  PackageManagerArgument,
  Packaging,
  ProbeOption,
  TextSymbol,
  UpdateFile,
} from "@titan/constants";
import { newId } from "@titan/core";
import { TitanError } from "@titan/errors";
import { UpdateMessage } from "@titan/messages";
import { captureCommand } from "@titan/process";
import { ownMaintenance } from "@titan/server/maintenance";
import { BootstrapHarnessSchema } from "@titan/types";
import { exists } from "@titan/workspace";

async function run(command: readonly string[], directory: string): Promise<void> {
  const result = await captureCommand(command, directory, {
    timeout_ms: UpdateFile.PackageMilliseconds,
    maximum_bytes: Packaging.OutputBytes,
  });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.exit_code !== ExitCode.Success)
    throw new TitanError(
      ErrorCode.Arguments,
      UpdateMessage.BootstrapCommand,
      ExitCode.Unsuccessful,
    );
}

async function launcherTarget(installation: string): Promise<string | null> {
  const launcher = join(installation, UpdateFile.Launcher);
  const metadata = await lstat(launcher).catch((error: unknown) => {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing)
      return null;
    throw error;
  });
  if (!metadata) return null;
  if (!metadata.isSymbolicLink())
    throw new TitanError(ErrorCode.Arguments, UpdateMessage.BootstrapLauncher);
  const target = await readlink(launcher);
  if (target !== Packaging.CliPath && !UpdateFile.LauncherPattern.test(target))
    throw new TitanError(ErrorCode.Arguments, UpdateMessage.BootstrapLauncher);
  return target;
}

async function buildArchive(source: string, distribution: string): Promise<string> {
  await run(
    [Packaging.Target, PackageManagerArgument.Run, Packaging.Prepare, distribution],
    source,
  );
  const files = (await readdir(distribution, { withFileTypes: true })).filter(
    (file) =>
      file.isFile() &&
      file.name.startsWith(Packaging.ArchivePrefix) &&
      file.name.endsWith(Packaging.ArchiveExtension),
  );
  const archive = files.at(0);
  if (files.length !== 1 || !archive)
    throw new TitanError(
      ErrorCode.Arguments,
      UpdateMessage.BootstrapArchives,
      ExitCode.Unsuccessful,
    );
  return join(distribution, archive.name);
}

async function installRelease(installation: string, archive: string): Promise<string> {
  const manifest = join(installation, HookFile.Manifest);
  if (!(await exists(manifest)))
    await writeFile(manifest, UpdateFile.PrivateManifest + TextSymbol.Newline, {
      flag: FileOpenMode.Exclusive,
    });
  const releases = join(installation, Packaging.Releases);
  await mkdir(releases, { recursive: true });
  if (!(await lstat(releases)).isDirectory() || (await realpath(releases)) !== releases)
    throw new TitanError(ErrorCode.Arguments, UpdateMessage.BootstrapReleases);
  const staged = await mkdtemp(
    join(releases, basename(archive, Packaging.ArchiveExtension) + TextSymbol.Dot),
  );
  await writeFile(join(staged, HookFile.Manifest), UpdateFile.PrivateManifest);
  await run(
    [Packaging.Target, PackageManagerArgument.Add, UpdateFile.IgnoreScripts, archive],
    staged,
  );
  const entry = join(staged, Packaging.CliPath);
  await run([entry, CliCommand.Doctor], installation);
  return relative(installation, entry);
}

async function installCommand(installation: string, command: string): Promise<boolean> {
  await mkdir(dirname(command), { recursive: true });
  const launcher = join(installation, UpdateFile.Launcher);
  try {
    await symlink(launcher, command);
    return true;
  } catch (error) {
    if (!(error instanceof Error) || Reflect.get(error, ErrorField.Code) !== FileErrorCode.Exists)
      throw error;
  }
  const metadata = await lstat(command);
  return (
    metadata.isSymbolicLink() && resolve(dirname(command), await readlink(command)) === launcher
  );
}

async function bootstrapInstall(
  installation: string,
  source: string,
  command?: string,
): Promise<void> {
  await mkdir(installation, { recursive: true });
  const target = await realpath(installation);
  await using resources = new AsyncDisposableStack();
  await ownMaintenance(target, resources);
  const previous = await launcherTarget(target);
  const distribution = await mkdtemp(join(tmpdir(), UpdateFile.BootstrapBuildPrefix));
  resources.defer(() => rm(distribution, { recursive: true, force: true }));
  const archive = await buildArchive(source, distribution);
  const next = await installRelease(target, archive);
  if ((await launcherTarget(target)) !== previous)
    throw new TitanError(ErrorCode.ConfigConflict, UpdateMessage.LauncherChanged);
  const temporary = join(target, UpdateFile.BootstrapPrefix + newId());
  resources.defer(() => rm(temporary, { force: true }));
  await symlink(next, temporary);
  await rename(temporary, join(target, UpdateFile.Launcher));
  const directory = await open(target, FileOpenMode.Read);
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
  console.log(UpdateMessage.BootstrapInstalled, target);
  console.log(UpdateMessage.BootstrapStart, join(target, UpdateFile.Launcher), CliCommand.Guide);
  if (command)
    console.log(
      (await installCommand(target, command))
        ? UpdateMessage.BootstrapLinked
        : UpdateMessage.BootstrapCommandExists,
      command,
    );
  else console.log(UpdateMessage.BootstrapPath);
}

try {
  const [installation, source, command, project, harness] = process.argv.slice(2);
  if (
    !installation ||
    !source ||
    ![4, 5, 7].includes(process.argv.length) ||
    (process.argv.length === 7 && (!project || !harness))
  )
    throw new TitanError(ErrorCode.Arguments, UpdateMessage.BootstrapArguments);
  const selected = harness ? BootstrapHarnessSchema.parse(harness) : undefined;
  await bootstrapInstall(resolve(installation), resolve(source), command && resolve(command));
  const agents =
    selected === UpdateFile.BootstrapBoth
      ? [Harness.Codex, Harness.Claude]
      : selected
        ? [selected]
        : [];
  for (const agent of agents)
    await run(
      [
        resolve(installation, UpdateFile.Launcher),
        CliCommand.Install,
        ProbeOption.Harness,
        agent,
        ProbeOption.Project,
        resolve(project ?? source),
      ],
      resolve(source),
    );
} catch (error) {
  console.error(error instanceof Error ? error.message : UpdateMessage.BootstrapCommand);
  process.exitCode = error instanceof TitanError ? error.exitCode : ExitCode.Unsuccessful;
}
