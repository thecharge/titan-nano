import { SourceCommentLimit } from "@titan/constants";
import { z } from "zod";

export const SourceCommentLimitsSchema = z.strictObject({
  max_files: z
    .number()
    .int()
    .positive()
    .max(SourceCommentLimit.Files)
    .default(SourceCommentLimit.Files),
  total_bytes: z
    .number()
    .int()
    .positive()
    .max(SourceCommentLimit.Bytes)
    .default(SourceCommentLimit.Bytes),
  max_findings: z
    .number()
    .int()
    .positive()
    .max(SourceCommentLimit.Findings)
    .default(SourceCommentLimit.Findings),
});
export type SourceCommentLimits = z.infer<typeof SourceCommentLimitsSchema>;
