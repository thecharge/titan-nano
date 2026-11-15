import { z } from "zod";
import { NodeStateSchema } from "./board.ts";
import { LessonSchema } from "./lessons.ts";

export const ImproverStepRecordSchema = NodeStateSchema.pick({
  state: true,
  attempt: true,
  refutations: true,
  evidence: true,
}).extend({ id: z.string().min(1) });
export type ImproverStepRecord = z.infer<typeof ImproverStepRecordSchema>;

export const ImproverRecordSchema = z.strictObject({
  workflow: z.string().min(1),
  steps: z.array(ImproverStepRecordSchema),
  lessons: z.boolean().optional(),
});
export type ImproverRecord = z.infer<typeof ImproverRecordSchema>;

export const ImproverAnswerSchema = z.strictObject({
  workflow: z.string().min(1),
  changes: z.array(z.strictObject({ change: z.string().min(1), reason: z.string().min(1) })),
  lessons: z.array(LessonSchema).optional(),
});
export type ImproverAnswer = z.infer<typeof ImproverAnswerSchema>;

export const ImproverObservedSchema = z.strictObject({
  tasks: z.array(z.string()),
  fixerPrompts: z.number().int().nonnegative(),
  state: z.string(),
  saved: ImproverAnswerSchema.nullable(),
});
export type ImproverObserved = z.infer<typeof ImproverObservedSchema>;
