import { KnowledgeScope } from "@titan/constants";
import { z } from "zod";
import type { ImprovementDecision, ImprovementOutcome } from "./improvement.ts";
import type { ImproverAnswer } from "./improver.ts";
import type { LessonKeeping } from "./lessons.ts";
import type { Plan } from "./workflow.ts";

export const ImproveRequestSchema = z.strictObject({
  root: z.string().min(1),
  persona: z.string().min(1).optional(),
  rounds: z.number().int().positive().optional(),
  home: z.string().min(1).optional(),
  scope: z.enum(KnowledgeScope).optional(),
});
export type ImproveRequest = z.infer<typeof ImproveRequestSchema>;

export const ImproveLoopRoundSchema = z.strictObject({
  round: z.number().int().positive(),
  file: z.string().nullable(),
  reason: z.string().nullable(),
  report: z.string(),
});
export type ImproveLoopRound = z.infer<typeof ImproveLoopRoundSchema>;

export const ImproveReportSchema = z.strictObject({
  run_id: z.string().min(1),
  rounds: z.array(ImproveLoopRoundSchema),
  kept: z.boolean(),
});
export type ImproveReport = z.infer<typeof ImproveReportSchema>;

export const ImproveRunOptionsSchema = z.strictObject({
  persona: z.string().min(1).optional(),
  workflow: z.string().min(1).optional(),
});
export type ImproveRunOptions = z.infer<typeof ImproveRunOptionsSchema>;

export const ImproveRoundResultSchema = z.strictObject({
  decision: z.custom<ImprovementDecision>(),
  next: z.custom<Plan>(),
  outcome: z.custom<ImprovementOutcome>(),
});
export type ImproveRoundResult = z.infer<typeof ImproveRoundResultSchema>;

export type ImproveLoopRequest = {
  run_id: string;
  directory: string;
  name: string;
  rounds: number;
  workflow: string;
  start: Plan;
  lessons?: LessonKeeping;
  previous: ImprovementOutcome;
  propose: (workflow: string) => Promise<ImproverAnswer>;
  validate: (workflow: string) => Plan;
  rerun: (plan: Plan) => Promise<ImprovementOutcome>;
};
