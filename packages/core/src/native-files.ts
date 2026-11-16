import { lstat, opendir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ConfigDefault,
  ErrorCode,
  ErrorField,
  FileAccessMode,
  FileErrorCode,
  NativeWritePolicy,
  PathPart,
  WorkspaceFileLinks,
} from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { NativeToolMessage } from "@titan/messages";
import { type AgentSpec, WorkspaceRelativePathSchema } from "@titan/types";

async function ordinary(path: string) {
  return lstat(path).catch((error: unknown) => {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing)
      return undefined;
    throw error;
  });
}

async function entry(spec: AgentSpec, path: string) {
  let absolute = spec.cwd;
  for (const component of [PathPart.Current, ...path.split(PathPart.Separator)]) {
    absolute = resolve(absolute, component);
    const metadata = await ordinary(absolute);
    if (metadata?.isSymbolicLink())
      throw new OperationalError(ErrorCode.PermissionDenied, NativeToolMessage.Denied);
  }
  return ordinary(absolute);
}

function protectedPath(spec: AgentSpec, path: string): boolean {
  return (
    spec.file_scope?.exclude_paths?.some(
      (excluded) => path === excluded || path.startsWith(excluded + PathPart.Separator),
    ) ?? false
  );
}

async function appendDirectory(spec: AgentSpec, path: string, queue: string[]): Promise<void> {
  const directory = await opendir(resolve(spec.cwd, path));
  for await (const child of directory) {
    if (queue.length >= ConfigDefault.MaxWorkspaceEntriesLimit)
      throw new OperationalError(ErrorCode.Capacity, NativeToolMessage.ReadCapacity);
    queue.push(path === PathPart.Current ? child.name : path + PathPart.Separator + child.name);
  }
}

export async function nativeWritableFiles(spec: AgentSpec): Promise<string[]> {
  if (!spec.writable || spec.file_scope?.mode !== FileAccessMode.Write) return [];
  const queue = [...spec.file_scope.paths];
  const files = new Set<string>();
  if (queue.length > ConfigDefault.MaxWorkspaceEntriesLimit)
    throw new OperationalError(ErrorCode.Capacity, NativeToolMessage.ReadCapacity);
  let bytes = 0;
  for (const path of queue) {
    if (protectedPath(spec, path)) continue;
    if (path !== PathPart.Current && !WorkspaceRelativePathSchema.safeParse(path).success) continue;
    const metadata = await entry(spec, path);
    if (!metadata) continue;
    if (metadata.isDirectory()) {
      await appendDirectory(spec, path, queue);
      continue;
    }
    if (!metadata.isFile() || metadata.nlink !== WorkspaceFileLinks)
      throw new OperationalError(ErrorCode.PermissionDenied, NativeToolMessage.Denied);
    bytes +=
      Buffer.byteLength(JSON.stringify(path)) * (NativeWritePolicy.Metadata.length + 1) +
      NativeWritePolicy.EntryOverhead;
    if (bytes > NativeWritePolicy.MaximumGrantBytes || files.size >= NativeWritePolicy.MaximumFiles)
      break;
    files.add(path);
  }
  return [...files].sort((left, right) => left.localeCompare(right));
}
