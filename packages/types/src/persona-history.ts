import { PersonaState } from "@titan/constants";
import { z } from "zod";

export const PersonaHistorySchema = z.object({
  state: z.enum(PersonaState).default(PersonaState.Proposed),
  survived: z.number().int().nonnegative().default(0),
  refuted: z.number().int().nonnegative().default(0),
  runs: z.number().int().nonnegative().optional(),
  falsifier_refutations: z.number().int().nonnegative().optional(),
});
export type PersonaHistory = z.infer<typeof PersonaHistorySchema>;
