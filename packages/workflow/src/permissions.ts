import { Backend, ClaudeToolPolicy, ErrorCode } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { unsupportedPersonaTools } from "@titan/messages";
import type { BackendId, Plan, StepAction } from "@titan/types";
import { personaAction, resolvedPersona } from "./personas.ts";

function checkActionTools(
  plan: Plan,
  action: StepAction,
  writable: boolean,
  fallback?: BackendId,
): void {
  const worker = personaAction(action);
  if (!worker) return;
  const persona = resolvedPersona(plan.workflow, worker.persona);
  const backend = persona.backend ?? fallback ?? plan.workflow.defaults?.backend;
  if (backend !== Backend.Claude) return;
  const supported: readonly string[] = writable
    ? ClaudeToolPolicy.Writable
    : ClaudeToolPolicy.ReadOnly;
  const unsupported = persona.tools.filter((tool) => !supported.includes(tool));
  if (unsupported.length)
    throw new TitanError(
      ErrorCode.PermissionDenied,
      unsupportedPersonaTools(worker.persona, unsupported),
    );
}

export function validatePlanTools(plan: Plan, fallback?: BackendId): void {
  for (const step of plan.nodes) {
    checkActionTools(plan, step.do, true, fallback);
    if (step.reconcile) checkActionTools(plan, step.reconcile, true, fallback);
    for (const checker of step.falsify) checkActionTools(plan, checker, false, fallback);
  }
}
