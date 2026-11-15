import type { BackendId, Persona, Run } from "@titan/types";

export function personaBackend(run: Run, persona?: Persona): BackendId {
  return (
    run.switched_backend ?? persona?.backend ?? run.config.value.defaults.backend ?? run.backend
  );
}
