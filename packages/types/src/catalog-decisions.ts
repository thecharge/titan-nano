import { z } from "zod";

export const CatalogManifestSchema = z.object({
  workspaces: z
    .object({ catalog: z.record(z.string(), z.string()) })
    .partial()
    .optional(),
});
