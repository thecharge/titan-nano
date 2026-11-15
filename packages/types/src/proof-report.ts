import { BoardLimit, ProofAnswer, ProofReportFormat, VerifyKind } from "@titan/constants";
import { z } from "zod";
import { ArtifactHashSchema } from "./artifacts.ts";
import { ScriptCheckAnswerSchema } from "./command-capture.ts";
import { WorkspaceRelativePathSchema } from "./workspace.ts";

export const ProofSummarySchema = z
  .strictObject({
    proven: z.int().nonnegative(),
    refuted: z.int().nonnegative(),
    not_proven: z.int().nonnegative(),
    total: z.int().nonnegative(),
  })
  .refine((counts) => counts.total === counts.proven + counts.refuted + counts.not_proven);
export type ProofSummary = z.infer<typeof ProofSummarySchema>;

const ScriptProofRecordBaseSchema = z.strictObject({
  check_id: ArtifactHashSchema,
  scope: z.literal(ProofReportFormat.Step),
  kind: z.literal(VerifyKind.Script),
  step_id: z.string().min(1),
  part: z.null(),
  candidate: z.int().positive(),
  candidate_id: ArtifactHashSchema,
  attempt: z.int().positive(),
  phase: z.string().min(1),
  result_hash: ArtifactHashSchema,
  statement_hash: z.null(),
  command_hash: ArtifactHashSchema,
  checker: z.literal(VerifyKind.Script),
  checker_version: z.string().min(1),
  answer: z.enum(ProofAnswer),
  elapsed_ms: z.int().nonnegative(),
  output: WorkspaceRelativePathSchema,
  output_hash: ArtifactHashSchema,
});
export const ScriptProofRecordSchema = z.discriminatedUnion(ProofReportFormat.Scope, [
  ScriptProofRecordBaseSchema,
  ScriptProofRecordBaseSchema.omit({ step_id: true, attempt: true, part: true }).extend({
    scope: z.literal(ProofReportFormat.Goal),
  }),
]);
export type ScriptProofRecord = z.infer<typeof ScriptProofRecordSchema>;
export const RecordedScriptAnswerSchema = ScriptCheckAnswerSchema.extend({
  report: ScriptProofRecordSchema.optional(),
});
export const ScriptProofReportSchema = z.strictObject({
  schema_version: z.literal(ProofReportFormat.Version),
  run_id: z.string().min(1),
  through: z.int().nonnegative(),
  history_complete: z.boolean(),
  summary: ProofSummarySchema,
  discarded_attempts: ProofSummarySchema,
  checks: z.array(ScriptProofRecordSchema).max(BoardLimit.RecordBytes),
});
