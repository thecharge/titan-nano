import { isAbsolute } from "node:path";
import { AgentRuntime, Backend } from "@titan/constants";
import { executablePathRequired } from "@titan/messages";
import { z } from "zod";

export const BackendLaunchSchema = z.strictObject({
  executable: z.string().min(1).refine(isAbsolute, executablePathRequired).optional(),
});
export type BackendLaunch = z.infer<typeof BackendLaunchSchema>;
export const ClaudeLaunchSchema = BackendLaunchSchema.extend({
  runtime: z.enum(AgentRuntime).optional(),
});
export type ClaudeLaunch = z.infer<typeof ClaudeLaunchSchema>;
export const BackendLaunchesSchema = z.strictObject({
  [Backend.Codex]: BackendLaunchSchema.prefault({}),
  [Backend.Claude]: ClaudeLaunchSchema.prefault({}),
});
