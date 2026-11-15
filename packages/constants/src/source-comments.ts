import { BoundaryReadLimit } from "./development.ts";

export const SourceCommentLimit = {
  Files: BoundaryReadLimit.Sources,
  Bytes: BoundaryReadLimit.TotalBytes,
  Findings: BoundaryReadLimit.Sources,
} as const;

export const SourceCommentFixture = {
  Suffixes: ["ts", "tsx", "js", "jsx", "mjs", "cjs", "mts", "cts"],
} as const;
