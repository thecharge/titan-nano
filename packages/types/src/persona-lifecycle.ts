import {
  KnowledgeLimit,
  PersonaReferencePattern,
  PersonaRegister,
  PersonaState,
  RequestKind,
} from "@titan/constants";
import { z } from "zod";
import { Sha256Schema } from "./hash.ts";
import { PersonaQualityResultsSchema } from "./persona-quality.ts";
import { PersonaUsageSchema } from "./usage.ts";
import { PersonaSchema, RegisteredPersonaSchema, WorkflowSchema } from "./workflow.ts";

export const PersonaMoveSchema = z.object({
  persona: z.string(),
  from: z.enum(PersonaState),
  to: z.enum(PersonaState),
  survived: z.number(),
  total: z.number(),
  lower: z.number(),
  upper: z.number(),
  bar: z.number(),
});
export type PersonaMove = z.infer<typeof PersonaMoveSchema>;

export const PersonaRequestSchema = z.object({
  kind: z.enum(RequestKind),
  names: z.array(z.string()),
  refutations: z.number().int().nonnegative().optional(),
});
export type PersonaRequest = z.infer<typeof PersonaRequestSchema>;

export const PersonaTransitionSchema = z.strictObject({
  result: Sha256Schema,
  run: z.string().min(1),
  move: PersonaMoveSchema,
  requests: z.array(PersonaRequestSchema).max(PersonaRegister.HistoryResults),
});

export const PersonaDecisionReceiptSchema = z.strictObject({
  run: z.string().min(1),
  request_id: z.string().min(1),
  request: Sha256Schema,
  move: PersonaMoveSchema,
});

export const PersonaSamplingSchema = z.strictObject({
  survived: z.number().nonnegative(),
  refuted: z.number().nonnegative(),
});
export type PersonaSampling = z.infer<typeof PersonaSamplingSchema>;

export const PersonaRecordSchema = z.strictObject({
  name: z.string().min(1),
  version: z.number().int().positive(),
  parent: z.string().regex(PersonaReferencePattern).optional(),
  registration: Sha256Schema.optional(),
  persona: PersonaSchema,
  state: z.enum(PersonaState).optional(),
  history: PersonaQualityResultsSchema.optional(),
  transitions: z.array(PersonaTransitionSchema).max(PersonaRegister.HistoryResults).optional(),
  decisions: z.array(PersonaDecisionReceiptSchema).max(PersonaRegister.HistoryResults).optional(),
  survived: z.number().int().nonnegative().optional(),
  refuted: z.number().int().nonnegative().optional(),
  runs: z.number().int().nonnegative().optional(),
  falsifier_refutations: z.number().int().nonnegative().optional(),
  falsifier_passes_later_refuted: z.number().int().nonnegative().optional(),
  uses: z.number().int().nonnegative().optional(),
  asked: z.number().int().nonnegative().optional(),
  asked_history_complete: z.boolean().optional(),
  usage: PersonaUsageSchema.optional(),
  sampling: PersonaSamplingSchema.optional(),
});
export type PersonaRecord = z.infer<typeof PersonaRecordSchema>;

export const PersonaInspectionQuerySchema = z.strictObject({
  selector: z.string().min(1).max(KnowledgeLimit.TitleCharacters),
  before: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(KnowledgeLimit.MaximumPage).default(KnowledgeLimit.Page),
});

export const PersonaInspectionSchema = z.strictObject({
  name: z.string().min(1),
  versions: z
    .array(PersonaRecordSchema.extend({ uses: z.number().int().nonnegative() }))
    .max(KnowledgeLimit.MaximumPage),
  has_more: z.boolean(),
  next_version: z.number().int().positive().nullable(),
});

export const PersonaRunRecordSchema = z.record(z.string(), RegisteredPersonaSchema.shape.use);
export type PersonaRunRecord = z.infer<typeof PersonaRunRecordSchema>;

