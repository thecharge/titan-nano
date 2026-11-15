import { IdentifierPattern } from "@titan/constants";
import { z } from "zod";

export const PolicyKindSchema = z.string().regex(IdentifierPattern);
export const PolicyKindHolderSchema = z.object({ kind: z.string().optional() });
export type PolicyKindHolder = z.infer<typeof PolicyKindHolderSchema>;
export const PolicyWeightsSchema = z.strictObject({
  w_time: z.number().nonnegative().optional(),
  w_agent: z.number().nonnegative().optional(),
});
export type PolicyWeights = z.infer<typeof PolicyWeightsSchema>;
export const RewardInputSchema = z.strictObject({
  results: z.number().int().nonnegative(),
  survived: z.number().int().nonnegative(),
  criticalMinutes: z.number().nonnegative(),
  agents: z.number().int().nonnegative(),
  verdict: z.boolean().optional(),
});
export type RewardInput = z.infer<typeof RewardInputSchema>;
export const PolicyRunSchema = z.strictObject({
  run: z.string().min(1),
  choices: z.record(z.string(), z.number()),
  reward: z.number(),
});
export type PolicyRun = z.infer<typeof PolicyRunSchema>;
export const TrailsSchema = z.record(z.string(), z.number().nonnegative());
export type Trails = z.infer<typeof TrailsSchema>;
export const PolicyFileSchema = z.strictObject({
  kind: PolicyKindSchema,
  runs: z.array(PolicyRunSchema),
});
export type PolicyFile = z.infer<typeof PolicyFileSchema>;
