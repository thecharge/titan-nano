import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  chmod,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readlink,
  realpath,
  rename,
  rm,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import {
  ErrorCode,
  FileEncoding,
  FileOpenMode,
  HashAlgorithm,
  IoLimit,
  PathPart,
  ServerLimit,
  UpdateBackupStage,
  UpdateFile,
  WorkspaceMode,
} from "@titan/constants";
import { newId } from "@titan/core";
import { TitanError } from "@titan/errors";
import { UpdateMessage } from "@titan/messages";
import { inspectUpdateCatalog } from "@titan/server/maintenance";
import { atomicWrite, readFileBytes } from "@titan/streams";
import { type UpdateBackupObserver, type UpdateBackupRoot, UpdateBackupSchema } from "@titan/types";
import { sourceChunks } from "@titan/workspace";

async function entryDigest(path: string, mode: number): Promise<string> {
  const digest = createHash(HashAlgorithm.Sha256);
  for await (const chunk of sourceChunks(path, Boolean(mode & WorkspaceMode.ExecutableBits)))
    digest.update(chunk);
  return digest.digest(FileEncoding.Hex);
}

async function* backupEntries(
  root: string,
  path = root,
  synchronize = false,
): AsyncGenerator<readonly [string, string]> {
  const entry = await lstat(path, { bigint: true });
  const identity = [entry.dev, entry.ino, entry.size, entry.mtimeNs, entry.ctimeNs, entry.mode].map(
    String,
  );
  const name = relative(root, path);
  if (entry.isSymbolicLink()) {
    yield [
      JSON.stringify([name, Number(entry.mode), await readlink(path)]),
      JSON.stringify(identity),
    ];
    return;
  }
  if (entry.isFile()) {
    yield [
      JSON.stringify([name, Number(entry.mode), await entryDigest(path, Number(entry.mode))]),
      JSON.stringify(identity),
    ];
    if (synchronize) await synchronizeBackup(path);
    return;
  }
  if (!entry.isDirectory())
    throw new TitanError(ErrorCode.UnsupportedFile, UpdateMessage.BackupSpecial);
  yield [JSON.stringify([name, Number(entry.mode)]), JSON.stringify(identity)];
  for (const child of (await readdir(path)).sort())
    yield* backupEntries(root, join(path, child), synchronize);
  if (synchronize) await synchronizeBackup(path);
}

async function synchronizeBackup(path: string): Promise<void> {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    await file.sync();
  } finally {
    await file.close();
  }
}

async function backupDigest(root: string, synchronize = false) {
  const content = createHash(HashAlgorithm.Sha256);
  const identity = createHash(HashAlgorithm.Sha256);
  for await (const [entry, version] of backupEntries(root, root, synchronize)) {
    content.update(entry);
    identity.update(version);
  }
  return { content: content.digest(FileEncoding.Hex), identity: identity.digest(FileEncoding.Hex) };
}

function contains(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return (
    path.length === 0 ||
    (path !== PathPart.Parent && !path.startsWith(PathPart.ParentPrefix) && !isAbsolute(path))
  );
}

async function copyBackupRoot(source: string, copy: string, observe?: UpdateBackupObserver) {
  if (!(await lstat(source)).isDirectory())
    throw new TitanError(ErrorCode.Arguments, UpdateMessage.BackupPath);
  const before = await backupDigest(source);
  await cp(source, copy, {
    recursive: true,
    preserveTimestamps: true,
    verbatimSymlinks: true,
    force: false,
    errorOnExist: true,
  });
  await observe?.(UpdateBackupStage.Copied, source);
  const copied = await backupDigest(copy, true);
  const after = await backupDigest(source);
  if (
    before.content !== copied.content ||
    before.content !== after.content ||
    before.identity !== after.identity
  )
    throw new TitanError(ErrorCode.SnapshotChanged, UpdateMessage.BackupChanged);
  await observe?.(UpdateBackupStage.Verified, source);
  return before;
}

export async function createUpdateBackup(
  home: string,
  projects: readonly string[],
  version: string,
  observe?: UpdateBackupObserver,
): Promise<string> {
  home = resolve(home);
  const created = Date.now();
  UpdateBackupSchema.shape.version.parse(version);
  const enclosing =
    [home, ...projects.map((path) => resolve(path))]
      .filter((path) => contains(path, home))
      .sort((left, right) => left.length - right.length)[0] ?? home;
  const temporary = await mkdtemp(join(dirname(enclosing), UpdateFile.TemporaryPrefix));
  await chmod(temporary, ServerLimit.DirectoryMode);
  try {
    const roots: UpdateBackupRoot[] = [];
    const first = await copyBackupRoot(home, join(temporary, UpdateFile.Home), observe);
    roots.push({
      source: home,
      copy: UpdateFile.Home,
      digest: first.content,
      identity: first.identity,
    });
    for (const project of [...new Set(projects.map((path) => resolve(path)))].sort()) {
      if (roots.some((root) => contains(root.source, project))) continue;
      const copy = join(UpdateFile.Projects, String(roots.length));
      const copied = await copyBackupRoot(project, join(temporary, copy), observe);
      roots.push({ source: project, copy, digest: copied.content, identity: copied.identity });
    }
    for (const root of roots) {
      const final = await backupDigest(root.source);
      if (final.content !== root.digest || final.identity !== root.identity)
        throw new TitanError(ErrorCode.SnapshotChanged, UpdateMessage.BackupChanged);
    }
    const manifest = UpdateBackupSchema.parse({
      schema_version: 1,
      version,
      created_at: created,
      roots,
    });
    await atomicWrite(join(temporary, UpdateFile.Manifest), JSON.stringify(manifest));
    const backups = join(home, UpdateFile.Backups);
    await mkdir(backups, { recursive: true, mode: ServerLimit.DirectoryMode });
    if (!(await lstat(backups)).isDirectory())
      throw new TitanError(ErrorCode.Arguments, UpdateMessage.BackupPath);
    const destination = join(backups, [version, created, newId()].join(UpdateFile.Separator));
    await rename(temporary, destination);
    const directory = await open(backups, FileOpenMode.Read);
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
    return destination;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function verifyUpdateBackup(directory: string) {
  directory = await realpath(directory);
  const backup = UpdateBackupSchema.parse(
    JSON.parse(
      (await readFileBytes(join(directory, UpdateFile.Manifest), IoLimit.DataBytes)).toString(),
    ),
  );
  if (
    backup.roots[0]?.copy !== UpdateFile.Home ||
    new Set(backup.roots.map((root) => root.copy)).size !== backup.roots.length
  )
    throw new TitanError(ErrorCode.Arguments, UpdateMessage.BackupPath);
  for (const root of backup.roots) {
    const copy = resolve(directory, root.copy);
    if (
      copy === resolve(directory) ||
      !contains(resolve(directory), copy) ||
      !(await lstat(copy)).isDirectory() ||
      (await realpath(copy)) !== copy
    )
      throw new TitanError(ErrorCode.Arguments, UpdateMessage.BackupPath);
    if ((await backupDigest(copy)).content !== root.digest)
      throw new TitanError(ErrorCode.SnapshotChanged, UpdateMessage.BackupChanged);
  }
  const locate = (source: string): string => {
    const root = backup.roots.find((entry) => contains(entry.source, source));
    if (!root) throw new TitanError(ErrorCode.Arguments, UpdateMessage.BackupPath);
    return resolve(directory, root.copy, relative(root.source, source));
  };
  const catalog = await inspectUpdateCatalog(join(directory, UpdateFile.Home), backup, locate);
  return { backup, catalog };
}
