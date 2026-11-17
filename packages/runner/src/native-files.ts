import { resolve } from "node:path";
import {
  ErrorCode,
  ErrorField,
  ExecutionPhase,
  FileEncoding,
  FileErrorCode,
  NativeFileField,
  NativeFileLimit,
  PathPart,
  RunFile,
  WorkspaceGeneratedDirectories,
} from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { NativeToolMessage } from "@titan/messages";
import { jsonBytes, readBytes } from "@titan/streams";
import {
  type NativeFileChange,
  type NativeFileListing,
  NativeFileListingSchema,
  type NativeFileListResult,
  NativeFileListSelectionSchema,
  type NativeFileObservation,
  type NativeFileResult,
  NativeFileSelectionSchema,
  type NativeReadObservation,
  type NativeToolScope,
  type Run,
  type Step,
} from "@titan/types";
import { readTree, sourceVersion, verifiedChunks, writeWorkspaceFile } from "@titan/workspace";
import { scopeCovers, writePaths } from "./file-scope.ts";
import { isWorkerKey } from "./native-execution.ts";
import { isSkillPath, readSkill } from "./skill-role.ts";

export function retainNativeRead(
  observations: NativeReadObservation[],
  observation: NativeReadObservation,
  maximum: number,
): NativeReadObservation[] {
  const encoded = JSON.stringify(observation);
  if (observations.some((entry) => JSON.stringify(entry) === encoded)) return observations;
  if (observations.length >= maximum)
    throw new OperationalError(ErrorCode.Capacity, NativeToolMessage.ReadCapacity);
  return [...observations, observation];
}

export async function listNativeFiles(
  run: Run,
  root: string,
  directory: string,
): Promise<NativeFileListResult> {
  NativeFileListSelectionSchema.parse({ directory });
  const tree = await readTree(root, run.config.value.limits, undefined, run.runtime_paths, [
    directory,
  ]);
  const files = Object.keys(tree).filter(
    (path) => directory === PathPart.Current || path.startsWith(directory + PathPart.Separator),
  );
  const result = { observation: NativeFileListingSchema.parse({ directory, files }) };
  await jsonBytes(result, NativeFileLimit.Bytes);
  return result;
}

function allowedWrite(run: Run, step: Step, path: string): boolean {
  return writePaths(run, step).some((entry) => scopeCovers(entry, path));
}

async function verifyListing(
  run: Run,
  root: string,
  step: Step,
  observation: NativeFileListing,
  writable: boolean,
): Promise<void> {
  const current = await listNativeFiles(run, root, observation.directory);
  const retained = observation.files.filter((path) => !writable || !allowedWrite(run, step, path));
  const observed = current.observation.files.filter(
    (path) => !writable || !allowedWrite(run, step, path),
  );
  if (JSON.stringify(retained) !== JSON.stringify(observed))
    throw new OperationalError(ErrorCode.FileConflict, NativeToolMessage.ReadChanged);
}

export function nativeFileRoot(run: Run, scope: NativeToolScope): string {
  const state = run.nodes[scope.step_id];
  const key = Object.entries(state?.phases ?? {}).find(
    ([, phase]) => phase.execution_id === scope.execution_id,
  )?.[0];
  if (!state?.work || !key)
    throw new OperationalError(ErrorCode.PermissionDenied, NativeToolMessage.Denied);
  if (isWorkerKey(key) || state.work === run.project) return state.work;
  return resolve(
    run.root,
    RunFile.Steps,
    scope.step_id,
    `${RunFile.AttemptPrefix}${state.attempt}`,
    `${RunFile.ReviewPrefix}${Number(key.slice(ExecutionPhase.FalsifierPrefix.length))}`,
  );
}

function readsProjectCache(run: Run, root: string, path: string): boolean {
  return (
    run.omit_generated_workspace === true &&
    root !== run.project &&
    path
      .split(PathPart.Separator)
      .slice(0, -1)
      .some((part) => WorkspaceGeneratedDirectories.includes(part)) &&
    !run.plan.nodes.some((node) => node.files !== undefined && allowedWrite(run, node, path))
  );
}

export async function readNativeFile(
  run: Run,
  root: string,
  path: string,
  allowProjectCache = false,
): Promise<NativeFileResult> {
  NativeFileSelectionSchema.parse({ path });
  const files = await readTree(root, run.config.value.limits, undefined, run.runtime_paths, [path]);
  const entry = files[path];
  if (!entry && allowProjectCache && readsProjectCache(run, root, path))
    return readNativeFile(run, run.project, path);
  if (!entry)
    return { observation: { path, version: null, hash: null, executable: null }, content: null };
  const version = await sourceVersion(entry.source);
  const content = await readBytes(verifiedChunks(entry, undefined, version), NativeFileLimit.Bytes);
  return {
    observation: { path, version, hash: entry.hash, executable: entry.executable },
    content: content.toString(FileEncoding.Base64),
  };
}

async function currentVersion(
  root: string,
  observation: NativeFileObservation,
): Promise<string | null> {
  try {
    return await sourceVersion(resolve(root, observation.path));
  } catch (error) {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing)
      return null;
    throw error;
  }
}

export async function verifyNativeReads(
  run: Run,
  step: Step,
  observations: readonly NativeReadObservation[],
  writable: boolean,
  root = run.nodes[step.id]?.work ?? run.project,
): Promise<void> {
  for (const observation of observations) {
    if (NativeFileField.Files in observation) {
      await verifyListing(run, root, step, observation, writable);
      continue;
    }
    if (isSkillPath(run, observation.path)) {
      if (readSkill(run, observation.path).observation.version !== observation.version)
        throw new OperationalError(ErrorCode.FileConflict, NativeToolMessage.ReadChanged);
      continue;
    }
    if (writable && allowedWrite(run, step, observation.path)) continue;
    const version = await currentVersion(root, observation);
    const current =
      version === null && readsProjectCache(run, root, observation.path)
        ? (await readNativeFile(run, run.project, observation.path)).observation.version
        : version;
    if (current !== observation.version)
      throw new OperationalError(ErrorCode.FileConflict, NativeToolMessage.ReadChanged);
  }
}

export async function writeNativeFile(
  run: Run,
  step: Step,
  root: string,
  change: NativeFileChange,
): Promise<NativeFileResult> {
  if (
    isSkillPath(run, change.path) ||
    !allowedWrite(run, step, change.path) ||
    run.runtime_paths?.some(
      (path) => scopeCovers(path, change.path) || scopeCovers(change.path, path),
    )
  )
    throw new OperationalError(ErrorCode.PermissionDenied, NativeToolMessage.Denied);
  await writeWorkspaceFile(root, change);
  return readNativeFile(run, root, change.path);
}
