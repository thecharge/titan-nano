import {
  FileAccessMode,
  FileWriteScope,
  IdentifierPattern,
  PathPart,
  RuntimeLimit,
} from "@titan/constants";
import { z } from "zod";
import { ArtifactHashSchema } from "./artifacts.ts";
import { OperationScopeSchema } from "./requests.ts";
import { WorkspaceRelativePathSchema } from "./workspace-path.ts";

export const FileReadPathsSchema = z
  .array(z.union([WorkspaceRelativePathSchema, z.literal(PathPart.Current)]))
  .min(1)
  .max(RuntimeLimit.PendingOperations);

export const FileWritePathsSchema = z
  .array(WorkspaceRelativePathSchema)
  .min(1)
  .max(RuntimeLimit.PendingOperations);
export const FileWriteRequestScopeSchema = OperationScopeSchema.extend({
  operation: z.literal(FileWriteScope.Operation),
  resource: WorkspaceRelativePathSchema,
  content_hashes: z.strictObject({}),
  arguments: z.array(z.never()).length(0),
  environment_names: z.array(z.never()).length(0),
});
export const FileWriteInputSchema = z.strictObject({
  paths: FileWritePathsSchema,
  input: z.string().min(1),
  input_hash: ArtifactHashSchema,
  generation: z.number().int().nonnegative().max(RuntimeLimit.PendingOperations),
});
export type FileWriteInput = z.infer<typeof FileWriteInputSchema>;

export const FileAccessScopeSchema = z.strictObject({
  mode: z.enum(FileAccessMode),
  paths: z.array(z.string().min(1)).min(1).max(RuntimeLimit.PendingOperations),
  read_paths: z.array(z.string().min(1)).min(1).max(RuntimeLimit.PendingOperations).optional(),
});
export type FileAccessScope = z.infer<typeof FileAccessScopeSchema>;

export const FileAccessClaimSchema = FileAccessScopeSchema.extend({
  claim_id: z.uuid(),
  run_id: z.string().regex(IdentifierPattern),
  step_id: z.string().min(1),
  attempt: z.number().int().positive(),
  project: z.string().min(1),
});
export type FileAccessClaim = z.infer<typeof FileAccessClaimSchema>;

export const FileExecutionOriginSchema = z.strictObject({
  step_id: z.string().min(1),
  attempt: z.number().int().positive(),
  phase: z.string().min(1),
  execution_id: z.uuid(),
});
export type FileExecutionOrigin = z.infer<typeof FileExecutionOriginSchema>;
export const FileExecutionClaimSchema = FileAccessClaimSchema.extend({
  phase: FileExecutionOriginSchema.shape.phase,
  execution_id: FileExecutionOriginSchema.shape.execution_id,
});
export type FileExecutionClaim = z.infer<typeof FileExecutionClaimSchema>;
