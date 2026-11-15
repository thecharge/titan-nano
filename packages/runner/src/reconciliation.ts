import { resolve } from "node:path";
import {
  ErrorCode,
  ExecutionPhase,
  Newline,
  PathPart,
  RunEventKind,
  RunFile,
  RunFormat,
  RuntimeLimit,
  Verdict,
  WorkflowField,
} from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { RunnerMessage } from "@titan/messages";
import {
  FalsifierAnswerSchema,
  type NodeState,
  type Run,
  type RunCommit,
  SavedCommandCaptureSchema,
  type Step,
} from "@titan/types";
import { readTree, treeHash, writeTree } from "@titan/workspace";
import { verifyCandidate } from "./artifacts.ts";
import { liveRun, verifyLiveCandidate } from "./live.ts";

export function workerAction(step: Step, state: NodeState) {
  const action = step.reconcile ?? step.do;
  if (!state.reconciliations || !(WorkflowField.Persona in action)) return step.do;
  return {
    ...action,
    task: step.reconcile
      ? [RunnerMessage.ReconcileReceived, action.task].join(Newline)
      : RunnerMessage.ReconcileReceived,
  };
}

export function stepFolder(run: Run, step: Step, state: NodeState): string {
  const folder = resolve(
    run.root,
    RunFile.Steps,
    step.id,
    `${RunFile.AttemptPrefix}${state.attempt}`,
  );
  const generation = state.reconciliations?.length ?? 0;
  return generation ? resolve(folder, `${RunFile.ReconciliationPrefix}${generation}`) : folder;
}

function retainedRefutation(state: NodeState): boolean {
  return Object.entries(state.phases).some(([key, phase]) => {
    if (key === ExecutionPhase.Worker || !phase.completed) return false;
    const verdict = FalsifierAnswerSchema.safeParse(phase.answer);
    const script = SavedCommandCaptureSchema.safeParse(phase.answer);
    return (
      verdict.data?.verdict === Verdict.Refuted || (script.success && script.data.exit_code !== 0)
    );
  });
}

export async function reconcileReceived(
  run: Run,
  step: Step,
  state: NodeState,
  commit: RunCommit,
): Promise<boolean> {
  const received = state.phases[ExecutionPhase.Worker];
  if (
    !liveRun(run) ||
    !received ||
    (!received.capture_pending && !(received.completed && received.candidate_hash)) ||
    (step.split && !step.reconcile)
  )
    return false;
  if ((!step.reconcile && !(WorkflowField.Persona in step.do)) || retainedRefutation(state))
    return false;
  if (received.candidate_hash) {
    const candidate = resolve(stepFolder(run, step, state), RunFile.Candidate);
    await verifyCandidate(run, step, candidate);
    try {
      await verifyLiveCandidate(run, candidate, step);
      return false;
    } catch (error) {
      if (!(error instanceof OperationalError) || error.code !== ErrorCode.FileConflict)
        throw error;
    }
  }
  const previous = state.reconciliations;
  const generation = (previous?.length ?? 0) + 1;
  if (generation > Math.min(run.config.value.recovery.max_retries, RuntimeLimit.PendingOperations))
    throw new OperationalError(ErrorCode.RecoveryExhausted, RunnerMessage.RecoveryExhausted);
  const limits = run.config.value.limits;
  const parent = resolve(
    run.root,
    RunFile.Steps,
    step.id,
    `${RunFile.AttemptPrefix}${state.attempt}`,
  );
  const input = resolve(parent, `${RunFile.ReconciliationPrefix}${generation}`, RunFile.Input);
  const current = await readTree(run.project, limits, undefined, run.runtime_paths);
  await writeTree(input, current, limits);
  const input_hash = await treeHash(await readTree(input, limits));
  const phases = state.phases;
  const format = run.schema_version;
  state.reconciliations = [...(previous ?? []), { input, input_hash, phases }];
  state.phases = {};
  if (run.schema_version < RunFormat.Reconciliation) run.schema_version = RunFormat.Reconciliation;
  try {
    await commit(run, RunEventKind.ReconciliationStarted, {
      step_id: step.id,
      attempt: state.attempt,
      generation,
      input,
      input_hash,
      original_execution_id: received.execution_id,
    });
  } catch (error) {
    state.phases = phases;
    if (previous) state.reconciliations = previous;
    else delete state.reconciliations;
    run.schema_version = format;
    throw error;
  }
  return true;
}

export async function verifyReconciliation(run: Run, step: Step, state: NodeState): Promise<void> {
  for (const [index, generation] of (state.reconciliations ?? []).entries()) {
    if (
      (await treeHash(await readTree(generation.input, run.config.value.limits))) !==
      generation.input_hash
    )
      throw new OperationalError(ErrorCode.CheckpointChanged, RunnerMessage.InputCheckpoint);
    const checksum = generation.phases[ExecutionPhase.Worker]?.candidate_hash;
    if (!checksum) continue;
    const candidate = resolve(
      generation.input,
      PathPart.Parent,
      PathPart.Parent,
      index ? `${RunFile.ReconciliationPrefix}${index}` : PathPart.Current,
      RunFile.Candidate,
    );
    await verifyCandidate(run, step, candidate, undefined, checksum);
  }
}
