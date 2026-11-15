import type { PersonaRunRecord, Workflow } from "@titan/types";
import { KnowledgeHub } from "./hub.ts";

export async function registerPersonas(
  home: string,
  workflow: Workflow,
): Promise<PersonaRunRecord> {
  const hub = await KnowledgeHub.open(home);
  try {
    return await hub.registerPersonas(workflow);
  } finally {
    await hub.close();
  }
}
