import { createHash, type Hash } from "node:crypto";
import { access, lstat, mkdir, open, rename, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  ErrorCode,
  ErrorField,
  FileEncoding,
  FileErrorCode,
  FileOpenMode,
  GitArgument,
  HashAlgorithm,
  PathPart,
  ProcessIo,
  SnapshotHashText,
  TextSymbol,
  WorkspaceFile,
  WorkspaceLimit,
  WorkspaceMode,
} from "@titan/constants";
import { all, hash, newId } from "@titan/core";
import { TitanError } from "@titan/errors";
import { WorkspaceMessage } from "@titan/messages";
import { readBytes } from "@titan/streams";
import type { FileEntry, FileMap, SecretScannerFactory, WorkspaceLimitsInput } from "@titan/types";
import { assertRelative } from "./paths.ts";

import { copyContents, sourceChunks } from "./source.ts";
import { assertManifestBounds, readTree } from "./tree.ts";

export { assertRelative } from "./paths.ts";
export { fileVersion, sourceChunks, sourceVersion, verifiedChunks } from "./source.ts";
export { assertManifestBounds, readTree } from "./tree.ts";

async function assertFileParents(root: string, path: string): Promise<void> {
  assertRelative(path);
  let parent = root;
  for (const component of [PathPart.Current, ...path.split(PathPart.Separator).slice(0, -1)]) {
    parent = resolve(parent, component);
    const metadata = await lstat(parent);
    if (metadata.isSymbolicLink() || !metadata.isDirectory())
      throw new TitanError(ErrorCode.SnapshotChanged, path);
  }
}

export async function readWorkspaceFile(
  root: string,
  path: string,
  maximum: number,
): Promise<Buffer> {
  await assertFileParents(root, path);
  const source = resolve(root, path);
  const metadata = await lstat(source);
  return readBytes(
    sourceChunks(source, Boolean(metadata.mode & WorkspaceMode.ExecutableBits)),
    maximum,
  );
}

export async function readRetainedFile(
  root: string,
  path: string,
  expected: string,
  maximum: number,
): Promise<Buffer> {
  await assertFileParents(root, path);
  const bytes = await readBytes(sourceChunks(resolve(root, path), false), maximum);
  if (hash(bytes) !== expected) throw new TitanError(ErrorCode.SnapshotChanged, path);
  return bytes;
}

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing)
      return false;
    throw error;
  }
}

export function fileIdentity(file: FileEntry | undefined): string | undefined {
  if (!file) return undefined;
  return file.executable ? hash(WorkspaceMode.ExecutableHashPrefix + file.hash) : file.hash;
}

async function updateTreeHash(digest: Hash, file: FileEntry): Promise<void> {
  const content = createHash(HashAlgorithm.Sha256);
  let tail = Buffer.alloc(0);
  let bytes = 0;
  for await (const chunk of sourceChunks(file.source, file.executable)) {
    content.update(chunk);
    bytes += chunk.length;
    const input = Buffer.concat([tail, chunk]);
    const complete = input.length - (input.length % 3);
    digest.update(input.subarray(0, complete).toString(FileEncoding.Base64));
    tail = Buffer.from(input.subarray(complete));
  }
  if (bytes !== file.bytes || content.digest(FileEncoding.Hex) !== file.hash)
    throw new TitanError(ErrorCode.SnapshotChanged, file.source);
  digest.update(tail.toString(FileEncoding.Base64));
}

export async function treeHash(files: FileMap): Promise<string> {
  const digest = createHash(HashAlgorithm.Sha256);
  digest.update(SnapshotHashText.Start);
  let separator: string = TextSymbol.Empty;
  for (const [path, file] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    digest.update(
      separator +
        SnapshotHashText.EntryStart +
        JSON.stringify(path) +
        SnapshotHashText.ContentStart,
    );
    await updateTreeHash(digest, file);
    digest.update(
      file.executable ? SnapshotHashText.ExecutableEntryEnd : SnapshotHashText.EntryEnd,
    );
    separator = SnapshotHashText.Separator;
  }
  digest.update(SnapshotHashText.End);
  return digest.digest(FileEncoding.Hex);
}

