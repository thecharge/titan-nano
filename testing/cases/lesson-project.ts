import { KnowledgeScope, LessonScenario } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

function row(project: number, home: number): string {
  return [project, home].join(LessonScenario.Join);
}

export const runSavesLessonCases = {
  positive: [
    positive(
      "a run that keeps a lesson writes it in the project hub and not in the home hub by default",
      [KnowledgeScope.Project, true, true],
      row(LessonScenario.One, LessonScenario.Zero),
    ),
    positive(
      "choosing the home hub writes the lesson in the home hub and not in the project hub",
      [KnowledgeScope.Home, true, true],
      row(LessonScenario.Zero, LessonScenario.One),
    ),
  ],
  negative: [
    rejected(
      "with lessons off no lesson file is written in either hub",
      [KnowledgeScope.Project, false, true],
      row(LessonScenario.Zero, LessonScenario.Zero),
    ),
    rejected(
      "when the new file does not pass its check no lesson file is written in either hub",
      [KnowledgeScope.Project, true, false],
      row(LessonScenario.Zero, LessonScenario.Zero),
    ),
  ],
};
