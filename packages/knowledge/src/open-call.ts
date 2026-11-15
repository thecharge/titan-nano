import { randomInt } from "node:crypto";
import {
  KnowledgeKind,
  PersonaPickRun,
  PersonaReferencePattern,
  PersonaRule,
  PersonaState,
} from "@titan/constants";
import type {
  KnowledgeReader,
  KnowledgeRow,
  OpenCallPick,
  OpenCallResolver,
  PersonaRegisterEntry,
  Random,
} from "@titan/types";
import { personaEntryId, personaReference } from "./persona-lifecycle.ts";
import { pickPersona, seededRandom } from "./persona-pick.ts";
import { personaRecord, splitReference } from "./persona-register.ts";

const callable: readonly string[] = PersonaRule.Callable;

export function openCallResolver(
  register: () => Promise<readonly PersonaRegisterEntry[]>,
  random: Random,
  seed?: number,
): OpenCallResolver {
  return async (tags, excluded = []): Promise<OpenCallPick | null> => {
    const fits = (await register())
      .filter(
        (entry) =>
          callable.includes(entry.state) &&
          !excluded.includes(personaReference(entry.name, entry.version)) &&
          tags.every((tag) => entry.persona.tags.includes(tag)),
      )
      .sort((left, right) =>
        personaReference(left.name, left.version).localeCompare(
          personaReference(right.name, right.version),
        ),
      );
    const entry = fits[pickPersona(random, fits)];
    return entry
      ? {
          entry,
          rule: PersonaRule.PickRule,
          ...(seed === undefined
            ? {}
            : {
                seed,
                eligible: fits.map((candidate) =>
                  personaReference(candidate.name, candidate.version),
                ),
              }),
        }
      : null;
  };
}

export async function registeredOpenCall(
  read: KnowledgeReader,
  rows: AsyncIterable<KnowledgeRow>,
  tags: readonly string[],
  excluded: readonly string[] = [],
): Promise<OpenCallPick | null> {
  const entries: PersonaRegisterEntry[] = [];
  for await (const row of rows) {
    if (
      row.kind !== KnowledgeKind.Persona ||
      !PersonaReferencePattern.test(row.title) ||
      row.id !== personaEntryId(row.title)
    )
      continue;
    const { entry } = await read(row.id);
    const { name, version } = splitReference(row.title);
    const record = personaRecord(entry, name, version);
    entries.push({
      name: record.name,
      version: record.version,
      state: record.state ?? PersonaState.Proposed,
      survived: record.sampling?.survived ?? record.survived ?? 0,
      refuted: record.sampling?.refuted ?? record.refuted ?? 0,
      persona: record.persona,
    });
  }
  const seed = randomInt(PersonaPickRun.Range);
  return openCallResolver(async () => entries, seededRandom(seed), seed)(tags, excluded);
}
