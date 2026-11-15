import { ImproveOutcome } from "@titan/constants";
import { z } from "zod";

export const ImproveRoundSchema = z.object({
  round: z.number().int().positive(),
  kept: z.array(z.string()),
  outcome: z.enum(ImproveOutcome),
});
export type ImproveRound = z.infer<typeof ImproveRoundSchema>;

export const ImproveRecordSchema = z.object({
  rounds: z.array(ImproveRoundSchema),
});
export type ImproveRecord = z.infer<typeof ImproveRecordSchema>;

export const ImproveRoundRunnerSchema = z.function({
  input: [z.number().int().positive()],
  output: z.promise(z.array(z.string())),
});
export type ImproveRoundRunner = z.infer<typeof ImproveRoundRunnerSchema>;
