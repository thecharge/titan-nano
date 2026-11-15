import { DocumentLinkLimit } from "@titan/constants";
import { z } from "zod";

export const DocumentLinkLimitsSchema = z.strictObject({
  entries: z
    .number()
    .int()
    .positive()
    .max(DocumentLinkLimit.Entries)
    .default(DocumentLinkLimit.Entries),
  depth: z.number().int().positive().max(DocumentLinkLimit.Depth).default(DocumentLinkLimit.Depth),
  file_bytes: z
    .number()
    .int()
    .positive()
    .max(DocumentLinkLimit.FileBytes)
    .default(DocumentLinkLimit.FileBytes),
  total_bytes: z
    .number()
    .int()
    .positive()
    .max(DocumentLinkLimit.TotalBytes)
    .default(DocumentLinkLimit.TotalBytes),
  reads: z.number().int().positive().max(DocumentLinkLimit.Reads).default(DocumentLinkLimit.Reads),
  nodes: z.number().int().positive().max(DocumentLinkLimit.Nodes).default(DocumentLinkLimit.Nodes),
  findings: z
    .number()
    .int()
    .positive()
    .max(DocumentLinkLimit.Findings)
    .default(DocumentLinkLimit.Findings),
});
export type DocumentLinkLimits = z.infer<typeof DocumentLinkLimitsSchema>;
export const DocumentLinkTargetSchema = z.strictObject({
  exists: z.boolean(),
  markdown: z.string().optional(),
});
export type DocumentLinkTarget = z.infer<typeof DocumentLinkTargetSchema>;
export const DocumentReadStateSchema = z.strictObject({
  entries: z.number().int().nonnegative(),
  reads: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
});
export type DocumentReadState = z.infer<typeof DocumentReadStateSchema>;
