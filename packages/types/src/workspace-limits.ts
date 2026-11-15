import { ConfigDefault } from "@titan/constants";
import { z } from "zod";

const count = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const WorkspaceLimitsSchema = z.strictObject({
  max_workspace_entries: count
    .max(ConfigDefault.MaxWorkspaceEntriesLimit)
    .default(ConfigDefault.MaxWorkspaceEntries),
  max_workspace_bytes: count
    .max(ConfigDefault.MaxWorkspaceBytesLimit)
    .default(ConfigDefault.MaxWorkspaceBytes),
  max_workspace_depth: count
    .max(ConfigDefault.MaxWorkspaceDepthLimit)
    .default(ConfigDefault.MaxWorkspaceDepth),
});
export type WorkspaceLimits = z.infer<typeof WorkspaceLimitsSchema>;
export type WorkspaceLimitsInput = z.input<typeof WorkspaceLimitsSchema>;
