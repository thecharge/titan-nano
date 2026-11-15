import { ScriptExecution as Script } from "@titan/constants";
import { z } from "zod";
import { NodeStateSchema, RunSchema } from "./board.ts";
import { FileExecutionClaimSchema } from "./file-access.ts";

export const ScriptExecutionSchema = z.strictObject({
  run_id: RunSchema.shape.run_id,
  step_id: z.string().min(1),
  attempt: NodeStateSchema.shape.attempt,
  phase: z.string().regex(Script.PhasePattern),
  execution_id: z.uuid(),
  file_claim: FileExecutionClaimSchema.optional(),
});
export type ScriptExecution = z.infer<typeof ScriptExecutionSchema>;
