import { isAbsolute } from "node:path";
import {
  ArtifactFormat,
  ArtifactKind,
  ConfigDefault,
  EventCursor,
  FileEncoding,
  RunResultFormat,
  RunStatus,
} from "@titan/constants";
import { z } from "zod";
import { WorkspacePathSchema, WorkspaceRelativePathSchema } from "./workspace.ts";

export const ArtifactHashSchema = z.string().regex(ArtifactFormat.HashPattern);
export const ArtifactManifestSchema = z.strictObject({
  proofs_hash: ArtifactHashSchema.optional(),
  result_format: z
    .union([z.literal(RunResultFormat.PassedVersion), z.literal(RunResultFormat.ProofVersion)])
    .optional(),
  hash: ArtifactHashSchema,
  paths: z.array(WorkspaceRelativePathSchema).max(ConfigDefault.MaxWorkspaceEntriesLimit),
  outputs: z.record(z.string(), z.unknown()),
});
export const ArtifactCommitSchema = z.strictObject({
  proofs_hash: ArtifactHashSchema.optional(),
  artifact_hash: ArtifactHashSchema,
  result_format: z
    .union([z.literal(RunResultFormat.PassedVersion), z.literal(RunResultFormat.ProofVersion)])
    .optional(),
});
export type ArtifactCommit = z.infer<typeof ArtifactCommitSchema>;
export const ArtifactFileSchema = z.strictObject({
  id: ArtifactHashSchema,
  kind: z.literal(ArtifactKind.File),
  path: WorkspaceRelativePathSchema,
  hash: ArtifactHashSchema,
  bytes: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  executable: z.boolean(),
});
export const ArtifactInspectionSchema = z.strictObject({
  schema_version: z.literal(ArtifactFormat.InspectionVersion),
  run_id: z.string().min(1),
  workflow_id: z.string().min(1),
  workflow_revision: ArtifactHashSchema,
  state: z.literal(RunStatus.Passed),
  directory: z.string().min(1),
  result: z.string().min(1),
  manifest: z.string().min(1),
  proofs: z.string().min(1).optional(),
  hash: ArtifactHashSchema,
  files: z.array(ArtifactFileSchema).max(ConfigDefault.MaxWorkspaceEntriesLimit),
  outputs: z.record(z.string(), z.unknown()),
});
export type ArtifactInspection = z.infer<typeof ArtifactInspectionSchema>;

export const ArtifactQuerySchema = z.strictObject({
  offset: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(0),
  limit: z
    .number()
    .int()
    .positive()
    .max(ArtifactFormat.PageBytes)
    .default(ArtifactFormat.PageBytes),
});
export type ArtifactQueryInput = z.input<typeof ArtifactQuerySchema>;
export const ArtifactSearchSchema = z
  .strictObject({
    offset: z.string().regex(EventCursor.IntegerPattern).transform(Number).optional(),
    limit: z.string().regex(EventCursor.IntegerPattern).transform(Number).optional(),
  })
  .pipe(ArtifactQuerySchema);
export const ArtifactPageSchema = z
  .strictObject({
    schema_version: z.literal(ArtifactFormat.PageVersion),
    run_id: z.string().min(1),
    workflow_id: z.string().min(1),
    workflow_revision: ArtifactHashSchema,
    file: ArtifactFileSchema,
    offset: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    next_offset: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    has_more: z.boolean(),
    encoding: z.literal(FileEncoding.Base64),
    content: z
      .string()
      .max(Math.ceil(ArtifactFormat.PageBytes / 3) * 4)
      .base64(),
  })
  .refine((page) => {
    const bytes = Buffer.from(page.content, FileEncoding.Base64).length;
    return (
      bytes <= ArtifactFormat.PageBytes &&
      (bytes > 0 || !page.has_more) &&
      page.next_offset === page.offset + bytes &&
      page.next_offset <= page.file.bytes &&
      page.has_more === page.next_offset < page.file.bytes
    );
  });
export type ArtifactPage = z.infer<typeof ArtifactPageSchema>;

export const ArtifactExportDestinationSchema = WorkspacePathSchema.refine(isAbsolute);
export const ArtifactExportManifestSchema = z.strictObject({
  schema_version: z.literal(ArtifactFormat.ExportVersion),
  run_id: z.string().min(1),
  workflow_id: z.string().min(1),
  workflow_revision: ArtifactHashSchema,
  state: z.literal(RunStatus.Passed),
  delivery_hash: ArtifactHashSchema,
  file: ArtifactFileSchema,
  content: WorkspaceRelativePathSchema,
  outputs: z.record(z.string(), z.unknown()),
});
export const ArtifactExportSchema = z.strictObject({
  directory: ArtifactExportDestinationSchema,
  manifest: ArtifactExportDestinationSchema,
  delivery: ArtifactExportManifestSchema,
});
export type ArtifactExport = z.infer<typeof ArtifactExportSchema>;
