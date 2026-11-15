import { ErrorCode, SettingAssignment, TextSymbol } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { SettingOverrideMessage } from "@titan/messages";
import {
  ObjectSchema,
  RunSettingOverridesSchema,
  SettingOverrideInputsSchema,
  SettingOverrideRegistry,
} from "@titan/types";

function settingValue(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function settingOverrides(
  entries: string[] = [],
  initial: Record<string, unknown> = {},
): Record<string, unknown> {
  const inputs = SettingOverrideInputsSchema.safeParse(entries);
  if (!inputs.success) throw new TitanError(ErrorCode.Arguments, SettingOverrideMessage.Input);
  const base = RunSettingOverridesSchema.safeParse(initial);
  if (!base.success) throw new TitanError(ErrorCode.Arguments, SettingOverrideMessage.Value);
  const result: Record<string, unknown> = { ...base.data };
  for (const input of inputs.data) {
    const separator = input.indexOf(SettingAssignment);
    const name = input.slice(0, separator);
    const text = input.slice(separator + 1);
    if (separator < 1 || !text || !Object.hasOwn(SettingOverrideRegistry, name))
      throw new TitanError(ErrorCode.Arguments, SettingOverrideMessage.Assignment);
    const schema = SettingOverrideRegistry[name];
    const parsed = schema?.safeParse(settingValue(text));
    if (!parsed?.success) throw new TitanError(ErrorCode.Arguments, SettingOverrideMessage.Value);
    const dot = name.indexOf(TextSymbol.Dot);
    const section = name.slice(0, dot);
    const field = name.slice(dot + 1);
    const fields = ObjectSchema.parse(result[section] ?? {});
    if (Object.hasOwn(fields, field))
      throw new TitanError(ErrorCode.Arguments, SettingOverrideMessage.Duplicate);
    result[section] = { ...fields, [field]: parsed.data };
  }
  return result;
}
