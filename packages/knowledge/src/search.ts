import { KnowledgeLimit } from "@titan/constants";
import { jsonByteLength } from "@titan/streams";
import {
  KnowledgeDraftSchema,
  type KnowledgeMatch,
  type KnowledgeVectorScores,
} from "@titan/types";
import { knowledgePath } from "./files.ts";

export function limitSearchRows<T>(rows: readonly T[], limit: number) {
  const results: T[] = [];
  let bytes = 2;
  for (const row of rows) {
    if (results.length === limit) return { results, truncated: true };
    bytes += jsonByteLength(row, KnowledgeLimit.PageBytes) + Number(results.length > 0);
    if (bytes > KnowledgeLimit.PageBytes) return { results, truncated: true };
    results.push(row);
  }
  return { results, truncated: false };
}

export function searchResults(
  root: string,
  rows: readonly KnowledgeMatch[],
  scores: KnowledgeVectorScores = new Map(),
) {
  const results = [];
  let bytes = 0;
  let truncated = false;
  for (const row of rows) {
    const result = {
      id: row.id,
      kind: row.kind,
      title: row.title,
      version: row.version,
      tags: KnowledgeDraftSchema.shape.tags.parse(JSON.parse(row.tags)),
      path: knowledgePath(root, row.kind, row.id),
      matched: row.matched,
      score: scores.get(row.id) ?? null,
    };
    bytes += jsonByteLength(result, KnowledgeLimit.PageBytes);
    if (bytes > KnowledgeLimit.PageBytes) {
      truncated = true;
      break;
    }
    results.push(result);
  }
  return { results, truncated };
}
