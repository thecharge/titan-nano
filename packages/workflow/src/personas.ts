import { ErrorCode, WorkflowField } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { unknownPersona, unresolvedPersona } from "@titan/messages";
import type { Persona, PersonaAction, StepAction, Workflow } from "@titan/types";

export function resolvedPersona(workflow: Workflow, name: string): Persona {
  const entry = workflow.personas[name];
  if (!entry) throw new TitanError(ErrorCode.UnknownPersona, unknownPersona(workflow.name, name));
  if (WorkflowField.Use in entry || WorkflowField.Mutates in entry)
    throw new TitanError(ErrorCode.UnresolvedPersona, unresolvedPersona(name));
  return entry;
}

export function workflowSkillBindings(workflow: Workflow): Record<string, string[]> {
  return Object.fromEntries(
    Object.keys(workflow.personas)
      .map((name) => [name, resolvedPersona(workflow, name).skills ?? []] as const)
      .filter(([, skills]) => skills.length > 0),
  );
}

export function personaAction(action: StepAction): PersonaAction | undefined {
  return WorkflowField.Persona in action ? action : undefined;
}
