import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { ArtifactFormat, ErrorCode, FileEncoding, HashAlgorithm } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { ArtifactMessage } from "@titan/messages";
import {
  ArtifactHashSchema,
  type ArtifactPage,
  ArtifactPageSchema,
  type ArtifactQueryInput,
  ArtifactQuerySchema,
  ArtifactSearchSchema,
  type FileEntry,
  type Run,
} from "@titan/types";
import { sourceChunks } from "@titan/workspace";
import { inspectArtifacts } from "./inspection.ts";

export function parseArtifactSearch(value: unknown) {
  const parsed = ArtifactSearchSchema.safeParse(value);
  if (!parsed.success) throw new TitanError(ErrorCode.ArtifactRange, ArtifactMessage.Range);
  return parsed.data;
}

export async function readArtifact(
  run: Run,
  id: string,
  input: ArtifactQueryInput = {},
): Promise<ArtifactPage> {
  const query = ArtifactQuerySchema.safeParse(input);
  if (!query.success) throw new TitanError(ErrorCode.ArtifactRange, ArtifactMessage.Range);
  if (!ArtifactHashSchema.safeParse(id).success)
    throw new TitanError(ErrorCode.ArtifactNotFound, ArtifactMessage.NotFound);
  const inspection = await inspectArtifacts(run);
  const file = inspection.files.find((entry) => entry.id === id);
  if (!file) throw new TitanError(ErrorCode.ArtifactNotFound, ArtifactMessage.NotFound);
  const { offset } = query.data;
  if (offset > file.bytes) throw new TitanError(ErrorCode.ArtifactRange, ArtifactMessage.Range);
  const content = await readArtifactBytes(
    { ...file, source: resolve(inspection.directory, file.path) },
    query.data,
  );
  return ArtifactPageSchema.parse({
    schema_version: ArtifactFormat.PageVersion,
    run_id: inspection.run_id,
    workflow_id: inspection.workflow_id,
    workflow_revision: inspection.workflow_revision,
    file,
    offset,
    next_offset: offset + content.length,
    has_more: offset + content.length < file.bytes,
    encoding: FileEncoding.Base64,
    content: content.toString(FileEncoding.Base64),
  });
}

export async function readArtifactBytes(
  file: FileEntry,
  input: ArtifactQueryInput = {},
): Promise<Buffer> {
  const query = ArtifactQuerySchema.safeParse(input);
  if (!query.success || query.data.offset > file.bytes)
    throw new TitanError(ErrorCode.ArtifactRange, ArtifactMessage.Range);
  const { offset, limit } = query.data;
  const content = Buffer.alloc(Math.min(limit, file.bytes - offset));
  try {
    await fillVerifiedRange(file, offset, content);
  } catch {
    throw new TitanError(ErrorCode.ArtifactInvalid, ArtifactMessage.Invalid);
  }
  return content;
}

async function fillVerifiedRange(file: FileEntry, offset: number, content: Buffer): Promise<void> {
  const digest = createHash(HashAlgorithm.Sha256);
  let bytes = 0;
  for await (const chunk of sourceChunks(file.source, file.executable)) {
    if (bytes + chunk.length > file.bytes)
      throw new TitanError(ErrorCode.ArtifactInvalid, ArtifactMessage.Invalid);
    const start = Math.max(0, offset - bytes);
    const end = Math.min(chunk.length, offset + content.length - bytes);
    if (end > start) chunk.copy(content, Math.max(0, bytes - offset), start, end);
    digest.update(chunk);
    bytes += chunk.length;
  }
  if (bytes !== file.bytes || digest.digest(FileEncoding.Hex) !== file.hash)
    throw new TitanError(ErrorCode.ArtifactInvalid, ArtifactMessage.Invalid);
}
