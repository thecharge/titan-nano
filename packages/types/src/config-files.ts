import { ConfigScope, ConfigWrite, SettingOverrideLimit } from "@titan/constants";
import { z } from "zod";
import { EffectiveConfigSchema } from "./config.ts";
import { Sha256Schema } from "./hash.ts";

export const ConfigFileTargetSchema = z.strictObject({
  home: z.string().min(1),
  project: z.string().min(1),
  scope: z.enum(ConfigScope),
});
export type ConfigFileTarget = z.infer<typeof ConfigFileTargetSchema>;
export const ConfigFileVersionSchema = z.strictObject({
  path: z.string().min(1),
  version: Sha256Schema.nullable(),
});
export const ConfigFileChangeSchema = ConfigFileTargetSchema.extend({
  expected_version: Sha256Schema.nullable(),
  patch: z.unknown(),
});
export type ConfigFileChange = z.infer<typeof ConfigFileChangeSchema>;
export const ConfigSettingSchema = z
  .string()
  .max(SettingOverrideLimit.Characters)
  .regex(ConfigWrite.SettingPattern);

export const ConfigFileInspectionSchema = ConfigFileVersionSchema.extend({
  scope: z.enum(ConfigScope),
  config: EffectiveConfigSchema,
});
export type ConfigFileInspection = z.infer<typeof ConfigFileInspectionSchema>;
