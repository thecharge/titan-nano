import { z } from "zod";
import { UsageSchema } from "./agents.ts";

export const CodexTurnStateSchema = z.strictObject({
  session_id: z.string().nullable(),
  text: z.string(),
  complete: z.boolean(),
  usage: UsageSchema,
});
export type CodexTurnState = z.infer<typeof CodexTurnStateSchema>;
