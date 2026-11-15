import { z } from "zod";
import type { Workflow } from "./workflow.ts";

export const LessonSchema = z.strictObject({
  persona: z.string().min(1),
  step: z.string().min(1),
  text: z.string().min(1),
});
export type Lesson = z.infer<typeof LessonSchema>;

export const LessonRecordSchema = LessonSchema.extend({
  run_id: z.string().min(1),
  kept_at: z.number().int().nonnegative(),
});
export type LessonRecord = z.infer<typeof LessonRecordSchema>;
export const LessonListSchema = z.strictObject({ lessons: z.array(LessonRecordSchema) });

export const LessonSaveSchema = z.strictObject({
  run_id: z.string(),
  lessons: z.array(LessonSchema).readonly(),
  workflow: z.custom<Workflow>(),
});
export type LessonSave = z.infer<typeof LessonSaveSchema>;
export type LessonKeeper = (save: LessonSave) => Promise<void>;
export const LessonKeepingSchema = z.strictObject({
  run_id: z.string(),
  keep: z.custom<LessonKeeper>(),
});
export type LessonKeeping = z.infer<typeof LessonKeepingSchema>;
export const TaughtWorkflowSchema = z.strictObject({
  workflow: z.custom<Workflow>(),
  applied: z.array(LessonSchema),
});
export type TaughtWorkflow = z.infer<typeof TaughtWorkflowSchema>;
