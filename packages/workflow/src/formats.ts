import { isDeepStrictEqual } from "node:util";
import { ErrorCode, SchemaKind, TextSymbol, WorkflowField } from "@titan/constants";
import { TitanError } from "@titan/errors";
import {
  inputFormatMismatch,
  missingJudge,
  noFalsifier,
  selfFalsification,
  unfinishedInput,
  unknownPersona,
  unsupportedPersonaFormat,
} from "@titan/messages";
import type { Persona, PersonaEntry, PersonaMap, Step, Workflow } from "@titan/types";
import { z } from "zod";
import { resolvedPersona } from "./personas.ts";

export function outputSchema(persona: Persona): Record<string, unknown> | null {
  if (!persona.outputs) return null;
  return {
    type: SchemaKind.Object,
    properties: persona.outputs,
    required: Object.keys(persona.outputs),
    additionalProperties: false,
  };
}

export function checkAnswer(persona: Persona, value: unknown): void {
  const schema = outputSchema(persona);
  if (schema) z.fromJSONSchema(schema).parse(value);
}

export function validatePersonaFormats(personas: PersonaMap): void {
  for (const [name, persona] of Object.entries(personas)) validateFormats(name, persona);
}

function validateFormats(name: string, persona: PersonaEntry): void {
  if (WorkflowField.Use in persona) return;
  try {
    const formats = [
      ...Object.values(persona.inputs ?? {}),
      ...Object.values(persona.outputs ?? {}),
    ];
    for (const format of formats) z.fromJSONSchema(format);
  } catch {
    throw new TitanError(ErrorCode.InvalidFormat, unsupportedPersonaFormat(name));
  }
}

function identity(workflow: Workflow, name: string): string {
  const entry = workflow.personas[name];
  return entry && WorkflowField.Use in entry ? entry.use : name;
}

function assertPersona(node: Step, workflow: Workflow, name: string): void {
  if (!workflow.personas[name])
    throw new TitanError(ErrorCode.UnknownPersona, unknownPersona(node.id, name));
}

export function validatePersonas(node: Step, workflow: Workflow): void {
  if (!node.falsify.length && !node.verify.length)
    throw new TitanError(ErrorCode.NoFalsifier, noFalsifier(node.id));
  for (const entry of [node.do, ...node.falsify])
    if (WorkflowField.Persona in entry) assertPersona(node, workflow, entry.persona);
  if (node.reconcile) assertPersona(node, workflow, node.reconcile.persona);
  if (node.judge) assertPersona(node, workflow, node.judge);
  if ((node.candidates ?? 1) > 1 && !node.judge)
    throw new TitanError(ErrorCode.MissingJudge, missingJudge(node.id));
  const workers = [
    ...(WorkflowField.Persona in node.do ? [identity(workflow, node.do.persona)] : []),
    ...(node.reconcile ? [identity(workflow, node.reconcile.persona)] : []),
  ];
  if (
    node.falsify.some(
      (entry) =>
        WorkflowField.Persona in entry && workers.includes(identity(workflow, entry.persona)),
    )
  )
    throw new TitanError(ErrorCode.SelfFalsification, selfFalsification(node.id));
}

export function validateInputs(
  node: Step,
  parents: Set<string>,
  nodes: Map<string, Step>,
  workflow: Workflow,
): void {
  for (const [input, source] of Object.entries(node.inputs)) {
    const [producer, field] = source.split(TextSymbol.Dot);
    if (!producer || !parents.has(producer))
      throw new TitanError(ErrorCode.InputDependency, unfinishedInput(node.id, producer ?? source));
    const origin = nodes.get(producer);
    if (origin)
      validateInputFormat(node, origin, input, field ?? TextSymbol.Empty, source, workflow);
  }
}

function validateInputFormat(
  node: Step,
  origin: Step,
  input: string,
  field: string,
  source: string,
  workflow: Workflow,
): void {
  if (!(WorkflowField.Persona in origin.do) || !(WorkflowField.Persona in node.do)) return;
  const format = resolvedPersona(workflow, origin.do.persona).outputs?.[field];
  const expected = resolvedPersona(workflow, node.do.persona).inputs?.[input];
  if (expected && !isDeepStrictEqual(format, expected))
    throw new TitanError(
      ErrorCode.FormatMismatch,
      inputFormatMismatch(node.id, input, source, expected, format),
    );
}
