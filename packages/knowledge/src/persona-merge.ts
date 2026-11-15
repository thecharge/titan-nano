import {
  ErrorCode,
  KnowledgeKind,
  KnowledgeLimit,
  PersonaReferencePattern,
  PersonaRule,
  PersonaState,
  StoreEviction,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import { BoundedStore } from "@titan/store";
import {
  type Embedder,
  type KnowledgeReader,
  type KnowledgeRows,
  KnowledgeVectorSchema,
  type PersonaVersion,
} from "@titan/types";
import { mergeOffers, personaEntryId } from "./persona-lifecycle.ts";
import { personaRecord, splitReference } from "./persona-register.ts";

function similarity(left: readonly number[], right: readonly number[]): number {
  if (left.length !== right.length)
    throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
  const leftNorm = Math.hypot(...left);
  const rightNorm = Math.hypot(...right);
  if (!Number.isFinite(leftNorm) || !Number.isFinite(rightNorm) || !leftNorm || !rightNorm)
    throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
  return left.reduce(
    (sum, value, index) => sum + (value / leftNorm) * ((right[index] ?? 0) / rightNorm),
    0,
  );
}

export async function personaMergeOffers(
  read: KnowledgeReader,
  rows: KnowledgeRows,
  embedder: Embedder,
) {
  const versions: PersonaVersion[] = [];
  const vectors = new BoundedStore<string, number[]>({
    maxEntries: KnowledgeLimit.Entries,
    eviction: StoreEviction.Reject,
  });
  for await (const row of rows) {
    if (
      row.kind !== KnowledgeKind.Persona ||
      !PersonaReferencePattern.test(row.title) ||
      row.id !== personaEntryId(row.title)
    )
      continue;
    const { name, version } = splitReference(row.title);
    const { entry } = await read(row.id);
    const record = personaRecord(entry, name, version);
    const state = record.state ?? PersonaState.Proposed;
    if (!PersonaRule.Mergeable.some((eligible) => eligible === state)) continue;
    const role = record.persona.role;
    if (!vectors.has(role))
      vectors.set(role, KnowledgeVectorSchema.parse(await embedder.embed(role)));
    versions.push({
      name,
      version,
      state,
      role,
      survived: record.survived ?? 0,
      refuted: record.refuted ?? 0,
    });
  }
  versions.sort(
    (left, right) => left.name.localeCompare(right.name) || left.version - right.version,
  );
  return mergeOffers(versions, (left, right) =>
    similarity(vectors.get(left) ?? [], vectors.get(right) ?? []),
  );
}
