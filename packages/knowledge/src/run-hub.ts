import { join } from "node:path";
import {
  ErrorCode,
  KnowledgeKind,
  KnowledgePattern,
  KnowledgeScope,
  KnowledgeSearchMode,
  Lesson,
  RunHubKinds,
  RunHubLimit,
  RunHubOutcome,
  RunJournal,
} from "@titan/constants";
import { uuidFromText } from "@titan/core";
import { TitanError } from "@titan/errors";
import { RunHubMessage } from "@titan/messages";
import {
  type KnowledgeClient,
  LessonRecordSchema,
  type RunHub,
  type RunHubEntry,
  RunHubEntrySchema,
  type RunHubLesson,
  type RunJournal as RunJournalRecord,
  RunJournalSchema,
} from "@titan/types";
import { projectHubPath, type ScopedKnowledgeHub } from "./scoped.ts";

function goalTerms(goal: string): string[] {
  const words = (goal.match(KnowledgePattern.Words) ?? [])
    .map((word) => word.toLowerCase())
    .filter((word) => word.length >= RunHubLimit.MinimumTerm);
  return [...new Set(words)].slice(0, RunHubLimit.Terms);
}

function lessonText(lesson: RunHubLesson): string {
  return lesson.outcome === RunHubOutcome.Passed
    ? RunHubMessage.Passed(lesson.step_id, lesson.persona, lesson.attempt)
    : RunHubMessage.Refuted(lesson.step_id, lesson.persona, lesson.evidence);
}

async function saveJournal(hub: KnowledgeClient, journal: RunJournalRecord) {
  const id = uuidFromText(JSON.stringify([RunJournal.Id, journal.run_id]));
  const entry = {
    kind: KnowledgeKind.Lesson,
    title: RunHubMessage.JournalTitle(journal.run_id, journal.state),
    body: JSON.stringify(journal),
    tags: [RunJournal.Tag],
  };
  const previous = await hub.get(id).catch((error: unknown) => {
    if (error instanceof TitanError && error.code === ErrorCode.KnowledgeMissing) return null;
    throw error;
  });
  if (!previous) return hub.add({ id, ...entry });
  const saved = previous.entry;
  const parsed = RunJournalSchema.safeParse(JSON.parse(saved.body));
  if (
    saved.kind !== KnowledgeKind.Lesson ||
    !saved.tags.includes(RunJournal.Tag) ||
    !parsed.success ||
    parsed.data.run_id !== journal.run_id
  )
    throw new TitanError(ErrorCode.KnowledgeConflict, RunHubMessage.JournalConflict);
  if (saved.body === entry.body && saved.title === entry.title) return previous;
  return hub.update({ id, version: saved.version, entry: { ...entry, tags: saved.tags } });
}

export function scopedRunHub(
  hubs: ScopedKnowledgeHub,
  offered: readonly string[],
  scope: KnowledgeScope = KnowledgeScope.Project,
): RunHub {
  return {
    tools: () => offered,
    read: async (goal) => {
      const entries = new Map<string, RunHubEntry>();
      const hits = new Map<string, number>();
      for (const kind of RunHubKinds)
        for (const term of goalTerms(goal)) {
          const page = await hubs.search({
            question: term,
            kind,
            mode: KnowledgeSearchMode.Words,
            limit: RunHubLimit.Page,
          });
          for (const row of page.results) {
            hits.set(row.id, (hits.get(row.id) ?? 0) + 1);
            if (!entries.has(row.id))
              entries.set(
                row.id,
                RunHubEntrySchema.parse({
                  id: row.id,
                  kind: row.kind,
                  title: row.title,
                  scope: row.scope,
                }),
              );
          }
        }
      return [...entries.values()]
        .sort((a, b) => (hits.get(b.id) ?? 0) - (hits.get(a.id) ?? 0))
        .slice(0, RunHubLimit.Matches);
    },
    journal: async (journal) => {
      try {
        const saved = await saveJournal(hubs.hub(KnowledgeScope.Project), journal);
        return RunHubEntrySchema.parse({
          id: saved.entry.id,
          kind: saved.entry.kind,
          title: saved.entry.title,
          scope: KnowledgeScope.Project,
        });
      } catch {
        throw new TitanError(
          ErrorCode.KnowledgeUnavailable,
          RunHubMessage.JournalUnwritable(
            join(projectHubPath(journal.project), KnowledgeKind.Lesson),
          ),
        );
      }
    },
    keep: async (lesson) => {
      const text = lessonText(lesson);
      const saved = await hubs.hub(scope).add({
        kind: KnowledgeKind.Lesson,
        title: text.slice(0, Lesson.TitleLimit),
        body: JSON.stringify(
          LessonRecordSchema.parse({
            persona: lesson.persona,
            step: lesson.step_id,
            text,
            run_id: lesson.run_id,
            kept_at: Date.now(),
          }),
        ),
        tags: [lesson.persona, lesson.step_id, lesson.outcome],
      });
      return RunHubEntrySchema.parse({
        id: saved.entry.id,
        kind: saved.entry.kind,
        title: saved.entry.title,
        scope,
      });
    },
  };
}
