import { z } from "zod";
import { NodeStateSchema, PhaseSchema, RunSchema } from "./board.ts";
import { FileExecutionClaimSchema } from "./file-access.ts";
import { OperationRequestSchema } from "./requests.ts";
import { ActionSchema, StepSchema } from "./workflow.ts";

export const PhaseContextSchema = z.strictObject({
  run: RunSchema,
  step: StepSchema,
  state: NodeStateSchema,
  key: z.string(),
  action: ActionSchema,
  cwd: z.string(),
  folder: z.string().optional(),
  inputs: z.unknown(),
  candidate: z.unknown(),
  signal: z.instanceof(AbortSignal),
});
export type PhaseContext = z.infer<typeof PhaseContextSchema>;
export const PhaseExecutionSchema = PhaseContextSchema.extend({
  phase: PhaseSchema,
  execution_id: z.string(),
  request_answers: z.array(OperationRequestSchema),
  file_claim: FileExecutionClaimSchema.optional(),
});
export type PhaseExecution = z.infer<typeof PhaseExecutionSchema>;
