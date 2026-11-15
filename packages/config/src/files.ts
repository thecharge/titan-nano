import { constants } from "node:fs";
import { chmod, mkdir, open } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  ConfigFile,
  ConfigScope,
  ConfigWrite,
  ErrorCode,
  ErrorField,
  FileEncoding,
  FileErrorCode,
  IoLimit,
  KnowledgeFile,
  Newline,
  WorkspaceFileLinks,
} from "@titan/constants";
import { hash, jsonByteLength } from "@titan/core";
import { TitanError } from "@titan/errors";
import { ConfigFileMessage } from "@titan/messages";
import { atomicWrite, readFileBytes } from "@titan/streams";
import {
  type ConfigFileChange,
  ConfigFileChangeSchema,
  type ConfigFileInspection,
  type ConfigFileTarget,
  ConfigFileTargetSchema,
} from "@titan/types";
import { merge, object, parseData, validateConfigDocument } from "./index.ts";

function targetPath(target: ConfigFileTarget): string {
  return target.scope === ConfigScope.User
    ? resolve(target.home, ConfigFile.User)
    : resolve(target.project, ConfigFile.Project);
}

async function contents(path: string): Promise<Buffer | null> {
  try {
    return await readFileBytes(path, IoLimit.DataBytes);
  } catch (error) {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing)
      return null;
    throw error;
  }
}

export async function describeConfigFile(input: ConfigFileTarget): Promise<ConfigFileInspection> {
  const target = ConfigFileTargetSchema.parse(input);
  const path = targetPath(target);
  const bytes = await contents(path);
  const config = await validateConfigDocument(
    bytes === null ? {} : parseData(bytes.toString(FileEncoding.Utf8)),
    target.scope,
    target.home,
    path,
  );
  return { scope: target.scope, path, version: bytes === null ? null : hash(bytes), config };
}

export async function inspectConfigFile(input: ConfigFileTarget) {
  const { path, version } = await describeConfigFile(input);
  return { path, version };
}

async function tryClaim(lease: Bun.SQL): Promise<boolean> {
  try {
    await lease.unsafe(ConfigWrite.Claim);
    return true;
  } catch (error) {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === ConfigWrite.Busy)
      return false;
    throw new TitanError(ErrorCode.ConfigLocked, ConfigFileMessage.Locked);
  }
}

async function claim(path: string, lease: Bun.SQL): Promise<void> {
  await lease.unsafe(ConfigWrite.Prepare);
  for (let attempt = 0; attempt < ConfigWrite.Attempts; attempt++) {
    if (await tryClaim(lease)) {
      await chmod(path, ConfigWrite.FileMode);
      return;
    }
    await Bun.sleep(ConfigWrite.RetryMilliseconds);
  }
  throw new TitanError(ErrorCode.ConfigLocked, ConfigFileMessage.Locked);
}

async function guardLease(
  path: string,
  resources: AsyncDisposableStack,
  create: boolean,
): Promise<void> {
  const file = await open(
    path,
    constants.O_RDWR |
      constants.O_NOFOLLOW |
      constants.O_NONBLOCK |
      (create ? constants.O_CREAT : 0),
    ConfigWrite.FileMode,
  ).catch((error: unknown) => {
    if (
      !create &&
      error instanceof Error &&
      Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing
    )
      return undefined;
    throw new TitanError(ErrorCode.ConfigLocked, ConfigFileMessage.Locked);
  });
  if (!file) return;
  resources.defer(() => file.close());
  const metadata = await file.stat();
  if (
    !metadata.isFile() ||
    metadata.nlink !== WorkspaceFileLinks ||
    (process.getuid && metadata.uid !== process.getuid())
  )
    throw new TitanError(ErrorCode.ConfigLocked, ConfigFileMessage.Locked);
}

async function replace(input: ConfigFileChange, path: string) {
  const previous = await contents(path);
  const version = previous === null ? null : hash(previous);
  if (version !== input.expected_version)
    throw new TitanError(ErrorCode.ConfigConflict, ConfigFileMessage.Conflict);
  const document = previous === null ? {} : object(parseData(previous.toString(FileEncoding.Utf8)));
  const changed = merge(document, object(input.patch));
  await validateConfigDocument(changed, input.scope, input.home);
  jsonByteLength(changed, IoLimit.DataBytes - Buffer.byteLength(Newline));
  const bytes = Buffer.from(JSON.stringify(changed) + Newline);
  await atomicWrite(path, bytes);
  return { path, version: hash(bytes) };
}

export async function writeConfigFile(input: ConfigFileChange) {
  const change = ConfigFileChangeSchema.parse(input);
  const path = targetPath(change);
  await mkdir(dirname(path), { recursive: true, mode: ConfigWrite.DirectoryMode });
  const lock = path + ConfigWrite.LockSuffix;
  await using resources = new AsyncDisposableStack();
  for (const suffix of KnowledgeFile.SqliteSidecars)
    await guardLease(lock + suffix, resources, suffix.length === 0);
  const lease = new Bun.SQL({ adapter: ConfigWrite.Adapter, filename: lock });
  try {
    await claim(lock, lease);
    return await replace(change, path);
  } finally {
    await lease.close();
  }
}
