import { LeanCheck } from "@titan/constants";
import { z } from "zod";

export const LeanInputSchema = z.strictObject({
  parent: z.string().min(1),
  statement: z.string(),
  solution: z.string(),
  theorems: z.array(z.string().min(1)).min(1),
  paranoid: z.boolean().default(false),
  timeout_s: z.number().positive().max(LeanCheck.MaximumSeconds).default(LeanCheck.DefaultSeconds),
});
export type LeanParsed = z.output<typeof LeanInputSchema>;
export type LeanInput = z.input<typeof LeanInputSchema>;
