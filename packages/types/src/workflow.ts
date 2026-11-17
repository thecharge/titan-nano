import {
  backendIds,
  CommandCaptureLimit,
  HarnessAuto,
  HarnessName,
  IdentifierPattern,
  IoLimit,
  MessageId,
  PolicyField,
  ScopedPersonaReferencePattern,
  ScriptExecution,
  VerifyField,
  VerifyKind,
} from "@titan/constants";
import { ConfigMessage, personSetsWeight, WorkflowMessage } from "@titan/messages";
import { z } from "zod";
import { RunSettingOverridesSchema } from "./config.ts";
import { PersonaSchema } from "./persona.ts";

export { type Persona, PersonaSchema } from "./persona.ts";

import { WorkspaceRelativePathSchema } from "./workspace-path.ts";

export const WorkflowSourceSchema = z
  .custom<Uint8Array>((source) => source instanceof Uint8Array)
  .refine((source) => source.byteLength <= IoLimit.DataBytes);

const id = z.string().regex(IdentifierPattern);
export const PersonaChangesSchema = PersonaSchema.partial().extend({
  tags: PersonaSchema.shape.tags.removeDefault().optional(),
  tools: PersonaSchema.shape.tools.removeDefault().optional(),
});
export type PersonaChanges = z.infer<typeof PersonaChangesSchema>;
const reference = z.string().regex(ScopedPersonaReferencePattern);
export const RegisteredPersonaSchema = z.strictObject({
  use: reference,
  backend: z.enum(backendIds).optional(),
});
export const MutatedPersonaSchema = z.strictObject({
  mutates: reference,
  ...PersonaChangesSchema.shape,
});
export const PersonaEntrySchema = z.union([
  PersonaSchema,
  RegisteredPersonaSchema,
  MutatedPersonaSchema,
]);
export type PersonaEntry = z.infer<typeof PersonaEntrySchema>;
const timeout = z
  .number()
  .positive()
  .max(CommandCaptureLimit.MaximumMilliseconds / ScriptExecution.MillisecondsPerSecond);
const names = z.array(z.string().min(1));
export const VerifyEntrySchema = z.discriminatedUnion(
  VerifyField.Kind,
  [
    z.strictObject({
      kind: z.literal(VerifyKind.Lean),
      statement: z.string().min(1),
      theorems: names.default([]).pipe(names.min(1, WorkflowMessage.Theorems)),
      solution: z.string().min(1).optional(),
      paranoid: z.boolean().optional(),
      timeout_s: timeout.optional(),
    }),
    z.strictObject({
      kind: z.literal(VerifyKind.Smt),
      statement: z.string().min(1),
      values: names.optional(),
      timeout_s: timeout.optional(),
    }),
    z.strictObject({
      kind: z.literal(VerifyKind.Script),
      run: z.string().min(1),
      deterministic: z.literal(true),
      timeout_s: timeout.optional(),
    }),
  ],
  { error: WorkflowMessage.UnknownVerifyKind },
);
export type VerifyEntry = z.infer<typeof VerifyEntrySchema>;
const personaName = z.union([id, reference]);
export const PersonaActionSchema = z.strictObject({
  persona: personaName,
  task: z.string().min(1),
});
export type PersonaAction = z.infer<typeof PersonaActionSchema>;
export const ScriptActionSchema = z.strictObject({
  script: z.string().min(1),
  timeout_s: timeout.optional(),
});
export const FalsifierSchema = z.union([PersonaActionSchema, ScriptActionSchema]);
export const OpenCallSchema = z.strictObject({ tags: names.min(1), task: z.string().min(1) });
export type OpenCall = z.infer<typeof OpenCallSchema>;
export const ActionSchema = z.union([
  PersonaActionSchema,
  ScriptActionSchema,
  z.strictObject({ call: OpenCallSchema }),
]);
export const SplitSchema = z.strictObject({
  parts: z.string().min(1),
  width: z.number().int().positive().optional(),
});
export type Split = z.infer<typeof SplitSchema>;
export const StepSchema = z.strictObject({
  id,
  do: ActionSchema,
  reconcile: PersonaActionSchema.optional(),
  needs: z.array(id).optional(),
  inputs: z.record(z.string(), z.string()).default({}),
  falsify: z.array(FalsifierSchema).default([]),
  checks: z.array(z.string().min(1)).default([]),
  verify: z.array(VerifyEntrySchema).default([]),
  split: SplitSchema.optional(),
  files: z.array(WorkspaceRelativePathSchema).min(1).optional(),
  max_attempts: z.number().int().positive().optional(),
  candidates: z.number().int().positive().optional(),
  candidate_backends: z.array(z.enum(backendIds)).min(1).optional(),
  judge: id.optional(),
});
export type Step = z.infer<typeof StepSchema>;
const SequentialGroupSchema = z.strictObject({
  get sequential(): z.ZodArray<typeof GroupSchema> {
    return z.array(GroupSchema).min(1);
  },
});
const ParallelGroupSchema = z.strictObject({
  get parallel(): z.ZodArray<typeof GroupSchema> {
    return z.array(GroupSchema).min(1);
  },
});
const GroupSchema = z.union([StepSchema, SequentialGroupSchema, ParallelGroupSchema]);
export type Group = z.infer<typeof GroupSchema>;
const personOnly = (field: PolicyField) => z.never({ error: personSetsWeight(field) }).optional();
export const PolicySchema = z.strictObject({
  kind: id.optional(),
  [PolicyField.TimeWeight]: personOnly(PolicyField.TimeWeight),
  [PolicyField.AgentWeight]: personOnly(PolicyField.AgentWeight),
});
const graphNodes = z.array(StepSchema.extend({ needs: z.array(id) })).min(1);
export const WorkflowSchema = z
  .strictObject({
    name: z.string().min(1),
    goal: z.string().min(1),
    workflow_id: id.optional(),
    harness: z.enum([...Object.values(HarnessName), HarnessAuto.Value]).optional(),
    personas: z.record(personaName, PersonaEntrySchema),
    plugins: names.optional(),
    verify: z.array(VerifyEntrySchema).optional(),
    improve: z
      .strictObject({
        persona: id.optional(),
        rounds: z.number().int().nonnegative(),
        lessons: z.boolean().optional(),
      })
      .optional(),
    policy: PolicySchema.optional(),
    steps: z.array(GroupSchema).min(1).optional(),
    graph: z.strictObject({ nodes: graphNodes }).optional(),
    ...RunSettingOverridesSchema.shape,
  })
  .refine((v) => Boolean(v.steps) !== Boolean(v.graph), ConfigMessage[MessageId.WorkflowShape]);
export type Workflow = z.infer<typeof WorkflowSchema>;
export type PersonaMap = Record<string, PersonaEntry>;

export const PlanSchema = z.strictObject({
  workflow: WorkflowSchema,
  nodes: z.array(StepSchema),
  revision: z.string().min(1),
});
export type Plan = z.infer<typeof PlanSchema>;

export type StepAction = z.infer<typeof ActionSchema>;
