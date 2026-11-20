import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readlink,
  realpath,
  rename,
  rm,
  symlink,
  unlink,
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import {
  CliCommand,
  CliRuntime,
  ConfigWrite,
  DaemonStartup,
  ErrorCode,
  ErrorField,
  ExitCode,
  FileErrorCode,
  FileOpenMode,
  HookFile,
  IoLimit,
  KnowledgeFile,
  PackageManagerArgument,
  Packaging,
  ProbeOption,
  ServerDatabaseAdapter,
  ServerFile,
  ServerLimit,
  UpdateFile,
  UpdateMode,
  UpdatePhase,
} from "@titan/constants";
import { hash, newId } from "@titan/core";
import { errorMessage, TitanError } from "@titan/errors";
import { ownKnowledge, projectHubHome } from "@titan/knowledge";
import { UpdateMessage, updateBackupRetained } from "@titan/messages";
import { captureCommand } from "@titan/process";
import {
  inspectUpdateCatalog,
  ownMaintenance,
  ownStoppedHome,
  requestServerStop,
} from "@titan/server/maintenance";
import { atomicWrite, readFileBytes } from "@titan/streams";
import {
  CliOutputSchema,
  type CommandContext,
  InstallCommandLinkSchema,
  UpdateDoctorSchema,
  type UpdateInstallObserver,
  type UpdateTransaction,
  UpdateTransactionSchema,
  UpdateVersionSchema,
} from "@titan/types";
import { exists } from "@titan/workspace";
import { probeDaemon } from "./daemon.ts";
import { createUpdateBackup, verifyUpdateBackup } from "./update-backup.ts";
import { buildUpdateRelease } from "./update-source.ts";
import { compareRelease, releaseVersion, selectUpdateRelease, updateSettings } from "./updates.ts";

async function readTransaction(home: string) {
  const path = join(home, UpdateFile.Transaction);
  if (!(await exists(path))) return null;
  return UpdateTransactionSchema.parse(
    JSON.parse((await readFileBytes(path, IoLimit.DataBytes)).toString()),
  );
}

function unfinished(transaction: UpdateTransaction | null): boolean {
  return (
    transaction !== null &&
    transaction.phase !== UpdatePhase.Complete &&
    transaction.phase !== UpdatePhase.RolledBack
  );
}

function managedTarget(installation: string, target: string): boolean {
  return UpdateFile.LauncherPattern.test(relative(installation, resolve(installation, target)));
}

function managedRelease(entry: string) {
  const release = resolve(dirname(entry), Packaging.ReleaseFromBundle);
  if (
    basename(dirname(release)) !== Packaging.Releases ||
    !basename(release).startsWith(Packaging.ArchivePrefix) ||
    entry !== resolve(release, Packaging.InstalledPath, Packaging.Bundle)
  )
    return null;
  return release;
}

async function managedInstallation(context: CommandContext) {
  const executable = context.services.executable;
  if (!executable) throw new TitanError(ErrorCode.Arguments, UpdateMessage.ManagedRequired);
  const entry = await realpath(executable[1]);
  const release = managedRelease(entry);
  if (!release) throw new TitanError(ErrorCode.Arguments, UpdateMessage.ManagedRequired);
  const installation = resolve(release, Packaging.InstallationFromRelease);
  const launcher = join(installation, UpdateFile.Launcher);
  if (!(await lstat(launcher)).isSymbolicLink())
    throw new TitanError(ErrorCode.Arguments, UpdateMessage.ManagedRequired);
  const transaction = await readTransaction(context.home);
  const recovering =
    unfinished(transaction) &&
    transaction?.installation === installation &&
    (await realpath(resolve(installation, transaction.previous))) === entry;
  if ((await realpath(launcher)) !== entry && !recovering)
    throw new TitanError(ErrorCode.Arguments, UpdateMessage.ManagedRequired);
  if (!managedTarget(installation, await readlink(launcher)))
    throw new TitanError(ErrorCode.Arguments, UpdateMessage.ManagedRequired);
  return { installation, launcher, previous: await readlink(launcher), runtime: executable[0] };
}

