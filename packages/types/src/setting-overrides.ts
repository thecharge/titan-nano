import { ConfigSection, SettingOverrideLimit, TextSymbol } from "@titan/constants";
import { z } from "zod";
import { ApprovalPolicySchema } from "./approval-policy.ts";
import { DefaultsSchema, LimitsSchema, RecoveryFields, RequestSettingsSchema } from "./config.ts";

export const SettingOverrideRegistry = {
  ...Object.fromEntries(
    Object.entries(RequestSettingsSchema.shape).map(([key, schema]) => [
      [ConfigSection.Requests, key].join(TextSymbol.Dot),
      schema,
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(ApprovalPolicySchema.shape).map(([key, schema]) => [
      [ConfigSection.Approvals, key].join(TextSymbol.Dot),
      schema,
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(DefaultsSchema.shape).map(([key, schema]) => [
      [ConfigSection.Defaults, key].join(TextSymbol.Dot),
      schema,
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(LimitsSchema.shape).map(([key, schema]) => [
      [ConfigSection.Limits, key].join(TextSymbol.Dot),
      schema,
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(RecoveryFields.shape).map(([key, schema]) => [
      [ConfigSection.Recovery, key].join(TextSymbol.Dot),
      schema,
    ]),
  ),
};
export const SettingOverrideInputsSchema = z
  .array(z.string().min(1).max(SettingOverrideLimit.Characters))
  .max(SettingOverrideLimit.Entries);
