import { TypeScriptPolicy } from "@titan/constants";
import { z } from "zod";

const strictOptions = Object.fromEntries(
  TypeScriptPolicy.StrictOptions.map((name) => [name, z.literal(true).optional()]),
);
const options = {
  ...strictOptions,
  noCheck: z.literal(false).optional(),
  noEmit: z.literal(true).optional(),
};
export const RootTypeScriptPolicySchema = z.strictObject({
  extends: z.never().optional(),
  compilerOptions: z
    .object({
      ...options,
      strict: z.literal(true),
      noUncheckedIndexedAccess: z.literal(true),
      exactOptionalPropertyTypes: z.literal(true),
    })
    .passthrough(),
  include: z
    .array(z.enum(TypeScriptPolicy.SourcePatterns))
    .length(TypeScriptPolicy.SourcePatterns.length)
    .refine((values) => new Set(values).size === TypeScriptPolicy.SourcePatterns.length),
});
export const PackageTypeScriptPolicySchema = z.strictObject({
  extends: z.string().min(1),
  include: z.tuple([z.enum([TypeScriptPolicy.PackageSource, TypeScriptPolicy.TestingSource])]),
  compilerOptions: z
    .strictObject({
      ...options,
      strict: z.literal(true).optional(),
      noUncheckedIndexedAccess: z.literal(true).optional(),
      exactOptionalPropertyTypes: z.literal(true).optional(),
    })
    .optional(),
});
export const TypeScriptWorkspacePolicySchema = z.object({
  workspaces: z.object({
    packages: z
      .array(z.string().regex(TypeScriptPolicy.WorkspacePattern))
      .nonempty()
      .max(TypeScriptPolicy.MaximumWorkspaces),
  }),
});
