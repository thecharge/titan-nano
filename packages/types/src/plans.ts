import { z } from "zod";
import { PlanSchema } from "./workflow.ts";

export const PlanRecordSchema = z.strictObject({
  kind: z.string().min(1),
  run_id: z.string().min(1),
  reward: z.number(),
  plan: PlanSchema,
});
export type PlanRecord = z.infer<typeof PlanRecordSchema>;

export const PlansReportSchema = z.strictObject({
  kind: z.string().min(1),
  plans: z.array(PlanRecordSchema),
});
export type PlansReport = z.infer<typeof PlansReportSchema>;
