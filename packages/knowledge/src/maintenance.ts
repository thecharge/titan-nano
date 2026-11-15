import { lstat } from "node:fs/promises";
import {
  ErrorCode,
  KnowledgeKind,
  KnowledgeLimit,
  KnowledgeMaintenance,
  KnowledgeMaintenanceReason,
  TextSymbol,
} from "@titan/constants";
import { hash } from "@titan/core";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import { jsonByteLength } from "@titan/streams";
import {
  type KnowledgeConsolidation,
  type KnowledgeMaintenanceQuery,
  type KnowledgeMaintenanceResult,
  KnowledgeMaintenanceResultSchema,
  type KnowledgeMetadata,
  KnowledgeMetadataSchema,
  type KnowledgePruneCandidate,
  type KnowledgeReader,
  type KnowledgeRows,
} from "@titan/types";
import { archivedKnowledge } from "./archived.ts";
import { knowledgePath } from "./files.ts";

export async function maintenancePlan(
  root: string,
  rows: KnowledgeRows,
  read: KnowledgeReader,
  neverRead: (id: string) => Promise<boolean>,
  query: KnowledgeMaintenanceQuery,
): Promise<KnowledgeMaintenanceResult> {
  const before =
    query.before ?? new Date(Date.now() - KnowledgeMaintenance.OldMilliseconds).toISOString();
  const candidates: KnowledgePruneCandidate[] = [];
  const duplicates = new Map<string, KnowledgeMetadata[]>();
  for await (const row of rows) {
    if (row.kind === KnowledgeKind.Persona) continue;
    const { entry } = await read(row.id);
    const metadata = KnowledgeMetadataSchema.strip().parse(entry);
    const identity = hash(JSON.stringify([entry.kind, entry.body]));
    const group = duplicates.get(identity) ?? [];
    group.push(metadata);
    duplicates.set(identity, group);
    const kept = group[0];
    const old =
      (await lstat(knowledgePath(root, entry.kind, entry.id))).mtimeMs < Date.parse(before);
    if (group.length > 1 && kept) {
      candidates.push({
        ...metadata,
        reason: KnowledgeMaintenanceReason.Duplicate,
        kept_id: kept.id,
        retained: false,
      });
      continue;
    }
    if (old && (await neverRead(row.id))) {
      candidates.push({
        ...metadata,
        reason: KnowledgeMaintenanceReason.Unread,
        kept_id: null,
        retained: false,
      });
      continue;
    }
    if (entry.version > 1) {
      const retained = await archivedKnowledge(root, entry.id, KnowledgeLimit.EntryBytes);
      if (!retained || retained.entry.version !== entry.version - 1)
        throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
      candidates.push({
        ...metadata,
        version: entry.version - 1,
        reason: KnowledgeMaintenanceReason.Replaced,
        kept_id: entry.id,
        retained: true,
      });
    }
  }
  const groups: KnowledgeConsolidation[] = [];
  let bytes = jsonByteLength(candidates, KnowledgeLimit.HistoryBytes);
  for (const sources of duplicates.values()) {
    if (sources.length < 2) continue;
    const first = sources[0];
    if (!first) continue;
    const { entry } = await read(first.id);
    const tags = [...new Set(sources.flatMap((source) => source.tags))];
    if (tags.length > KnowledgeLimit.Tags)
      throw new TitanError(ErrorCode.Capacity, KnowledgeMessage.Capacity);
    const body =
      entry.body +
      TextSymbol.Newline +
      TextSymbol.Newline +
      KnowledgeMaintenance.SourceHeading +
      TextSymbol.Newline +
      sources.map((source) => source.id).join(TextSymbol.Newline);
    const group = { sources, entry: { kind: entry.kind, title: entry.title, tags, body } };
    bytes += jsonByteLength(group, KnowledgeLimit.HistoryBytes);
    if (bytes > KnowledgeLimit.HistoryBytes)
      throw new TitanError(ErrorCode.Capacity, KnowledgeMessage.Capacity);
    groups.push(group);
  }
  const kept = new Set(groups.map((group) => group.sources[0]?.id));
  return KnowledgeMaintenanceResultSchema.parse({
    applied: false,
    before,
    candidates: candidates.filter(
      (candidate) =>
        candidate.reason !== KnowledgeMaintenanceReason.Unread || !kept.has(candidate.id),
    ),
    groups,
    publications: [],
  });
}
