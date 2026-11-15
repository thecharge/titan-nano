import { BoundaryReadLimit } from "@titan/constants";
import { z } from "zod";
import { BoundaryReadLimitsSchema } from "./verification.ts";

export const InventoryReadLimitsSchema = BoundaryReadLimitsSchema.pick({
  manifest_bytes: true,
  total_bytes: true,
  max_workspaces: true,
}).extend({
  max_patterns: z
    .number()
    .int()
    .positive()
    .max(BoundaryReadLimit.Workspaces)
    .default(BoundaryReadLimit.Workspaces),
});
export type InventoryReadLimitsInput = z.input<typeof InventoryReadLimitsSchema>;
