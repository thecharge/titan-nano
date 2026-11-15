import { mkdir, readFile, rename } from "node:fs/promises";
import { join } from "node:path";
import {
  ErrorCode,
  FileEncoding,
  KnowledgeFile,
  KnowledgeKind,
  PersonaRule,
  PersonaState,
  RequestKind,
  RequestLimit,
  ServerLimit,
} from "@titan/constants";
import { hash, uuidFromText } from "@titan/core";
import { TitanError } from "@titan/errors";
import { archivedPersonaName, KnowledgeMessage } from "@titan/messages";
import {
  type KnowledgeEntry,
  type PersonaAdvance,
  type PersonaHistory,
  type PersonaHistoryEntry,
  PersonaHistorySchema,
  type PersonaListing,
  type PersonaRequest,
  type PersonaRunResult,
  type PersonaUsage,
  type PersonaVersion,
  type WilsonBounds,
} from "@titan/types";
import { knowledgePath } from "./files.ts";

export function emptyPersonaUsage(history_complete: boolean): PersonaUsage {
  return {
    history_complete,
    reports: [],
    executions: 0,
    reported_executions: 0,
    unreported_executions: 0,
    known: { input_tokens: 0, output_tokens: 0, cost_usd: 0 },
    complete: {
      input_tokens: history_complete,
      output_tokens: history_complete,
      cost_usd: history_complete,
    },
  };
}

export function personaReference(name: string, version: number): string {
  return name + PersonaRule.VersionMark + version;
}

export function personaEntryId(reference: string): string {
  return uuidFromText(reference);
}

export function personaId(version: PersonaVersion): string {
  return personaReference(version.name, version.version);
}

export function wilson(survived: number, total: number): WilsonBounds {
  if (total === 0) return { lower: 0, upper: 1 };
  const rate = survived / total;
  const squared = PersonaRule.Z * PersonaRule.Z;
  const scale = 1 + squared / total;
  const center = (rate + squared / (2 * total)) / scale;
  const spread =
    (PersonaRule.Z * Math.sqrt((rate * (1 - rate)) / total + squared / (4 * total * total))) /
    scale;
  return { lower: Math.max(0, center - spread), upper: Math.min(1, center + spread) };
}

function nextState(state: PersonaState, bounds: WilsonBounds): PersonaState {
  if (!PersonaRule.Moving.some((moving) => moving === state)) return state;
  if (bounds.upper < PersonaRule.Bar) return PersonaState.NeedsUpdate;
  if (state === PersonaState.Trial && bounds.lower > PersonaRule.Bar) return PersonaState.Proven;
  return state;
}

export function advancePersona(version: PersonaVersion): PersonaAdvance {
  const total = version.survived + version.refuted;
  const bounds = wilson(version.survived, total);
  const state = nextState(version.state, bounds);
  if (state === version.state) return { state, bounds, history: [], requests: [] };
  const requests: PersonaRequest[] =
    state === PersonaState.NeedsUpdate
      ? [
          {
            kind: RequestKind.ImprovePersona,
            names: [personaId(version)],
            refutations: version.refuted,
          },
        ]
      : [];
  return {
    state,
    bounds,
    history: [
      {
        persona: personaId(version),
        from: version.state,
        to: state,
        survived: version.survived,
        total,
        lower: bounds.lower,
        upper: bounds.upper,
        bar: PersonaRule.Bar,
      },
    ],
    requests,
  };
}

export function pickCandidates(versions: readonly PersonaVersion[], name: string): string {
  const ids = versions
    .filter(
      (version) =>
        version.name === name && !PersonaRule.Ineligible.some((state) => state === version.state),
    )
    .sort((left, right) => left.version - right.version)
    .map(personaId);
  return PersonaRule.CandidatesLabel + ids.join(PersonaRule.ListSeparator);
}

export function searchPersonas(
  versions: readonly PersonaVersion[],
  term: string,
  all: boolean,
): PersonaListing[] {
  return versions
    .filter(
      (version) =>
        version.name.includes(term) &&
        (all || !PersonaRule.Hidden.some((state) => state === version.state)),
    )
    .sort((left, right) => left.version - right.version)
    .map((version) => ({ id: personaId(version), state: version.state }));
}

export function personaHistory(body: string): PersonaHistory {
  try {
    return PersonaHistorySchema.parse(Bun.YAML.parse(body));
  } catch {
    return PersonaHistorySchema.parse({});
  }
}

export function hiddenPersona(entry: KnowledgeEntry): boolean {
  return (
    entry.kind === KnowledgeKind.Persona &&
    PersonaRule.Hidden.some((state) => state === personaHistory(entry.body).state)
  );
}

export function recordPersonaRun(
  history: readonly PersonaHistoryEntry[],
  result: PersonaRunResult,
): PersonaHistoryEntry[] {
  if (history.some((entry) => entry.persona === result.persona && entry.run === result.run))
    return [...history];
  const survived = Math.min(result.survived, result.candidates);
  return [
    ...history,
    {
      persona: result.persona,
      run: result.run,
      survived,
      refuted: result.candidates - survived,
    },
  ];
}

export function mergeOffers(
  versions: readonly PersonaVersion[],
  score: (left: string, right: string) => number,
  maximum = RequestLimit.PerRun,
): PersonaRequest[] {
  const live = versions.filter((version) =>
    PersonaRule.Mergeable.some((state) => state === version.state),
  );
  const offers: PersonaRequest[] = [];
  live.forEach((left, index) => {
    for (const right of live.slice(index + 1)) {
      if (left.name !== right.name && score(left.role, right.role) >= PersonaRule.MergeScore) {
        if (offers.length >= maximum)
          throw new TitanError(ErrorCode.Capacity, KnowledgeMessage.Capacity);
        offers.push({
          kind: RequestKind.MergePersonas,
          names: [personaId(left), personaId(right)],
        });
      }
    }
  });
  return offers;
}

export async function archivePersona(root: string, name: string): Promise<string> {
  const source = knowledgePath(root, KnowledgeKind.Persona, personaEntryId(name));
  const content = await readFile(source, FileEncoding.Utf8);
  const history = join(root, KnowledgeFile.History);
  await mkdir(history, { recursive: true, mode: ServerLimit.DirectoryMode });
  const target = join(history, archivedPersonaName(name, hash(content), KnowledgeFile.Yaml));
  await rename(source, target);
  return target;
}
