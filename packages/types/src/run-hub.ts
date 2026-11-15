import {
  KnowledgeKind,
  KnowledgeScope,
  RunHubOutcome,
  RunStatus,
  StepStatus,
} from "@titan/constants";
import { z } from "zod";

export const RunHubEntrySchema = z.strictObject({
  id: z.string().min(1),
  kind: z.enum(KnowledgeKind),
  title: z.string(),
  scope: z.enum(KnowledgeScope),
});
export type RunHubEntry = z.infer<typeof RunHubEntrySchema>;

export const RunHubEventSchema = z.strictObject({
  step_id: z.string().min(1).optional(),
  entries: z.array(RunHubEntrySchema),
});
export type RunHubEvent = z.infer<typeof RunHubEventSchema>;

export const RunHubLessonSchema = z.strictObject({
  run_id: z.string().min(1),
  step_id: z.string().min(1),
  persona: z.string().min(1),
  attempt: z.number().int().positive(),
  outcome: z.enum(RunHubOutcome),
  evidence: z.array(z.string()),
});
export type RunHubLesson = z.infer<typeof RunHubLessonSchema>;

export const RunJournalStepSchema = z.strictObject({
  step_id: z.string().min(1),
  state: z.enum(StepStatus),
  persona: z.string().min(1),
  attempts: z.number().int().positive(),
  files: z.array(z.string()),
  checks: z.array(z.string()),
  refusals: z.array(z.string()),
  lessons: z.array(z.string()),
});
export type RunJournalStep = z.infer<typeof RunJournalStepSchema>;

export const RunJournalSchema = z.strictObject({
  run_id: z.string().min(1),
  project: z.string().min(1),
  goal: z.string(),
  state: z.enum(RunStatus),
  error: z.string().nullable(),
  steps: z.array(RunJournalStepSchema),
});
export type RunJournal = z.infer<typeof RunJournalSchema>;

export interface RunHub {
  tools(): readonly string[];
  journal(journal: RunJournal): Promise<RunHubEntry>;
  read(goal: string, project: string): Promise<RunHubEntry[]>;
  keep(lesson: RunHubLesson, project: string): Promise<RunHubEntry>;
}
