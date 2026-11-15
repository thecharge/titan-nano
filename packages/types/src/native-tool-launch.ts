import { isAbsolute, resolve } from "node:path";
import {
  NativeToolLaunchLimit,
  NativeToolTransport,
  ServerLimit,
  WorkspacePathPattern,
} from "@titan/constants";
import { z } from "zod";
import { NativeToolConnectionSchema } from "./native-tool-connection.ts";

export const NativeToolLaunchSchema = z.strictObject({
  command: z
    .string()
    .min(1)
    .max(ServerLimit.SummaryCharacters)
    .regex(WorkspacePathPattern)
    .refine((path) => isAbsolute(path) && resolve(path) === path),
  args: z
    .array(z.string().max(ServerLimit.SummaryCharacters).regex(WorkspacePathPattern))
    .max(NativeToolLaunchLimit.Arguments),
});
export type NativeToolLaunch = z.infer<typeof NativeToolLaunchSchema>;
export const NativeToolBindingSchema = z
  .strictObject({
    transport: z.enum(NativeToolTransport).optional(),
    connection: NativeToolConnectionSchema,
    launch: NativeToolLaunchSchema,
  })
  .refine((binding) => !JSON.stringify(binding.launch).includes(binding.connection.token));
export type NativeToolBinding = z.infer<typeof NativeToolBindingSchema>;
