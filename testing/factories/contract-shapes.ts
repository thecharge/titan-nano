import { HookManifestSchema } from "@titan/types";
import { requestTurnOutputSchema } from "@titan/workflow";
import { z } from "zod";

export function hookManifestContract(input: unknown) {
  const parsed = HookManifestSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function requestTurnContract(result: Record<string, unknown> | null, input: unknown) {
  return z.fromJSONSchema(requestTurnOutputSchema(result)).safeParse(input).success;
}
