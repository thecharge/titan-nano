import { z } from "zod";
import type { ImproverAnswer } from "./improver.ts";
import type { LessonKeeping } from "./lessons.ts";
import type { Plan } from "./workflow.ts";

export const ImprovementOutcomeSchema = z.strictObject({
  passed: z.boolean(),
  attempts: z.number().int().nonnegative(),
  agents: z.number().int().nonnegative(),
});
export type ImprovementOutcome = z.infer<typeof ImprovementOutcomeSchema>;

export const ImprovementDecisionSchema = z.strictObject({
  file: z.string().nullable(),
  reason: z.string().nullable(),
  report: z.string(),
});
export type ImprovementDecision = z.infer<typeof ImprovementDecisionSchema>;

export type ImprovementRequest = {
  directory: string;
  name: string;
  old: Plan;
  next: Plan;
  answer: ImproverAnswer;
  lessons?: LessonKeeping;
  previous: ImprovementOutcome;
  rerun: (plan: Plan) => Promise<ImprovementOutcome>;
};
