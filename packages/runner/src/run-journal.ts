import { RunHubOutcome, StepStatus } from "@titan/constants";
import type { NodeState, RunJournalStep, Step } from "@titan/types";
import { personaAction } from "@titan/workflow";

function checkResults(node: NodeState): string[] {
  if (node.state === StepStatus.Passed) return [RunHubOutcome.Passed];
  if (node.refutations > 0) return [RunHubOutcome.Refuted, ...(node.failures ?? [])];
  return [];
}

export function runJournalStep(
  step: Step,
  node: NodeState | undefined,
  saved: ReadonlyMap<string, readonly string[]> | undefined,
): RunJournalStep {
  const state = node?.state ?? StepStatus.Pending;
  return {
    step_id: step.id,
    state,
    persona: personaAction(step.do)?.persona ?? step.id,
    attempts: node?.attempt ?? 1,
    files: Object.keys(node?.changes ?? {}),
    checks: node ? checkResults(node) : [],
    refusals: [...(node?.evidence ?? [])],
    lessons: [...(saved?.get(step.id) ?? [])],
  };
}
