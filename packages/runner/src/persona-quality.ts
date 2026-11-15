import {
  ErrorCode,
  ExecutionPhase,
  FileEncoding,
  NativeToolRole,
  RunEventKind,
  Verdict,
  WorkflowField,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import {
  FalsifierAnswerSchema,
  type NodeState,
  PersonaJudgementSchema,
  type PersonaQualityResult,
  type Phase,
  type Run,
  type RunCommit,
  SavedCommandCaptureSchema,
  type Step,
  type StepAction,
} from "@titan/types";
import { workerAction } from "./reconciliation.ts";
import { scriptVerdict } from "./script-verdict.ts";

function result(
  run: Run,
  step: Step,
  state: NodeState,
  action: StepAction,
  part: string,
  role: NativeToolRole,
  verdict: Verdict,
  later = false,
): PersonaQualityResult[] {
  if (!(WorkflowField.Persona in action)) return [];
  const persona =
    run.persona_references?.[action.persona] ??
    (role === NativeToolRole.Worker && run.picks?.[step.id] === action.persona
      ? action.persona
      : undefined);
  const candidate = state.phases[ExecutionPhase.Worker]?.candidate_hash;
  if (!persona || !candidate)
    throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
  return [
    {
      persona,
      run: run.run_id,
      step: step.id,
      part,
      candidate,
      attempt: state.attempt,
      generation: state.reconciliations?.length ?? 0,
      role,
      verdict,
      ...(later ? { later_refuted: true } : {}),
    },
  ];
}

function workers(run: Run, step: Step, state: NodeState, verdict: Verdict): PersonaQualityResult[] {
  const action = workerAction(step, state);
  const parts =
    step.split && !state.reconciliations
      ? Object.keys(state.phases).filter((key) => key.startsWith(ExecutionPhase.PartPrefix))
      : [ExecutionPhase.Worker];
  return parts.flatMap((part) =>
    result(run, step, state, action, part, NativeToolRole.Worker, verdict),
  );
}

function refutedCheck(action: StepAction, phase: Phase | undefined): boolean {
  if (!phase?.completed) return false;
  if (!(WorkflowField.Script in action))
    return FalsifierAnswerSchema.parse(phase.answer).verdict === Verdict.Refuted;
  const capture = SavedCommandCaptureSchema.parse(phase.answer);
  return (
    scriptVerdict({
      ...capture,
      stdout: Buffer.from(capture.stdout, FileEncoding.Utf8),
      stderr: Buffer.from(capture.stderr, FileEncoding.Utf8),
    }).verdict === Verdict.Refuted
  );
}

function checkers(run: Run, step: Step, state: NodeState): PersonaQualityResult[] {
  return step.falsify.flatMap((action, index) => {
    const part = `${ExecutionPhase.FalsifierPrefix}${index}`;
    const phase = state.phases[part];
    if (!(WorkflowField.Persona in action) || !phase?.completed) return [];
    const answer = FalsifierAnswerSchema.parse(phase.answer);
    const later =
      answer.verdict === Verdict.Survived &&
      step.falsify
        .slice(index + 1)
        .some((check, offset) =>
          refutedCheck(
            check,
            state.phases[`${ExecutionPhase.FalsifierPrefix}${index + offset + 1}`],
          ),
        );
    return result(run, step, state, action, part, NativeToolRole.Checker, answer.verdict, later);
  });
}

export async function recordPersonaQuality(
  run: Run,
  step: Step,
  state: NodeState,
  refuted: boolean,
  commit: RunCommit,
): Promise<void> {
  if (!run.persona_references) return;
  const results = [
    ...workers(run, step, state, refuted ? Verdict.Refuted : Verdict.Survived),
    ...checkers(run, step, state),
  ];
  await commit(run, RunEventKind.ResultJudged, PersonaJudgementSchema.parse({ results }));
}