async function selectLauncher(installation: string, expected: string, next: string): Promise<void> {
  const launcher = join(installation, UpdateFile.Launcher);
  if (!(await lstat(launcher)).isSymbolicLink() || (await readlink(launcher)) !== expected)
    throw new TitanError(ErrorCode.ConfigConflict, UpdateMessage.LauncherChanged);
  const temporary = join(installation, UpdateFile.NextLauncher + newId());
  try {
    await symlink(next, temporary);
    await rename(temporary, launcher);
    const directory = await open(installation, FileOpenMode.Read);
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } finally {
    await rm(temporary, { force: true });
  }
}

async function recordTransaction(home: string, transaction: UpdateTransaction): Promise<void> {
  await atomicWrite(
    join(home, UpdateFile.Transaction),
    JSON.stringify(UpdateTransactionSchema.parse(transaction)),
  );
}

async function recoverUpdate(home: string, installation: string): Promise<boolean> {
  const transaction = await readTransaction(home);
  if (!transaction || !unfinished(transaction)) return false;
  if (
    transaction.installation !== installation ||
    !managedTarget(installation, transaction.previous) ||
    !managedTarget(installation, transaction.next)
  )
    throw new TitanError(ErrorCode.ConfigConflict, UpdateMessage.TransactionChanged);
  if (transaction.backup) {
    if (
      dirname(resolve(transaction.backup)) !== resolve(home, UpdateFile.Backups) ||
      !(await lstat(transaction.backup)).isDirectory()
    )
      throw new TitanError(ErrorCode.ConfigConflict, UpdateMessage.TransactionChanged);
    const bytes = await readFileBytes(
      join(transaction.backup, UpdateFile.Manifest),
      IoLimit.DataBytes,
    );
    if (hash(bytes) !== transaction.backup_digest)
      throw new TitanError(ErrorCode.ConfigConflict, UpdateMessage.TransactionChanged);
    const verified = await verifyUpdateBackup(transaction.backup);
    if (verified.backup.roots[0]?.source !== resolve(home))
      throw new TitanError(ErrorCode.ConfigConflict, UpdateMessage.TransactionChanged);
  }
  const current = await readlink(join(installation, UpdateFile.Launcher));
  if (current === transaction.next)
    await selectLauncher(installation, current, transaction.previous);
  else if (current !== transaction.previous)
    throw new TitanError(ErrorCode.ConfigConflict, UpdateMessage.LauncherChanged);
  await recordTransaction(home, { ...transaction, phase: UpdatePhase.RolledBack });
  return true;
}

async function stopForUpdate(context: CommandContext): Promise<void> {
  const running = await probeDaemon(context.home, DaemonStartup.ProbeMilliseconds, null);
  if (running) await requestServerStop(context.home, context.options.force !== true);
}

function unsafeUninstall(): TitanError {
  return new TitanError(ErrorCode.ConfigConflict, UpdateMessage.UninstallOwnership);
}

function optionalMetadata(path: string) {
  return lstat(path, { bigint: true }).catch((error: unknown) => {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing)
      return null;
    throw error;
  });
}

async function ownsDirectory(path: string): Promise<boolean> {
  const metadata = await optionalMetadata(path);
  return (
    metadata?.isDirectory() === true &&
    metadata.uid === BigInt(process.getuid?.() ?? -1) &&
    (metadata.mode & BigInt(UpdateFile.UnsafeWriteMode)) === 0n &&
    (await realpath(path)) === path
  );
}

async function uninstallLauncher(context: CommandContext) {
  const executable = context.services.executable;
  if (!executable) throw new TitanError(ErrorCode.Arguments, UpdateMessage.UninstallUnmanaged);
  const entry = await realpath(executable[1]);
  const release = managedRelease(entry);
  if (!release) throw new TitanError(ErrorCode.Arguments, UpdateMessage.UninstallUnmanaged);
  const installation = resolve(release, Packaging.InstallationFromRelease);
  const launcher = join(installation, UpdateFile.Launcher);
  const metadata = await optionalMetadata(launcher);
  if (
    !metadata?.isSymbolicLink() ||
    metadata.uid !== BigInt(process.getuid?.() ?? -1) ||
    !(await ownsDirectory(installation)) ||
    (await readlink(launcher)) !== relative(installation, join(release, Packaging.CliPath)) ||
    (await realpath(launcher)) !== entry
  )
    throw unsafeUninstall();
  return { installation, launcher, metadata };
}

