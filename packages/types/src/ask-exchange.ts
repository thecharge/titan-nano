import { AskMode, RequestDecision } from "@titan/constants";
import { z } from "zod";
import { RunSchema } from "./board.ts";

export const AskExchangeSchema = z.object({
  fixerAsks: z.number(),
  direct: z.boolean(),
  skepticAsks: z.number(),
  decision: z.enum(RequestDecision),
  mode: z.enum(AskMode),
});
export type AskExchange = z.infer<typeof AskExchangeSchema>;

export const AskObservedSchema = z.object({
  fixerPrompts: z.array(z.string()),
  skepticPrompts: z.array(z.string()),
  sessions: z.array(z.string().nullish()),
  run: RunSchema,
  codes: z.array(z.unknown()),
});
export type AskObserved = z.infer<typeof AskObservedSchema>;
