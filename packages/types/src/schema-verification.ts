import { DataSchemaRule, IoLimit } from "@titan/constants";
import { z } from "zod";

export const DataSchemaFindingSchema = z.strictObject({
  file: z.string().min(1),
  line: z.number().int().positive(),
  name: z.string().min(1),
});
export type DataSchemaFinding = z.infer<typeof DataSchemaFindingSchema>;

export const DataSchemaReadLimitsSchema = z.strictObject({
  source_bytes: z.number().int().positive().max(IoLimit.DataBytes).default(IoLimit.DataBytes),
  total_bytes: z
    .number()
    .int()
    .positive()
    .max(DataSchemaRule.MaximumBytes)
    .default(DataSchemaRule.MaximumBytes),
  max_files: z
    .number()
    .int()
    .positive()
    .max(DataSchemaRule.MaximumFiles)
    .default(DataSchemaRule.MaximumFiles),
});
export type DataSchemaReadLimits = z.infer<typeof DataSchemaReadLimitsSchema>;