async function ownedPathLink(installation: string, launcher: string) {
  const file = join(installation, UpdateFile.CommandOwnership);
  const record = await optionalMetadata(file);
  if (!record) return null;
  if (
    !record.isFile() ||
    record.nlink !== 1n ||
    record.uid !== BigInt(process.getuid?.() ?? -1) ||
    (record.mode & BigInt(UpdateFile.UnsafeWriteMode)) !== 0n
  )
    throw unsafeUninstall();
  const value = InstallCommandLinkSchema.safeParse(
    JSON.parse((await readFileBytes(file, IoLimit.DataBytes)).toString()),
  );
  if (!value.success) throw unsafeUninstall();
  const { path, device, inode, changed_ns } = value.data;
  if (path !== resolve(path) || path === launcher || basename(path) !== UpdateFile.Launcher)
    throw unsafeUninstall();
  const metadata = await optionalMetadata(path);
  if (!metadata) return null;
  if (
    !(await ownsDirectory(dirname(path))) ||
    !metadata.isSymbolicLink() ||
    metadata.uid !== BigInt(process.getuid?.() ?? -1) ||
    metadata.dev.toString() !== device ||
    metadata.ino.toString() !== inode ||
    metadata.ctimeNs.toString() !== changed_ns ||
    (await readlink(path)) !== launcher
  )
    throw unsafeUninstall();
  return path;
}

export async function uninstallManaged(context: CommandContext) {
  const { installation, launcher, metadata } = await uninstallLauncher(context);
  await using resources = new AsyncDisposableStack();
  await ownMaintenance(installation, resources);
  const command = await ownedPathLink(installation, launcher);
  const home = (await optionalMetadata(context.home)) ? await realpath(context.home) : null;
  if (unfinished(await readTransaction(installation)))
    throw new TitanError(ErrorCode.ServerLocked, UpdateMessage.RecoveryRequired);
  if (home && home !== installation) await checkExternalHome(home);
  if (await probeDaemon(installation, DaemonStartup.ProbeMilliseconds, null))
    await requestServerStop(installation);
  await ownStoppedHome(installation, resources);
  await ownKnowledge(installation, resources);
  const current = await uninstallLauncher(context);
  if (current.metadata.ino !== metadata.ino || current.metadata.dev !== metadata.dev)
    throw unsafeUninstall();
  if ((await ownedPathLink(installation, launcher)) !== command) throw unsafeUninstall();
  if (command) await unlink(command);
  await unlink(launcher);
  return { data: { launcher, path_link: command }, exitCode: ExitCode.Success };
}

async function externalLeaseBusy(home: string, name: string): Promise<boolean> {
  const filename = join(home, name);
  const metadata = await optionalMetadata(filename);
  if (!metadata) return false;
  if (!metadata.isFile() || metadata.size !== 0n)
    throw new TitanError(ErrorCode.ServerLocked, UpdateMessage.UninstallExternalLease);
  const database = new Bun.SQL({ adapter: ServerDatabaseAdapter, filename, readonly: true });
  try {
    await database.unsafe(UpdateFile.ReadLease);
    return false;
  } catch (error) {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === ConfigWrite.Busy)
      return true;
    throw error;
  } finally {
    await database.close();
  }
}

async function checkExternalHome(home: string): Promise<void> {
  if (
    (await probeDaemon(home, DaemonStartup.ProbeMilliseconds, null)) ||
    (await externalLeaseBusy(home, ServerFile.Lease)) ||
    (await externalLeaseBusy(home, KnowledgeFile.Lease))
  )
    throw new TitanError(ErrorCode.ServerBusy, UpdateMessage.UninstallExternalBusy);
  if (
    (await externalLeaseBusy(home, ServerFile.MaintenanceLease)) ||
    unfinished(await readTransaction(home))
  )
    throw new TitanError(ErrorCode.ServerLocked, UpdateMessage.UninstallExternalMaintenance);
}

