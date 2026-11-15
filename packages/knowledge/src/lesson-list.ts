import { KnowledgeKind, KnowledgeLimit, KnowledgeSearchMode, TextSymbol } from "@titan/constants";
import { all } from "@titan/core";
import { type KnowledgeClient, type LessonRecord, LessonRecordSchema } from "@titan/types";

function recordOf(body: string): LessonRecord[] {
  try {
    const parsed = LessonRecordSchema.safeParse(JSON.parse(body));
    return parsed.success ? [parsed.data] : [];
  } catch {
    return [];
  }
}

export async function listLessons(
  source: KnowledgeClient,
  words: readonly string[],
): Promise<LessonRecord[]> {
  const page = await source.search({
    question: words.join(TextSymbol.Space),
    kind: KnowledgeKind.Lesson,
    mode: KnowledgeSearchMode.Words,
    limit: KnowledgeLimit.MaximumPage,
  });
  const entries = await all(page.results.map((result) => () => source.get(result.id)));
  return entries
    .flatMap((entry) => recordOf(entry.entry.body))
    .sort((left, right) => right.kept_at - left.kept_at);
}
