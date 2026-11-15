import {
  BoardLimit,
  ErrorCode,
  ExecutionPhase,
  ProofAnswer,
  ProofReportFormat,
  RunEventKind,
  ScriptExecution,
  StepStatus,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { BoardMessage } from "@titan/messages";
import { jsonByteLength } from "@titan/streams";
import {
  type ProofSummary,
  RecordedScriptAnswerSchema,
  type Run,
  type RunEvent,
  type ScriptProofRecord,
  ScriptProofRecordSchema,
  ScriptProofReportSchema,
} from "@titan/types";

export function emptyProofSummary(): ProofSummary {
  return { proven: 0, refuted: 0, not_proven: 0, total: 0 };
}

export function countProof(summary: ProofSummary, answer: ProofAnswer): void {
  summary.total++;
  if (answer === ProofAnswer.Proven) summary.proven++;
  else if (answer === ProofAnswer.Refuted) summary.refuted++;
  else summary.not_proven++;
}

export function keptProof(run: Run, record: ScriptProofRecord): boolean {
  if (record.scope === ProofReportFormat.Goal) {
    const saved = RecordedScriptAnswerSchema.safeParse(run.goal?.phases[record.phase]?.answer);
    return (
      run.goal?.result_hash === record.result_hash &&
      saved.success &&
      saved.data.report?.check_id === record.check_id
    );
  }
  const node = run.nodes[record.step_id];
  const answer = RecordedScriptAnswerSchema.safeParse(node?.phases[record.phase]?.answer);
  return (
    node?.state === StepStatus.Passed &&
    node.attempt === record.attempt &&
    node.phases[ExecutionPhase.Worker]?.candidate_hash === record.result_hash &&
    answer.success &&
    answer.data.report?.check_id === record.check_id
  );
}

export function runProofSummary(run: Run): ProofSummary {
  const summary = emptyProofSummary();
  for (const node of [...Object.values(run.nodes), ...(run.goal ? [run.goal] : [])]) {
    if (node !== run.goal && node.state !== StepStatus.Passed) continue;
    for (const [key, phase] of Object.entries(node.phases)) {
      if (!key.startsWith(ScriptExecution.ProofResultPrefix) || !phase.completed) continue;
      countProof(summary, RecordedScriptAnswerSchema.parse(phase.answer).answer);
    }
  }
  return summary;
}

export async function collectProofReport(
  run: Run,
  events: AsyncIterable<RunEvent>,
  maximum_bytes: number = BoardLimit.RecordBytes,
) {
  const checks: ScriptProofRecord[] = [];
  const discarded = emptyProofSummary();
  let bytes = 0;
  let complete = true;
  for await (const event of events) {
    if (event.type !== RunEventKind.CheckAnswered) continue;
    const parsed = ScriptProofRecordSchema.safeParse(Object(event.data).report);
    if (!parsed.success) {
      complete = false;
      continue;
    }
    const record = parsed.data;
    bytes += jsonByteLength(record, maximum_bytes);
    if (bytes > maximum_bytes) throw new TitanError(ErrorCode.Capacity, BoardMessage.Limit);
    checks.push(record);
    if (!keptProof(run, record)) countProof(discarded, record.answer);
  }
  return ScriptProofReportSchema.parse({
    schema_version: ProofReportFormat.Version,
    run_id: run.run_id,
    through: run.version,
    history_complete: complete,
    summary: runProofSummary(run),
    discarded_attempts: discarded,
    checks,
  });
}
