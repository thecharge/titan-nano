import { stat } from "node:fs/promises";
import {
  type KnowledgeDates,
  KnowledgeDatesSchema,
  type KnowledgeKindStats,
  KnowledgeKindStatsSchema,
  type KnowledgeRows,
} from "@titan/types";
import { knowledgePath } from "./files.ts";

function record(dates: KnowledgeDates, id: string, updated: Date): void {
  if (!dates.oldest || updated < new Date(dates.oldest.updated))
    dates.oldest = { id, updated: updated.toISOString() };
  if (!dates.newest || updated > new Date(dates.newest.updated))
    dates.newest = { id, updated: updated.toISOString() };
}

export async function knowledgeDates(
  root: string,
  rows: KnowledgeRows,
  kinds: KnowledgeKindStats[],
) {
  const dates = KnowledgeDatesSchema.parse({});
  kinds = kinds.map((kind) =>
    KnowledgeKindStatsSchema.parse({ ...kind, oldest: null, newest: null }),
  );
  for await (const row of rows) {
    const updated = (await stat(knowledgePath(root, row.kind, row.id))).mtime;
    record(dates, row.id, updated);
    const kind = kinds.find((entry) => entry.kind === row.kind);
    if (kind) record(kind, row.id, updated);
  }
  return { ...dates, kinds };
}