async function stagedCommand(runtime: string, entry: string, args: readonly string[], cwd: string) {
  const result = await captureCommand([runtime, entry, ...args], cwd, {
    timeout_ms: UpdateFile.PackageMilliseconds,
    maximum_bytes: Packaging.OutputBytes,
  });
  if (result.exit_code !== ExitCode.Success)
    throw new TitanError(ErrorCode.Arguments, UpdateMessage.PackageFailed);
  const output = CliOutputSchema.parse(JSON.parse(result.stdout.toString()));
  if (output.error) throw new TitanError(ErrorCode.Arguments, UpdateMessage.PackageFailed);
  return output.data;
}

async function validateRelease(
  runtime: string,
  staged: string,
  backup: string,
  current: string,
): Promise<string> {
  const entry = join(staged, Packaging.InstalledPath, Packaging.Bundle);
  const version = UpdateVersionSchema.parse(
    await stagedCommand(runtime, entry, [ProbeOption.Version, CliRuntime.JsonFlag], staged),
  ).version;
  const before = releaseVersion(current);
  const after = releaseVersion(version);
  if (!before || !after || compareRelease(after, before) <= 0)
    throw new TitanError(ErrorCode.Arguments, UpdateMessage.Downgrade);
  const report = UpdateDoctorSchema.parse(
    await stagedCommand(
      runtime,
      entry,
      [
        CliCommand.Doctor,
        ProbeOption.Home,
        join(backup, UpdateFile.Home),
        ProbeOption.Backup,
        backup,
        CliRuntime.JsonFlag,
      ],
      staged,
    ),
  );
  if (report.prerequisites.some((item) => item.required && !item.ready))
    throw new TitanError(ErrorCode.Arguments, UpdateMessage.PackageFailed);
  await verifyUpdateBackup(backup);
  return version;
}

