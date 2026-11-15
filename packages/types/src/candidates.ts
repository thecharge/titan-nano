import { JudgeWinner, StepStatus } from "@titan/constants";
import { z } from "zod";

export const JudgeAnswerSchema = z.strictObject({
  winner: z.enum(JudgeWinner),
  reason: z.string().trim().min(1),
});
export type JudgeAnswer = z.infer<typeof JudgeAnswerSchema>;

export const CandidateOutcomeSchema = z.strictObject({
  index: z.number().int().nonnegative(),
  survived: z.boolean(),
  evidence: z.array(z.string()),
  result: z.unknown(),
});
export type CandidateOutcome = z.infer<typeof CandidateOutcomeSchema>;

export const JudgementSchema = z.strictObject({
  first: z.number().int().nonnegative(),
  second: z.number().int().nonnegative(),
  kept: z.number().int().nonnegative(),
  reason: z.string().min(1),
});
export type Judgement = z.infer<typeof JudgementSchema>;

export const CandidateRecordSchema = z.strictObject({
  state: z.enum([StepStatus.Passed, StepStatus.Failed]),
  candidates: z.array(CandidateOutcomeSchema),
  judgements: z.array(JudgementSchema),
  kept: z.number().int().nonnegative().nullable(),
});
export type CandidateRecord = z.infer<typeof CandidateRecordSchema>;

export type CandidateAttempt = (index: number) => Promise<CandidateOutcome>;
export type CandidateJudge = (
  first: CandidateOutcome,
  second: CandidateOutcome,
) => Promise<unknown>;
