import { Backend, IdentifierPattern } from "@titan/constants";
import { z } from "zod";
import type { Run, RunEventView } from "./board.ts";

export const BackendChoiceSchema = z.record(z.string().regex(IdentifierPattern), z.enum(Backend));
export type BackendChoice = z.infer<typeof BackendChoiceSchema>;

export const ProgramOptionsSchema = z.strictObject({
  backend: BackendChoiceSchema.optional(),
  default_backend: z.enum(Backend).optional(),
  project: z.string().min(1).optional(),
  home: z.string().min(1).optional(),
  overrides: z.record(z.string(), z.unknown()).optional(),
  client_id: z.string().min(1).optional(),
  submission_id: z.string().min(1).optional(),
});
export type ProgramOptions = z.infer<typeof ProgramOptionsSchema>;

export interface ProgramRun {
  run_id: string;
  events: AsyncIterable<RunEventView>;
  done: Promise<Run>;
}
