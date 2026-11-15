import { z } from "zod";
import { RunSchema } from "./board.ts";

export const LimitBudgetSchema = z.strictObject({ remaining: z.number() });
export type LimitBudget = z.infer<typeof LimitBudgetSchema>;

export const LiveExecutionSchema = z.strictObject({ project: z.string(), run: RunSchema });
export type LiveExecution = z.infer<typeof LiveExecutionSchema>;
