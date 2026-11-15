import { RunStatus } from "@titan/constants";
import { z } from "zod";

export const SplitObservedSchema = z.object({
  workers: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  peak: z.number().int().nonnegative(),
  state: z.enum(RunStatus),
});
export type SplitObserved = z.infer<typeof SplitObservedSchema>;
