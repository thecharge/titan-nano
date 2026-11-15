import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  KnowledgeFile,
  KnowledgeKind,
  PersonaBound,
  PersonaFixture,
  PersonaPickRun,
  PersonaRule,
  PersonaSearchFixture,
  PersonaState,
} from "@titan/constants";
import { all as gather } from "@titan/core";
import {
  advancePersona,
  archivePersona,
  floorShare,
  mergeOffers,
  personaEntryId,
  personaId,
  pickCandidates,
  recordPersonaRun,
  searchPersonas,
  simulatePicks,
} from "@titan/knowledge";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type PersonaHistoryEntry,
  PersonaRunResultSchema,
  type PersonaVersion,
  type PersonaVersionEntry,
  PersonaVersionEntrySchema,
  PersonaVersionSchema,
} from "@titan/types";

function versionOf(raw: unknown): PersonaVersion {
  const [name, version, state] = PersonaVersionEntrySchema.parse(raw);
  return PersonaVersionSchema.parse({ name, version, state, survived: 0, refuted: 0, role: name });
}

function entriesOf(raw: readonly unknown[]): PersonaVersion[] {
  return raw.map(versionOf);
}

export function personaMove(
  state: PersonaState,
  survived: number,
  refuted: number,
  bound: PersonaBound,
): string {
  const advance = advancePersona(
    PersonaVersionSchema.parse({
      name: "subject",
      version: 1,
      state,
      survived,
      refuted,
      role: "subject",
    }),
  );
  const shown = bound === PersonaBound.Lower ? advance.bounds.lower : advance.bounds.upper;
  const kinds = advance.requests.map((request) => request.kind).join(",");
  return `${advance.state} ${shown.toFixed(PersonaRule.Digits)} ${advance.history.length} ${kinds}`;
}

export function personaMoveRecord(state: PersonaState, survived: number, refuted: number): string {
  const advance = advancePersona(
    PersonaVersionSchema.parse({
      name: PersonaFixture.Subject,
      version: 1,
      state,
      survived,
      refuted,
      role: PersonaFixture.Subject,
    }),
  );
  const [entry] = advance.history;
  if (!entry) return String(advance.history.length);
  return [
    entry.from,
    entry.to,
    entry.survived,
    entry.total,
    entry.lower.toFixed(PersonaRule.Digits),
    entry.upper.toFixed(PersonaRule.Digits),
    entry.bar,
    advance.requests[0]?.refutations ?? 0,
  ].join(PersonaSearchFixture.Separator);
}

export function personaHistory(
  persona: string,
  runs: readonly string[],
  candidates: number,
  survived: number,
): string {
  const entries = runs.reduce<PersonaHistoryEntry[]>(
    (history, run) =>
      recordPersonaRun(
        history,
        PersonaRunResultSchema.parse({ persona, run, candidates, survived }),
      ),
    [],
  );
  const last = entries[entries.length - 1];
  return `${entries.length} ${last?.run} survived: ${last?.survived} refuted: ${last?.refuted}`;
}

export function personaCandidates(name: string, entries: readonly PersonaVersionEntry[]): string {
  return pickCandidates(entriesOf(entries), name);
}

export function personaSearch(
  term: string,
  all: boolean,
  entries: readonly PersonaVersionEntry[],
): string {
  return searchPersonas(entriesOf(entries), term, all)
    .map((listing) => `${listing.id}:${listing.state}`)
    .join(",");
}

export function personaMeasures(
  entries: readonly (readonly [string, number, number, number, number])[],
  name: string,
  version: number,
  candidates: number,
  survived: number,
): string {
  const target = personaId(
    PersonaVersionSchema.parse({
      name,
      version,
      state: PersonaState.Trial,
      survived: 0,
      refuted: 0,
      role: name,
    }),
  );
  const run = PersonaRunResultSchema.parse({
    persona: target,
    run: target,
    candidates,
    survived,
  });
  return entries
    .map(([entryName, entryVersion]) => {
      const own = personaId(
        PersonaVersionSchema.parse({
          name: entryName,
          version: entryVersion,
          state: PersonaState.Trial,
          survived: 0,
          refuted: 0,
          role: entryName,
        }),
      );
      const [entry] = recordPersonaRun([], run).filter((recorded) => recorded.persona === own);
      const kept = entry?.survived ?? 0;
      const lost = entry?.refuted ?? 0;
      return `${entryVersion}:${kept + lost}/${kept}/${lost}`;
    })
    .join(",");
}

export function personaMerge(entries: readonly PersonaVersionEntry[], score: number): string {
  const offers = mergeOffers(entriesOf(entries), () => score);
  return `${offers.length} ${offers.map((offer) => `${offer.kind}:${offer.names.join(PersonaRule.PairSeparator)}`).join(",")}`;
}

export function personaDelete(
  name: string,
  content: string,
  other: string,
  target: string,
): Promise<string> {
  return withTemporaryDirectory(async (root) => {
    const directory = join(root, KnowledgeKind.Persona);
    await mkdir(directory, { recursive: true });
    const otherContent = content + other;
    const nameFile = personaEntryId(name) + KnowledgeFile.Yaml;
    const otherFile = personaEntryId(other) + KnowledgeFile.Yaml;
    await writeFile(join(directory, nameFile), content);
    await writeFile(join(directory, otherFile), otherContent);
    await archivePersona(root, target);
    const left = await readdir(directory);
    const history = join(root, KnowledgeFile.History);
    const kept = await gather(
      (await readdir(history)).map((file) => () => readFile(join(history, file), "utf8")),
    );
    const expected = target === name ? content : otherContent;
    return `${left.includes(nameFile)} ${left.includes(otherFile)} ${kept.length} ${kept.every((text) => text === expected)}`;
  });
}

export function personaSwap(
  rates: readonly number[],
  picks: number,
  repeats: number,
  seed: number,
  swap: boolean,
): boolean {
  return (
    simulatePicks({ rates: [...rates], picks, repeats, seed, swap }).lastShare >
    PersonaPickRun.HalfShare
  );
}

export function personaFloorShare(eligible: number): string {
  const share = floorShare(eligible);
  return [share, share * eligible]
    .map((value) => value.toFixed(PersonaRule.Digits))
    .join(PersonaSearchFixture.Separator);
}

export function personaFloor(
  rates: readonly number[],
  picks: number,
  repeats: number,
  seed: number,
): boolean {
  return (
    simulatePicks({ rates: [...rates], picks, repeats, seed, swap: false }).breachRate <
    PersonaPickRun.FloorLimit
  );
}
