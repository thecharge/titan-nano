import { ScriptSandbox } from "@titan/constants";
import { z } from "zod";
import { ArtifactHashSchema } from "./artifacts.ts";

export const ScriptSandboxInventorySchema = z.strictObject({
  source_sha256: ArtifactHashSchema,
  lock_sha256: ArtifactHashSchema,
  components: z
    .array(
      z.strictObject({
        name: z.string().min(1),
        version: z.string().min(1),
        license: z.enum(ScriptSandbox.Source.Licenses),
      }),
    )
    .min(1),
});
