import { z } from "zod";

export const StepListingSchema = z.strictObject({
  id: z.string(),
  task: z.string(),
  persona: z.string(),
  state: z.string(),
});
export type StepListing = z.infer<typeof StepListingSchema>;

export const RunawayObservedSchema = z.strictObject({
  steps: z.number().int().nonnegative(),
  refused: z.number().int().nonnegative(),
  open: z.number().int().nonnegative(),
});
export type RunawayObserved = z.infer<typeof RunawayObservedSchema>;

export const AddStepsObservedSchema = z.strictObject({
  steps: z.number().int().nonnegative(),
  added_by: z.array(z.string()),
  refused: z.number().int().nonnegative(),
  dropped: z.number().int().nonnegative(),
});
export type AddStepsObserved = z.infer<typeof AddStepsObservedSchema>;

export const AgentBudgetDefaultsSchema = z.strictObject({
  max_attempts: z.number().int().positive(),
  candidates: z.number().int().positive(),
});
export type AgentBudgetDefaults = z.infer<typeof AgentBudgetDefaultsSchema>;

export const WorkerPromptsSchema = z.strictObject({
  worker: z.string(),
  falsifier: z.string(),
});
export type WorkerPrompts = z.infer<typeof WorkerPromptsSchema>;
