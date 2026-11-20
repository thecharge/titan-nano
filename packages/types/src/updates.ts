import {
  GitObjectPattern,
  Harness,
  type UpdateBackupStage,
  UpdateCheck,
  UpdateFile,
  UpdateMode,
  UpdatePhase,
  UpdatePolicy,
} from "@titan/constants";
import { z } from "zod";
import { ArtifactHashSchema } from "./artifacts.ts";
import { PrerequisiteStatusSchema } from "./prerequisites.ts";

export const BootstrapHarnessSchema = z.enum([
  Harness.Codex,
  Harness.Claude,
  UpdateFile.BootstrapBoth,
]);

export const UpdateSettingsSchema = z.strictObject({
  source: z.string().min(1).max(2048).regex(UpdatePolicy.SourcePattern).optional(),
  check: z.enum(UpdateCheck).default(UpdateCheck.Daily),
  mode: z.enum(UpdateMode).optional(),
});
export type UpdateSettings = z.infer<typeof UpdateSettingsSchema>;

export const UpdateInspectionSchema = z.strictObject({
  current_version: z
    .string()
    .max(UpdatePolicy.VersionCharacters)
    .regex(UpdatePolicy.VersionPattern),
  available_version: z
    .string()
    .max(UpdatePolicy.VersionCharacters)
    .regex(UpdatePolicy.VersionPattern)
    .nullable(),
  source: UpdateSettingsSchema.shape.source.unwrap().nullable(),
  checked: z.boolean(),
});
export type UpdateInspection = z.infer<typeof UpdateInspectionSchema>;

export const ReleaseVersionSchema = z.strictObject({
  version: z.string().max(UpdatePolicy.VersionCharacters).regex(UpdatePolicy.VersionPattern),
  numbers: z.tuple([z.bigint(), z.bigint(), z.bigint()]),
  prerelease: z.array(z.string()),
});
export type ReleaseVersion = z.infer<typeof ReleaseVersionSchema>;

export const UpdateCacheSchema = z.strictObject({
  source: UpdateSettingsSchema.shape.source.unwrap(),
  checked_at: z.number().int().nonnegative(),
  latest: UpdateInspectionSchema.shape.available_version,
});
export type UpdateCache = z.infer<typeof UpdateCacheSchema>;

export interface UpdateServices {
  tags(source: string, cwd: string): Promise<string>;
  now(): number;
}

export const UpdateBackupRootSchema = z.strictObject({
  source: z.string().min(1),
  copy: z.string().regex(UpdateFile.CopyPattern),
  digest: ArtifactHashSchema,
  identity: ArtifactHashSchema,
});

export const UpdateBackupSchema = z.strictObject({
  schema_version: z.literal(1),
  version: UpdateInspectionSchema.shape.current_version,
  created_at: z.number().int().nonnegative(),
  roots: z.array(UpdateBackupRootSchema).min(1),
});
export type UpdateBackup = z.infer<typeof UpdateBackupSchema>;
export type UpdateBackupRoot = z.infer<typeof UpdateBackupRootSchema>;
export type UpdateBackupObserver = (stage: UpdateBackupStage, path: string) => Promise<void>;

export const UpdateCatalogSchema = z.strictObject({
  projects: z.array(z.string().min(1)),
  runs: z.array(z.string().min(1)),
});
export type UpdateCatalog = z.infer<typeof UpdateCatalogSchema>;

export const UpdateTransactionSchema = z
  .strictObject({
    schema_version: z.literal(1),
    installation: z.string().min(1),
    previous: z.string().min(1),
    next: z.string().min(1),
    phase: z.enum(UpdatePhase),
    backup: z.string().nullable(),
    backup_digest: ArtifactHashSchema.nullable(),
  })
  .refine((transaction) => (transaction.backup === null) === (transaction.backup_digest === null))
  .refine(
    (transaction) =>
      transaction.phase === UpdatePhase.Preparing ||
      transaction.phase === UpdatePhase.RolledBack ||
      transaction.backup !== null,
  );
export type UpdateTransaction = z.infer<typeof UpdateTransactionSchema>;
export type UpdateInstallObserver = (phase: UpdatePhase) => Promise<void>;

export const InstallCommandLinkSchema = z.strictObject({
  path: z.string().min(1),
  device: z.string().regex(UpdatePolicy.NumericPattern),
  inode: z.string().regex(UpdatePolicy.NumericPattern),
  changed_ns: z.string().regex(UpdatePolicy.NumericPattern),
});

export const UpdateDoctorSchema = z.object({
  prerequisites: z.array(PrerequisiteStatusSchema),
});
export const UpdateVersionSchema = z.object({
  version: UpdateInspectionSchema.shape.current_version,
});

export const UpdateReleaseSchema = z.strictObject({
  source: UpdateSettingsSchema.shape.source.unwrap(),
  version: UpdateInspectionSchema.shape.current_version,
  tag: z.string().min(1),
  object: z.string().regex(GitObjectPattern),
});
export type UpdateRelease = z.infer<typeof UpdateReleaseSchema>;
export const UpdateSourceManifestSchema = z.object({
  name: z.literal(UpdateFile.Workspace),
  private: z.literal(true),
  version: UpdateInspectionSchema.shape.current_version,
  scripts: z.object({ "pack:preview": z.string().min(1) }),
});
