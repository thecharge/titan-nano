import { FlatTestRule } from "@titan/constants";
import { z } from "zod";

export const FlatTestReadLimitsSchema = z.strictObject({
  total_bytes: z
    .number()
    .int()
    .positive()
    .max(FlatTestRule.MaximumBytes)
    .default(FlatTestRule.MaximumBytes),
  max_files: z
    .number()
    .int()
    .positive()
    .max(FlatTestRule.MaximumFiles)
    .default(FlatTestRule.MaximumFiles),
});
export type FlatTestReadLimits = z.infer<typeof FlatTestReadLimitsSchema>;
