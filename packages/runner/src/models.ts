import type { Defaults, Persona } from "@titan/types";

export function effectiveModel(persona: Persona, defaults: Defaults): string | null {
  return persona.model ?? defaults.model;
}
