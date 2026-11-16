import { constants } from "node:fs";
import { lstat, mkdir, open } from "node:fs/promises";
import { resolve } from "node:path";
import { createSecretScanner } from "@titan/config";
import {
  ErrorCode,
  ErrorField,
  FileErrorCode,
  PathPart,
  WorkspaceFileLinks,
  WorkspaceMode,
} from "@titan/constants";
import { writeAll } from "@titan/core";
import { OperationalError } from "@titan/errors";
import { NativeToolMessage } from "@titan/messages";
import { type NativeFileChange, NativeFileChangeSchema } from "@titan/types";
import { assertRelative } from "./paths.ts";
import { fileVersion } from "./source.ts";

async function parents(root: string, path: string, create: boolean): Promise<void> {
  let parent = root;
  for (const part of [PathPart.Current, ...path.split(PathPart.Separator).slice(0, -1)]) {
    parent = resolve(parent, part);
    const metadata = await lstat(parent).catch(async (error: unknown) => {
      if (
        !create ||
        !(error instanceof Error) ||
        Reflect.get(error, ErrorField.Code) !== FileErrorCode.Missing
      )
        throw error;
      await mkdir(parent, { mode: WorkspaceMode.PrivateExecutable });
      return lstat(parent);
    });
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
      throw new OperationalError(ErrorCode.PermissionDenied, NativeToolMessage.Denied);
  }
}

export async function writeWorkspaceFile(root: string, input: NativeFileChange): Promise<void> {
  const change = NativeFileChangeSchema.parse(input);
  assertRelative(change.path);
  const bytes = Buffer.from(change.content);
  createSecretScanner().accept(bytes);
  await parents(root, change.path, change.expected_version === null);
  const file = await open(
    resolve(root, change.path),
    constants.O_RDWR |
      constants.O_NOFOLLOW |
      constants.O_NONBLOCK |
      (change.expected_version === null ? constants.O_CREAT | constants.O_EXCL : 0),
    WorkspaceMode.PrivateFile,
  );
  try {
    const metadata = await file.stat({ bigint: true });
    if (
      !metadata.isFile() ||
      metadata.nlink !== BigInt(WorkspaceFileLinks) ||
      (change.expected_version !== null && fileVersion(metadata) !== change.expected_version)
    )
      throw new OperationalError(ErrorCode.FileConflict, NativeToolMessage.ReadChanged);
    await writeAll(bytes, async (buffer, offset, length) => {
      const written = await file.write(buffer, offset, length);
      return written.bytesWritten;
    });
    await file.truncate(bytes.length);
    await file.sync();
  } finally {
    await file.close();
  }
}
