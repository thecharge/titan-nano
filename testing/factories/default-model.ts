import { effectiveModel } from "@titan/runner";
import { DefaultsSchema, PersonaSchema } from "@titan/types";

const persona = (model: string | undefined) =>
  PersonaSchema.parse({ description: "d", role: "r", ...(model ? { model } : {}) });

export function modelFor(defaultModel: string | null, personaModel: string | undefined) {
  return effectiveModel(persona(personaModel), DefaultsSchema.parse({ model: defaultModel }));
}

export function modelSetting(value: string) {
  const parsed = DefaultsSchema.safeParse({ model: value });
  return parsed.success
    ? { ok: true, model: parsed.data.model }
    : {
        ok: false,
        path: parsed.error.issues[0]?.path.join("."),
        message: parsed.error.issues[0]?.message,
      };
}
