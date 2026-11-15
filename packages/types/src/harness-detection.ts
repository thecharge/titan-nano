import { HarnessName } from "@titan/constants";
import { z } from "zod";

export const HarnessChoiceSchema = z.strictObject({
  harness: z.enum(HarnessName),
  detectedBy: z.string().min(1),
});
export type HarnessChoice = z.infer<typeof HarnessChoiceSchema>;

export const HarnessInputSchema = z.strictObject({
  flag: z.string().optional(),
  workflow: z.string().optional(),
  env: z.record(z.string(), z.string().optional()),
  found: z.array(z.string()),
});
export type HarnessInput = z.infer<typeof HarnessInputSchema>;

export const HarnessSignalSchema = z.strictObject({
  harness: z.enum(HarnessName),
  variable: z.string().min(1),
  value: z.string().min(1),
});
export type HarnessSignal = z.infer<typeof HarnessSignalSchema>;