export const PersonaBindingSchema = z.strictObject({
  workflow: WorkflowSchema,
  references: PersonaRunRecordSchema,
});
export type PersonaBinding = z.infer<typeof PersonaBindingSchema>;

export const PersonaVersionSchema = z.object({
  name: z.string().min(1),
  version: z.number().int().positive(),
  state: z.enum(PersonaState),
  survived: z.number().int().nonnegative(),
  refuted: z.number().int().nonnegative(),
  role: z.string(),
});
export type PersonaVersion = z.infer<typeof PersonaVersionSchema>;

export const PersonaVersionEntrySchema = z.tuple([
  z.string().min(1),
  z.number().int().positive(),
  z.enum(PersonaState),
]);
export type PersonaVersionEntry = z.infer<typeof PersonaVersionEntrySchema>;

export { type PersonaHistory, PersonaHistorySchema } from "./persona-history.ts";

export const PersonaReferencePartsSchema = z.strictObject({
  name: z.string(),
  version: z.number(),
});
export type PersonaReferenceParts = z.infer<typeof PersonaReferencePartsSchema>;

export const WilsonBoundsSchema = z.object({
  lower: z.number().min(0).max(1),
  upper: z.number().min(0).max(1),
});
export type WilsonBounds = z.infer<typeof WilsonBoundsSchema>;

export const PersonaAdvanceSchema = z.object({
  state: z.enum(PersonaState),
  bounds: WilsonBoundsSchema,
  history: z.array(PersonaMoveSchema),
  requests: z.array(PersonaRequestSchema),
});
export type PersonaAdvance = z.infer<typeof PersonaAdvanceSchema>;

export const PersonaListingSchema = z.object({
  id: z.string(),
  state: z.enum(PersonaState),
});
export type PersonaListing = z.infer<typeof PersonaListingSchema>;

export const PersonaSimulationSchema = z.object({
  rates: z.array(z.number().min(0).max(1)).min(2),
  picks: z.number().int().positive(),
  repeats: z.number().int().positive(),
  seed: z.number().int(),
  swap: z.boolean(),
});
export type PersonaSimulation = z.infer<typeof PersonaSimulationSchema>;

export const PersonaSimulationResultSchema = z.object({
  lastShare: z.number(),
  breachRate: z.number(),
});
export type PersonaSimulationResult = z.infer<typeof PersonaSimulationResultSchema>;

export const PersonaCountSchema = z.object({ survived: z.number(), refuted: z.number() });
export type PersonaCount = z.infer<typeof PersonaCountSchema>;

export const PersonaRunResultSchema = z.object({
  persona: z.string().min(1),
  run: z.string().min(1),
  candidates: z.number().int().nonnegative(),
  survived: z.number().int().nonnegative(),
});
export type PersonaRunResult = z.infer<typeof PersonaRunResultSchema>;

export const PersonaHistoryEntrySchema = z.object({
  persona: z.string().min(1),
  run: z.string().min(1),
  survived: z.number().int().nonnegative(),
  refuted: z.number().int().nonnegative(),
});
export type PersonaHistoryEntry = z.infer<typeof PersonaHistoryEntrySchema>;

export const PersonaRegisterEntrySchema = z.object({
  name: z.string().min(1),
  version: z.number().int().positive(),
  state: z.enum(PersonaState),
  survived: z.number().nonnegative(),
  refuted: z.number().nonnegative(),
  persona: PersonaSchema,
});
export type PersonaRegisterEntry = z.infer<typeof PersonaRegisterEntrySchema>;

export const OpenCallPickSchema = z.object({
  entry: PersonaRegisterEntrySchema,
  rule: z.string().min(1),
  seed: z.number().int().nonnegative().optional(),
  eligible: z.array(RegisteredPersonaSchema.shape.use).optional(),
});
export type OpenCallPick = z.infer<typeof OpenCallPickSchema>;

export const RandomSchema = z.function({ input: [], output: z.number() });
export type Random = z.infer<typeof RandomSchema>;
