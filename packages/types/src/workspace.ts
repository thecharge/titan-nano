import { RuntimeLimit, WorkspaceSkillScope } from "@titan/constants";
import { z } from "zod";
import { WorkspaceLimitsSchema } from "./workspace-limits.ts";
import { WorkspaceRelativePathSchema } from "./workspace-path.ts";

export {
  WorkspaceEntryNameSchema,
  WorkspacePathSchema,
  WorkspaceRelativePathSchema,
} from "./workspace-path.ts";

export const FileEntrySchema = z.strictObject({
  source: z.string().min(1),
  hash: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  executable: z.boolean().default(false),
});
export type FileEntry = z.infer<typeof FileEntrySchema>;
export const FileMapSchema = z.record(z.string(), FileEntrySchema);
export type FileMap = z.infer<typeof FileMapSchema>;

export const WorkspaceOmissionsSchema = z
  .array(WorkspaceRelativePathSchema)
  .max(RuntimeLimit.PendingOperations);

export const WorkspaceTraversalSchema = z.strictObject({
  limits: WorkspaceLimitsSchema,
  entries: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
  omitted: WorkspaceOmissionsSchema,
});
export type WorkspaceTraversal = z.infer<typeof WorkspaceTraversalSchema>;

export const WorkspaceSkillEntrySchema = z.strictObject({
  name: z.string().min(1),
  description: z.string(),
  scope: z.enum(WorkspaceSkillScope),
  origin: z.string(),
  alternatives: z.array(z.string()),
});
export const DiscoveredWorkspaceSkillSchema = WorkspaceSkillEntrySchema.extend({
  directory: z.string(),
});
export type DiscoveredWorkspaceSkill = z.infer<typeof DiscoveredWorkspaceSkillSchema>;
export const WorkspaceSkillMetadataSchema = z.object({ description: z.string().optional() });
