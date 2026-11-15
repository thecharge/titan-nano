import { lstat, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import {
  ArtifactExportFile,
  ArtifactFormat,
  ErrorCode,
  ErrorField,
  FileErrorCode,
  FileOpenMode,
  IoLimit,
  PathPart,
  WorkspaceMode,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { ArtifactMessage } from "@titan/messages";
import {
  type ArtifactExport,
  ArtifactExportDestinationSchema,
  ArtifactExportManifestSchema,
  ArtifactExportSchema,
  ArtifactHashSchema,
  type Run,
  type WorkspaceWriter,
} from "@titan/types";
import { readTree, writeTree } from "@titan/workspace";
import { inspectArtifacts } from "./inspection.ts";

async function admitDestination(destination: string, root: string): Promise<string> {
  if (!ArtifactExportDestinationSchema.safeParse(destination).success)
    throw new TitanError(ErrorCode.Arguments, ArtifactMessage.Destination);
  const target = resolve(destination);
  const within = relative(root, target);
  if (
    !within ||
    (!within.startsWith(PathPart.ParentPrefix) && !within.startsWith(PathPart.Separator))
  )
    throw new TitanError(ErrorCode.UnsafePath, ArtifactMessage.Destination);
  let parent = dirname(target);
  while (true) {
    const entry = await lstat(parent).catch(() => {
      throw new TitanError(ErrorCode.UnsafePath, ArtifactMessage.Destination);
    });
    if (entry.isSymbolicLink())
      throw new TitanError(ErrorCode.UnsafeSymlink, ArtifactMessage.Destination);
    if (!entry.isDirectory())
      throw new TitanError(ErrorCode.UnsafePath, ArtifactMessage.Destination);
    const next = dirname(parent);
    if (next === parent) return target;
    parent = next;
  }
}

export async function exportArtifact(
  run: Run,
  id: string,
  destination: string,
  write: WorkspaceWriter = writeTree,
): Promise<ArtifactExport> {
  if (!ArtifactHashSchema.safeParse(id).success)
    throw new TitanError(ErrorCode.ArtifactNotFound, ArtifactMessage.NotFound);
  const target = await admitDestination(destination, run.root);
  const inspection = await inspectArtifacts(run);
  const file = inspection.files.find((entry) => entry.id === id);
  if (!file) throw new TitanError(ErrorCode.ArtifactNotFound, ArtifactMessage.NotFound);
  const delivery = ArtifactExportManifestSchema.parse({
    schema_version: ArtifactFormat.ExportVersion,
    run_id: inspection.run_id,
    workflow_id: inspection.workflow_id,
    workflow_revision: inspection.workflow_revision,
    state: inspection.state,
    delivery_hash: inspection.hash,
    file,
    content: [ArtifactExportFile.Content, file.path].join(PathPart.Separator),
    outputs: inspection.outputs,
  });
  const bytes = Buffer.from(JSON.stringify(delivery));
  if (bytes.length > IoLimit.DataBytes)
    throw new TitanError(ErrorCode.ArtifactExport, ArtifactMessage.Export);
  try {
    await mkdir(target, { mode: WorkspaceMode.PrivateExecutable });
  } catch (error) {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === FileErrorCode.Exists)
      throw new TitanError(ErrorCode.Exists, ArtifactMessage.Exists);
    throw new TitanError(ErrorCode.ArtifactExport, ArtifactMessage.Export);
  }
  try {
    await write(
      resolve(target, ArtifactExportFile.Content),
      {
        [file.path]: {
          source: resolve(inspection.directory, file.path),
          hash: file.hash,
          bytes: file.bytes,
          executable: file.executable,
        },
      },
      run.config.value.limits,
    );
    const copied = await readTree(
      resolve(target, ArtifactExportFile.Content),
      run.config.value.limits,
    );
    const actual = copied[file.path];
    if (
      Object.keys(copied).length !== 1 ||
      !actual ||
      actual.hash !== file.hash ||
      actual.bytes !== file.bytes ||
      actual.executable !== file.executable
    )
      throw new TitanError(ErrorCode.ArtifactInvalid, ArtifactMessage.Invalid);
    const manifest = resolve(target, ArtifactExportFile.Manifest);
    await writeFile(manifest, bytes, {
      flag: FileOpenMode.Exclusive,
      mode: WorkspaceMode.PrivateFile,
    });
    return ArtifactExportSchema.parse({ directory: target, manifest, delivery });
  } catch (error) {
    await rm(target, { recursive: true, force: true });
    if (error instanceof TitanError) throw error;
    throw new TitanError(ErrorCode.ArtifactExport, ArtifactMessage.Export);
  }
}
