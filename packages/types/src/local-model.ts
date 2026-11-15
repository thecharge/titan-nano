import {
  LocalModel,
  LocalModelArtifactPattern,
  LocalModelFolderPattern,
  LocalModelRevisionPattern,
} from "@titan/constants";
import { z } from "zod";
import { ArtifactHashSchema } from "./artifacts.ts";

export const LocalModelArtifactSchema = z.strictObject({
  file: z.string().regex(LocalModelArtifactPattern),
  bytes: z.int().positive().max(LocalModel.MaximumBytes),
  sha256: ArtifactHashSchema,
});
export type LocalModelArtifact = z.infer<typeof LocalModelArtifactSchema>;

export const LocalModelManifestSchema = z
  .strictObject({
    name: z.string().min(1).max(LocalModel.MaximumName),
    folder: z.string().regex(LocalModelFolderPattern),
    revision: z.string().regex(LocalModelRevisionPattern),
    base: z.url().startsWith(LocalModel.Https),
    artifacts: z.array(LocalModelArtifactSchema).min(1).max(LocalModel.MaximumArtifacts).readonly(),
  })
  .refine(
    (source) =>
      source.artifacts.reduce((bytes, artifact) => bytes + artifact.bytes, 0) <=
      LocalModel.MaximumBytes,
  )
  .refine(
    (source) =>
      new Set(source.artifacts.map((artifact) => artifact.file)).size === source.artifacts.length,
  );
export type LocalModelManifest = z.infer<typeof LocalModelManifestSchema>;

export const LocalModelStatusSchema = z.strictObject({
  name: LocalModelManifestSchema.shape.name,
  revision: LocalModelManifestSchema.shape.revision,
  directory: z.string().min(1),
  bytes: z.int().positive().max(LocalModel.MaximumBytes),
  ready: z.boolean(),
  missing: z.array(LocalModelArtifactSchema.shape.file).max(LocalModel.MaximumArtifacts),
  fetch_command: z.array(z.string()).min(1).max(LocalModel.MaximumCommandArguments),
});
export type LocalModelStatus = z.infer<typeof LocalModelStatusSchema>;

export const TransformersPipelineOptionsSchema = z.strictObject({
  dtype: z.literal(LocalModel.Dtype),
  local_files_only: z.literal(true),
});
export type TransformersPipelineOptions = z.infer<typeof TransformersPipelineOptionsSchema>;
