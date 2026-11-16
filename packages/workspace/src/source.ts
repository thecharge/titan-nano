import { createHash } from "node:crypto";
import { type BigIntStats, constants } from "node:fs";
import { type FileHandle, lstat, open } from "node:fs/promises";
import { createSecretScanner } from "@titan/config";
import {
  ErrorCode,
  ErrorField,
  FileEncoding,
  FileErrorCode,
  HashAlgorithm,
  PathPart,
  WorkspaceMode,
} from "@titan/constants";
import { writeAll } from "@titan/core";
import { TitanError } from "@titan/errors";
import { snapshotSpecialFile, WorkspaceMessage } from "@titan/messages";
import { fileHandleChunks } from "@titan/streams";
import type { FileEntry, SecretScanner, SecretScannerFactory } from "@titan/types";

function fileScanner(extra?: SecretScannerFactory): SecretScanner {
  const scanner = createSecretScanner();
  const scoped = extra?.();
  return {
    accept(bytes) {
      scanner.accept(bytes);
      scoped?.accept(bytes);
    },
  };
}

export function fileVersion(metadata: BigIntStats): string {
  return [
    metadata.dev,
    metadata.ino,
    metadata.size,
    metadata.mtimeNs,
    metadata.ctimeNs,
    metadata.mode,
  ].join(PathPart.Separator);
}

export async function sourceVersion(source: string): Promise<string> {
  const metadata = await lstat(source, { bigint: true });
  if (!metadata.isFile()) throw new TitanError(ErrorCode.SnapshotChanged, source);
  return fileVersion(metadata);
}

async function assertMode(file: FileHandle, source: string, executable: boolean): Promise<string> {
  const metadata = await file.stat({ bigint: true });
  if (!metadata.isFile())
    throw new TitanError(ErrorCode.UnsupportedFile, snapshotSpecialFile(source));
  if (Boolean(metadata.mode & BigInt(WorkspaceMode.ExecutableBits)) !== executable)
    throw new TitanError(ErrorCode.SnapshotChanged, WorkspaceMessage.SnapshotMode);
  return fileVersion(metadata);
}

async function assertSource(source: string, expected: string): Promise<void> {
  try {
    if ((await sourceVersion(source)) !== expected)
      throw new TitanError(ErrorCode.SnapshotChanged, source);
  } catch (error) {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing)
      throw new TitanError(ErrorCode.SnapshotChanged, source);
    throw error;
  }
}

export async function* sourceChunks(
  source: string,
  executable: boolean,
  expectedVersion?: string,
): AsyncGenerator<Buffer> {
  const file = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await assertMode(file, source, executable);
    if (expectedVersion !== undefined && before !== expectedVersion)
      throw new TitanError(ErrorCode.SnapshotChanged, source);
    for await (const chunk of fileHandleChunks(file)) yield chunk;
    const after = await assertMode(file, source, executable);
    await assertSource(source, after);
    if (after !== before) throw new TitanError(ErrorCode.SnapshotChanged, source);
  } finally {
    await file.close();
  }
}

export async function fileEntry(
  source: string,
  remainingBytes: number,
  extra?: SecretScannerFactory,
): Promise<FileEntry> {
  const digest = createHash(HashAlgorithm.Sha256);
  const scanner = fileScanner(extra);
  let bytes = 0;
  const executable = Boolean((await lstat(source)).mode & WorkspaceMode.ExecutableBits);
  for await (const chunk of sourceChunks(source, executable)) {
    bytes += chunk.length;
    if (bytes > remainingBytes)
      throw new TitanError(ErrorCode.WorkspaceBytes, WorkspaceMessage.Bytes);
    scanner.accept(chunk);
    digest.update(chunk);
  }
  return { source, hash: digest.digest(FileEncoding.Hex), bytes, executable };
}

export async function* verifiedChunks(
  entry: FileEntry,
  extra?: SecretScannerFactory,
  expectedVersion?: string,
): AsyncGenerator<Buffer> {
  const digest = createHash(HashAlgorithm.Sha256);
  const scanner = fileScanner(extra);
  let bytes = 0;
  for await (const chunk of sourceChunks(entry.source, entry.executable, expectedVersion)) {
    scanner.accept(chunk);
    digest.update(chunk);
    bytes += chunk.length;
    if (bytes > entry.bytes) throw new TitanError(ErrorCode.SnapshotChanged, entry.source);
    yield chunk;
  }
  if (bytes !== entry.bytes || digest.digest(FileEncoding.Hex) !== entry.hash)
    throw new TitanError(ErrorCode.SnapshotChanged, entry.source);
}

export async function copyContents(
  target: FileHandle,
  entry: FileEntry,
  extra?: SecretScannerFactory,
): Promise<void> {
  for await (const chunk of verifiedChunks(entry, extra))
    await writeAll(chunk, async (buffer, offset, length) => {
      const written = await target.write(buffer, offset, length);
      return written.bytesWritten;
    });
}
