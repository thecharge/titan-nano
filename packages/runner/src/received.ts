import { initialPhase } from "@titan/board";
import { ErrorCode, ExecutionPhase, RunEventKind, RunFormat } from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { RunnerMessage } from "@titan/messages";
import type { Phase, PhaseContext, RunCommit } from "@titan/types";
import { verifyCandidate } from "./artifacts.ts";
import { verifyLiveCandidate } from "./live.ts";

export async function sealWorker(
  context: PhaseContext,
  phase: Phase,
  checksum: string,
  commit: RunCommit,
): Promise<void> {
  phase.candidate_hash = checksum;
  await commit(context.run, RunEventKind.PhaseCaptured, {
    step_id: context.step.id,
    attempt: context.state.attempt,
    phase: ExecutionPhase.Worker,
    execution_id: phase.execution_id,
    candidate_hash: checksum,
  });
}

export async function restoreCaptured(
  context: PhaseContext,
  candidate: string,
  commit: RunCommit,
): Promise<boolean> {
  const phase = context.state.phases[ExecutionPhase.Worker];
  if (!phase?.capture_pending) return false;
  if (!phase.candidate_hash) assertCaptured(phase);
  await verifyCandidate(context.run, context.step, candidate);
  await verifyLiveCandidate(context.run, candidate, context.step);
  delete phase.capture_pending;
  phase.completed = true;
  phase.error = null;
  phase.next_retry = null;
  await commit(context.run, RunEventKind.PhaseCompleted, {
    step_id: context.step.id,
    attempt: context.state.attempt,
    phase: ExecutionPhase.Worker,
    execution_id: phase.execution_id,
    candidate_hash: phase.candidate_hash,
  });
  return true;
}

export function assertCaptured(phase: Phase): void {
  if (phase.capture_pending)
    throw new OperationalError(ErrorCode.SnapshotChanged, RunnerMessage.CapturePending);
}

export async function receiveWorker(
  context: PhaseContext,
  answer: unknown,
  commit: RunCommit,
): Promise<void> {
  const phase = context.state.phases[context.key] ?? initialPhase();
  context.state.phases[context.key] = phase;
  phase.answer = answer;
  phase.capture_pending = true;
  if (context.run.schema_version < RunFormat.CaptureReceipts)
    context.run.schema_version = RunFormat.CaptureReceipts;
  await commit(context.run, RunEventKind.PhaseReceived, {
    step_id: context.step.id,
    attempt: context.state.attempt,
    phase: context.key,
    execution_id: phase.execution_id,
  });
}
