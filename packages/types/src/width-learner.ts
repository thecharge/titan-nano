import { z } from "zod";

export const WidthStateSchema = z.object({
  positive: z.array(z.number()),
  negative: z.array(z.number()),
  scores: z.array(z.number()),
});
export type WidthState = z.infer<typeof WidthStateSchema>;
