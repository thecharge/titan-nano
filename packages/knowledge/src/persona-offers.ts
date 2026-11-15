import {
  ErrorCode,
  KnowledgeKind,
  PersonaReferencePattern,
  PersonaRule,
  PersonaState,
  RequestKind,
  RequestLimit,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import type { PersonaQualityStorage, PersonaRecord, PersonaRequest } from "@titan/types";
import { personaEntryId, personaReference } from "./persona-lifecycle.ts";
import { personaRecord, splitReference } from "./persona-register.ts";

export async function personaVersionOffers(
  storage: PersonaQualityStorage,
  record: PersonaRecord,
): Promise<PersonaRequest[]> {
  const requests: PersonaRequest[] = [];
  const current = personaReference(record.name, record.version);
  const survived = record.survived ?? 0;
  const total = survived + (record.refuted ?? 0);
  for await (const row of storage.rows()) {
    if (
      row.kind !== KnowledgeKind.Persona ||
      !PersonaReferencePattern.test(row.title) ||
      row.id !== personaEntryId(row.title)
    )
      continue;
    const { name, version } = splitReference(row.title);
    if (name !== record.name || version >= record.version) continue;
    const { entry } = await storage.read(row.id);
    const previous = personaRecord(entry, name, version);
    const wins = previous.survived ?? 0;
    const attempts = wins + (previous.refuted ?? 0);
    if (
      record.state === PersonaState.Proven &&
      PersonaRule.Callable.some((state) => state === previous.state) &&
      total > 0 &&
      attempts > 0 &&
      survived * attempts > wins * total
    )
      requests.push({ kind: RequestKind.RetirePersona, names: [row.title] });
    if (
      record.state === PersonaState.NeedsUpdate &&
      previous.state === PersonaState.NeedsUpdate &&
      version === record.version - 1
    )
      requests.push({
        kind: RequestKind.ImprovePersona,
        names: [row.title, current],
        refutations: (previous.refuted ?? 0) + (record.refuted ?? 0),
      });
    if (requests.length >= RequestLimit.PerRun)
      throw new TitanError(ErrorCode.Capacity, KnowledgeMessage.Capacity);
  }
  return requests.sort((left, right) =>
    left.names
      .join(PersonaRule.TagSeparator)
      .localeCompare(right.names.join(PersonaRule.TagSeparator)),
  );
}
