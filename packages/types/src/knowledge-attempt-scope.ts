import { IdentifierPattern, ServerLimit } from "@titan/constants";
import { z } from "zod";

const id = z.string().max(ServerLimit.IdentityCharacters).regex(IdentifierPattern);
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const KnowledgeAttemptScopeSchema = z.strictObject({
  run_id: id,
  step_id: id,
  part_id: id.nullable(),
  candidate_id: id,
  attempt: version,
});
export type KnowledgeAttemptScope = z.infer<typeof KnowledgeAttemptScopeSchema>;