async function assertUnlinkedParents(root: string, path: string): Promise<void> {
  let parent = root;
  if ((await lstat(root)).isSymbolicLink()) throw new TitanError(ErrorCode.UnsafeSymlink, root);
  for (const component of path.split(PathPart.Separator).slice(0, -1)) {
    parent = resolve(parent, component);
    await mkdir(parent, { recursive: true });
    if ((await lstat(parent)).isSymbolicLink())
      throw new TitanError(ErrorCode.UnsafeSymlink, parent);
  }
}

async function copyVerified(
  destination: string,
  entry: FileEntry,
  extra?: SecretScannerFactory,
): Promise<void> {
  const temporary = destination + TextSymbol.Dot + newId() + WorkspaceFile.TemporarySuffix;
  const target = await open(temporary, FileOpenMode.Exclusive, WorkspaceMode.PrivateFile);
  try {
    await copyContents(target, entry, extra);
    await target.chmod(
      entry.executable ? WorkspaceMode.PrivateExecutable : WorkspaceMode.PrivateFile,
    );
    await target.sync();
    await target.close();
    await rename(temporary, destination);
    const parent = await open(dirname(destination), FileOpenMode.Read);
    try {
      await parent.sync();
    } finally {
      await parent.close();
    }
  } finally {
    await target.close();
    await rm(temporary, { force: true });
  }
}

export async function writeTree(
  root: string,
  files: FileMap,
  limits?: WorkspaceLimitsInput,
  scanner?: SecretScannerFactory,
): Promise<void> {
  assertManifestBounds(files, limits);
  await mkdir(root, { recursive: true });
  for (const path of Object.keys(files)) {
    assertRelative(path);
    scanner?.().accept(Buffer.from(path));
    await assertUnlinkedParents(root, path);
  }
  for (const old of Object.keys(await readTree(root, limits, scanner))) {
    if (!(old in files)) await rm(resolve(root, old));
  }
  await all(
    Object.entries(files).map(
      ([path, file]) =>
        () =>
          copyVerified(safeDestination(root, path), file, scanner),
    ),
  );
}

export async function putBack(
  root: string,
  files: FileMap,
  removals: readonly string[],
): Promise<void> {
  for (const path of removals) assertRelative(path);
  for (const path of Object.keys(files)) {
    assertRelative(path);
    await assertUnlinkedParents(root, path);
  }
  await all(
    Object.entries(files).map(
      ([path, file]) =>
        () =>
          copyVerified(safeDestination(root, path), file),
    ),
  );
  await all(removals.map((path) => () => rm(safeDestination(root, path), { force: true })));
}

export function safeDestination(root: string, path: string): string {
  return resolve(root, assertRelative(path));
}

async function processText(stream: ReadableStream<Uint8Array>, stop: () => void): Promise<string> {
  try {
    return (await readBytes(stream, WorkspaceLimit.ProcessOutputBytes))
      .toString(FileEncoding.Utf8)
      .trim();
  } catch (error) {
    stop();
    if (error instanceof TitanError && error.code === ErrorCode.StreamLimit)
      throw new TitanError(ErrorCode.GitError, WorkspaceMessage.GitOutputLimit);
    throw error;
  }
}

export async function git(project: string, args: string[]): Promise<string> {
  const child = Bun.spawn([GitArgument.Command, GitArgument.Directory, project, ...args], {
    stdout: ProcessIo.Pipe,
    stderr: ProcessIo.Pipe,
  });
  let out: string = TextSymbol.Empty;
  let err: string = TextSymbol.Empty;
  let exit = 0;
  try {
    await all([
      async () => {
        out = await processText(child.stdout, () => {
          child.kill();
        });
      },
      async () => {
        err = await processText(child.stderr, () => {
          child.kill();
        });
      },
      async () => {
        exit = await child.exited;
      },
    ]);
    if (exit !== 0) throw new TitanError(ErrorCode.GitError, err);
    return out;
  } finally {
    child.kill();
    await child.exited;
  }
}

export async function createWorkspace(
  project: string,
  path: string,
  files: FileMap,
  limits?: WorkspaceLimitsInput,
): Promise<void> {
  assertManifestBounds(files, limits);
  if (!(await exists(path)) && (await exists(resolve(project, WorkspaceFile.Git))))
    await git(project, [
      GitArgument.Worktree,
      GitArgument.Add,
      GitArgument.Detach,
      path,
      GitArgument.Head,
    ]);
  else await mkdir(path, { recursive: true });
  await writeTree(path, files, limits);
}

export { LocalModelStore } from "./model-store.ts";

export { writeWorkspaceFile } from "./write-file.ts";
