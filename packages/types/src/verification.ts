import {
  BoundaryReadLimit,
  CoverageRule,
  OfflineSelectionLimit,
  Packaging,
  VendorPackage,
} from "@titan/constants";
import { z } from "zod";

const count = z.number().int().nonnegative();
export const CoverageRecordSchema = z
  .strictObject({
    file: z.string().min(1),
    lines: z.record(z.string(), count),
    functionsFound: count,
    functionsHit: count,
  })
  .refine((record) => record.functionsHit <= record.functionsFound);
export type CoverageRecord = z.infer<typeof CoverageRecordSchema>;
export const CoverageGapSchema = z.strictObject({
  file: z.string(),
  rule: z.enum(CoverageRule),
  lines: z.array(count),
  missingFunctions: count,
});
export type CoverageGap = z.infer<typeof CoverageGapSchema>;

export const WorkspaceManifestSchema = z.object({
  name: z.string().min(1),
  dependencies: z.record(z.string(), z.string()).optional(),
  exports: z.record(z.string(), z.string()).optional(),
  bin: z.record(z.string(), z.string()).optional(),
});
export const WorkspaceSourceSchema = z.strictObject({
  directory: z.string(),
  manifest: WorkspaceManifestSchema,
  sources: z.record(z.string(), z.string()),
});
export type WorkspaceSource = z.infer<typeof WorkspaceSourceSchema>;
export const BoundaryFindingSchema = z.strictObject({
  package: z.string(),
  file: z.string(),
  rule: z.string(),
  detail: z.string(),
});
export type BoundaryFinding = z.infer<typeof BoundaryFindingSchema>;
export const PackageManifestSchema = z.object({
  version: z.string(),
  workspaces: z.object({ catalog: z.record(z.string(), z.string()) }).optional(),
});
export type PackageManifest = z.infer<typeof PackageManifestSchema>;

export type WorkspaceManifest = z.infer<typeof WorkspaceManifestSchema>;

export const WorkspacePackageManifestSchema = PackageManifestSchema.required({ workspaces: true });

export const CodexNativeDependencySchema = z.object({
  dependencies: z.object({
    [VendorPackage.CodexCli]: z.string().regex(Packaging.PinnedVersionPattern),
  }),
});

export const BoundaryReadLimitsSchema = z.strictObject({
  manifest_bytes: z
    .number()
    .int()
    .positive()
    .max(BoundaryReadLimit.ManifestBytes)
    .default(BoundaryReadLimit.ManifestBytes),
  source_bytes: z
    .number()
    .int()
    .positive()
    .max(BoundaryReadLimit.SourceBytes)
    .default(BoundaryReadLimit.SourceBytes),
  total_bytes: z
    .number()
    .int()
    .positive()
    .max(BoundaryReadLimit.TotalBytes)
    .default(BoundaryReadLimit.TotalBytes),
  max_workspaces: z
    .number()
    .int()
    .positive()
    .max(BoundaryReadLimit.Workspaces)
    .default(BoundaryReadLimit.Workspaces),
  max_sources: z
    .number()
    .int()
    .positive()
    .max(BoundaryReadLimit.Sources)
    .default(BoundaryReadLimit.Sources),
});
export type BoundaryReadLimitsInput = z.input<typeof BoundaryReadLimitsSchema>;

export const PackageOutputOptionsSchema = z.strictObject({
  maximum_bytes: z.int().positive().max(Packaging.OutputBytes).default(Packaging.OutputBytes),
  timeout_ms: z
    .int()
    .positive()
    .max(Packaging.OutputMilliseconds)
    .default(Packaging.OutputMilliseconds),
});
export type PackageOutputOptions = z.input<typeof PackageOutputOptionsSchema>;

export const OfflineSelectionLimitsSchema = z.strictObject({
  max_arguments: z
    .int()
    .positive()
    .max(OfflineSelectionLimit.Arguments)
    .default(OfflineSelectionLimit.Arguments),
  max_files: z
    .int()
    .positive()
    .max(OfflineSelectionLimit.Files)
    .default(OfflineSelectionLimit.Files),
  max_entries: z
    .int()
    .positive()
    .max(OfflineSelectionLimit.Entries)
    .default(OfflineSelectionLimit.Entries),
});
export type OfflineSelectionLimitsInput = z.input<typeof OfflineSelectionLimitsSchema>;
export type OfflineSelectionLimits = z.infer<typeof OfflineSelectionLimitsSchema>;
export const OfflineTestArgumentsSchema = z
  .array(z.string().min(1).max(OfflineSelectionLimit.PathCharacters))
  .max(OfflineSelectionLimit.Arguments);
