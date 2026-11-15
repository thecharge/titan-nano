import { PolicyAlarm } from "@titan/constants";
import { z } from "zod";
import { BoardPostSchema } from "./board.ts";

export const PolicySplitSchema = z.strictObject({
  parts: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  allowed: z.number().int().positive(),
});
export type PolicySplit = z.infer<typeof PolicySplitSchema>;

export const PolicyAlarmRunSchema = z.strictObject({
  splits: z.array(PolicySplitSchema),
  agents: z.number().int().nonnegative(),
  empty: z.number().int().nonnegative(),
});
export type PolicyAlarmRun = z.infer<typeof PolicyAlarmRunSchema>;

export const PolicyAlarmInputSchema = z.strictObject({
  kind: z.string().regex(PolicyAlarm.KindPattern),
  run: z.number().int().nonnegative(),
  window: z.array(PolicyAlarmRunSchema),
  w_agent: z.number().nonnegative(),
  since: z.number().int().nonnegative().optional(),
});
export type PolicyAlarmInput = z.infer<typeof PolicyAlarmInputSchema>;

export const PolicySerialSchema = z.strictObject({
  bonus: z.number().nonnegative(),
  since: z.number().int().nonnegative(),
  zero_at: z.number().int().nonnegative(),
});
export type PolicySerial = z.infer<typeof PolicySerialSchema>;

export const PolicyEmptySchema = z.strictObject({
  w_agent: z.number().nonnegative(),
  multiplier: z.number().positive(),
  share: z.number().nonnegative(),
});
export type PolicyEmpty = z.infer<typeof PolicyEmptySchema>;

export const PolicyAlarmsSchema = z.strictObject({
  serial: PolicySerialSchema.optional(),
  empty: PolicyEmptySchema,
  posts: z.array(BoardPostSchema),
});
export type PolicyAlarms = z.infer<typeof PolicyAlarmsSchema>;
