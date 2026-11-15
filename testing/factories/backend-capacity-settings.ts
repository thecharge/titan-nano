import { BackendCapacitySchema } from "@titan/types";

export function backendCapacitySettings(value: unknown) {
  return BackendCapacitySchema.parse(value);
}
