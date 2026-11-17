import {
  NativeToolRole,
  PersonaRegister,
  ScopedPersonaReferencePattern,
  Verdict,
} from "@titan/constants";
import { z } from "zod";
import { Sha256Schema } from "./hash.ts";

export const PersonaQualityResultSchema = z
  .strictObject({
    persona: z.string().regex(ScopedPersonaReferencePattern),
    run: z.string().min(1),
    step: z.string().min(1),
    part: z.string().min(1),
    candidate: Sha256Schema,
    attempt: z.number().int().positive(),
    generation: z.number().int().nonnegative(),
    role: z.enum(NativeToolRole),
    verdict: z.enum(Verdict),
    later_refuted: z.literal(true).optional(),
  })
  .refine(
    (result) =>
      !result.later_refuted ||
      (result.role === NativeToolRole.Checker && result.verdict === Verdict.Survived),
  );
export type PersonaQualityResult = z.infer<typeof PersonaQualityResultSchema>;

export const PersonaQualityResultsSchema = z
  .array(PersonaQualityResultSchema)
  .max(PersonaRegister.HistoryResults);

export const PersonaJudgementSchema = z.strictObject({
  results: PersonaQualityResultsSchema,
});
