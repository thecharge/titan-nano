import { KnowledgeKind, KnowledgeScope, Lesson } from "@titan/constants";
import { type KnowledgeClient, type LessonKeeper, LessonRecordSchema } from "@titan/types";
import { KnowledgeHub } from "./hub.ts";
import { registerPersonas } from "./persona-registration.ts";
import { projectHubHome, type ScopedKnowledgeHub } from "./scoped.ts";

export function scopedLessonKeeper(
  project: string,
  home: string,
  hubs: ScopedKnowledgeHub,
  scope: KnowledgeScope = KnowledgeScope.Project,
): LessonKeeper {
  return lessonKeeper(
    scope === KnowledgeScope.Project ? projectHubHome(project) : home,
    hubs.hub(scope),
  );
}

export function lessonKeeper(home: string, hub: KnowledgeHub | KnowledgeClient): LessonKeeper {
  return async (save) => {
    for (const lesson of save.lessons)
      await hub.add({
        kind: KnowledgeKind.Lesson,
        title: lesson.text.slice(0, Lesson.TitleLimit),
        body: JSON.stringify(
          LessonRecordSchema.parse({ ...lesson, run_id: save.run_id, kept_at: Date.now() }),
        ),
        tags: [lesson.persona, lesson.step],
      });
    if (hub instanceof KnowledgeHub) await hub.registerPersonas(save.workflow);
    else await registerPersonas(home, save.workflow);
  };
}