export async function installUpdate(context: CommandContext, observe?: UpdateInstallObserver) {
  const managed = await managedInstallation(context);
  let archive = context.options.from
    ? await realpath(resolve(context.services.cwd(), context.options.from))
    : null;
  if (archive && !(await lstat(archive)).isFile())
    throw new TitanError(ErrorCode.Arguments, UpdateMessage.PackageRequired);
  const pending = unfinished(await readTransaction(context.home));
  const selected =
    archive || pending ? null : await selectUpdateRelease(context.home, context.services.version);
  if (!archive && !pending && !selected)
    return { current_version: context.services.version, updated: false };
  await mkdir(context.home, { recursive: true, mode: ServerLimit.DirectoryMode });
  await using resources = new AsyncDisposableStack();
  if (resolve(context.home) !== managed.installation)
    await ownMaintenance(managed.installation, resources);
  await ownMaintenance(context.home, resources);
  await stopForUpdate(context);
  await ownStoppedHome(context.home, resources);
  if (!pending && selected) {
    const source = await mkdtemp(join(managed.installation, UpdateFile.SourcePrefix));
    resources.defer(() => rm(source, { recursive: true, force: true }));
    archive = await buildUpdateRelease(selected, source, managed.runtime);
  }
  const recovered = await recoverUpdate(context.home, managed.installation);
  if (recovered) return { recovered: true, launcher: managed.launcher };
  if (!archive) {
    throw new TitanError(ErrorCode.Arguments, UpdateMessage.PackageRequired);
  }
  const catalog = await inspectUpdateCatalog(context.home);
  const projects = [...new Set([...catalog.projects, context.project])].map(projectHubHome).sort();
  await ownKnowledge(context.home, resources);
  for (const project of projects)
    if (project !== resolve(context.home) && (await exists(project)))
      await ownKnowledge(project, resources);
  const releases = join(managed.installation, Packaging.Releases);
  if (!(await lstat(releases)).isDirectory())
    throw new TitanError(ErrorCode.Arguments, UpdateMessage.ManagedRequired);
  const staged = await mkdtemp(join(releases, Packaging.ArchivePrefix));
  await chmod(staged, ServerLimit.DirectoryMode);
  const transaction: UpdateTransaction = {
    schema_version: 1,
    installation: managed.installation,
    previous: managed.previous,
    next: relative(managed.installation, join(staged, Packaging.CliPath)),
    phase: UpdatePhase.Preparing,
    backup: null,
    backup_digest: null,
  };
  await recordTransaction(context.home, transaction);
  try {
    await observe?.(transaction.phase);
    const roots = [...projects, ...catalog.runs];
    const present: string[] = [];
    for (const root of roots) if (await exists(root)) present.push(root);
    const backup = await createUpdateBackup(context.home, present, context.services.version);
    transaction.backup = backup;
    transaction.backup_digest = hash(
      await readFileBytes(join(backup, UpdateFile.Manifest), IoLimit.DataBytes),
    );
    transaction.phase = UpdatePhase.BackedUp;
    await recordTransaction(context.home, transaction);
    await observe?.(transaction.phase);
    await atomicWrite(join(staged, HookFile.Manifest), UpdateFile.PrivateManifest);
    const installed = await captureCommand(
      [managed.runtime, PackageManagerArgument.Add, UpdateFile.IgnoreScripts, archive],
      staged,
      { timeout_ms: UpdateFile.PackageMilliseconds, maximum_bytes: Packaging.OutputBytes },
    );
    if (installed.exit_code !== ExitCode.Success)
      throw new TitanError(ErrorCode.Arguments, UpdateMessage.PackageFailed);
    transaction.phase = UpdatePhase.Installed;
    await recordTransaction(context.home, transaction);
    await observe?.(transaction.phase);
    const version = await validateRelease(
      managed.runtime,
      staged,
      backup,
      context.services.version,
    );
    if (selected && version !== selected.version)
      throw new TitanError(ErrorCode.ConfigConflict, UpdateMessage.TransactionChanged);
    const selectedRelease = join(
      releases,
      [Packaging.ArchivePrefix + version, newId()].join(UpdateFile.Separator),
    );
    await rename(staged, selectedRelease);
    transaction.next = relative(managed.installation, join(selectedRelease, Packaging.CliPath));
    transaction.phase = UpdatePhase.Verified;
    await recordTransaction(context.home, transaction);
    await observe?.(transaction.phase);
    await selectLauncher(managed.installation, transaction.previous, transaction.next);
    transaction.phase = UpdatePhase.Switched;
    await recordTransaction(context.home, transaction);
    await observe?.(transaction.phase);
    transaction.phase = UpdatePhase.Complete;
    await recordTransaction(context.home, transaction);
    return { version, backup, launcher: managed.launcher };
  } catch (error) {
    let reason = error;
    try {
      await recoverUpdate(context.home, managed.installation);
    } catch (recovery) {
      reason = recovery;
    }
    if (transaction.backup) {
      const failure = new TitanError(
        reason instanceof TitanError ? reason.code : ErrorCode.Arguments,
        updateBackupRetained(errorMessage(reason), transaction.backup),
        reason instanceof TitanError ? reason.exitCode : ExitCode.Input,
        [transaction.backup],
      );
      failure.cause = reason;
      throw failure;
    }
    throw reason;
  }
}

export async function runAutomaticUpdate(
  context: CommandContext,
  args: readonly string[],
): Promise<number | null> {
  if (!context.services.handoff || (await updateSettings(context.home)).mode !== UpdateMode.Auto)
    return null;
  const result = await installUpdate({
    ...context,
    options: { ...context.options, force: false, from: undefined },
  }).catch((error: unknown) => {
    if (
      !(
        error instanceof TitanError &&
        (error.code === ErrorCode.ServerBusy || error.code === ErrorCode.ServerLocked)
      )
    )
      context.services.notice(UpdateMessage.AutomaticFailed);
    return null;
  });
  if (!result?.launcher) return null;
  return context.services.handoff(result.launcher, args, context.project);
}
