import { ErrorCode, PendingFeature, VerifyKind } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { featurePending } from "@titan/messages";
import type { Plan, Step, VerifyEntry } from "@titan/types";

function otherKind(checks: readonly VerifyEntry[]): boolean {
  return checks.some((check) => check.kind === VerifyKind.Smt);
}

function pendingFeature(step: Step): PendingFeature | undefined {
  if ((step.candidates ?? 1) > 1) return PendingFeature.Candidates;
  if (step.candidate_backends) return PendingFeature.CandidateBackends;
  if (step.verify.some((check) => check.kind === VerifyKind.Smt)) return PendingFeature.Verify;
  return undefined;
}

export function assertBuiltFeatures(plan: Plan): void {
  for (const step of plan.nodes) {
    const feature = pendingFeature(step);
    if (feature) throw new TitanError(ErrorCode.NotBuilt, featurePending(step.id, feature));
  }
  if (otherKind(plan.workflow.verify ?? []))
    throw new TitanError(
      ErrorCode.NotBuilt,
      featurePending(plan.workflow.name, PendingFeature.Verify),
    );
}
