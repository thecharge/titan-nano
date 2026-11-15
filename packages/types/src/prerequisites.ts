import { z } from "zod";

export const PrerequisiteStatusSchema = z.strictObject({
  name: z.string().min(1),
  required: z.boolean(),
  ready: z.boolean(),
  repair: z.string().nullable(),
});
export type PrerequisiteStatus = z.infer<typeof PrerequisiteStatusSchema>;
