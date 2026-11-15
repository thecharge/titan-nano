import { z } from "zod";
import { BackendIdSchema } from "./agents.ts";
import { AgentCapacitySchema, BackendCapacitySchema } from "./config.ts";

export const CapacityRequestSchema = z.strictObject({
  backend: BackendIdSchema.nullable().optional(),
  max_parallel: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
});
export type CapacityRequest = z.infer<typeof CapacityRequestSchema>;
export const BackendActiveCountsSchema = z.partialRecord(
  BackendIdSchema,
  z.number().int().nonnegative(),
);
export type BackendActiveCounts = z.infer<typeof BackendActiveCountsSchema>;

export const CapacitySnapshotSchema = AgentCapacitySchema.extend({
  active: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  backends: BackendActiveCountsSchema,
  backend_limits: BackendCapacitySchema,
});
export type CapacitySnapshot = z.infer<typeof CapacitySnapshotSchema>;
