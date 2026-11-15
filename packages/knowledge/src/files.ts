import { constants } from "node:fs";
import { lstat, mkdir, open, opendir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  ErrorCode,
  ErrorField,
  FileErrorCode,
  KnowledgeAttemptFile,
  KnowledgeFile,
  KnowledgeKind,
  ServerLimit,
} from "@titan/constants";
import { hash } from "@titan/core";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import { fileHandleChunks, readBytes } from "@titan/streams";
import { type KnowledgeAttemptScope, KnowledgeSelectionSchema } from "@titan/types";

export async function knowledgeDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: ServerLimit.DirectoryMode });
  if (!(await lstat(path)).isDirectory())
    throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
}

export async function assertKnowledgeFile(path: string): Promise<boolean> {
  try {
    const status = await lstat(path);
    if (!status.isFile() || status.nlink !== 1)
      throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
    return true;
  } catch (error) {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing)
      return false;
    throw error;
  }
}

export function knowledgePath(root: string, kind: KnowledgeKind, id: string): string {
  KnowledgeSelectionSchema.parse({ id });
  return join(root, kind, id + knowledgeExtension(kind));
}

export function knowledgeExtension(kind: KnowledgeKind): string {
  return kind === KnowledgeKind.Persona ? KnowledgeFile.Yaml : KnowledgeFile.Markdown;
}

export async function readKnowledgeBytes(path: string, maximum: number): Promise<Buffer> {
  await assertKnowledgeFile(path);
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const status = await file.stat();
    if (!status.isFile() || status.nlink !== 1 || status.size > maximum)
      throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
    return await readBytes(fileHandleChunks(file), maximum);
  } finally {
    await file.close();
  }
}

export async function optionalKnowledgeBytes(path: string, maximum: number) {
  try {
    return await readKnowledgeBytes(path, maximum);
  } catch (error) {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing)
      return null;
    throw error;
  }
}

async function* kindFiles(root: string, kind: KnowledgeKind, maximum: number) {
  const directory = join(root, kind);
  await knowledgeDirectory(directory);
  let scanned = 0;
  for await (const file of await opendir(directory)) {
    if (++scanned > maximum) throw new TitanError(ErrorCode.Capacity, KnowledgeMessage.Capacity);
    if (!file.isFile()) throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
    if (file.name.endsWith(knowledgeExtension(kind))) yield join(directory, file.name);
  }
}

export async function* knowledgeFiles(root: string, maximum: number) {
  for (const kind of Object.values(KnowledgeKind)) yield* kindFiles(root, kind, maximum);
}

export async function removeKnowledgeFile(path: string, parent: string): Promise<void> {
  await rm(path, { force: true });
  const directory = await open(
    parent,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}

export function knowledgeAttemptPath(directory: string, scope: KnowledgeAttemptScope): string {
  return join(directory, hash(JSON.stringify(scope)) + KnowledgeAttemptFile.Extension);
}
