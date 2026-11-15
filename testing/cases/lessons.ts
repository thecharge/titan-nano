import { Improvement, LessonScenario } from "@titan/constants";
import { ImprovementMessage } from "@titan/messages";
import { positive, rejected } from "@titan/test-factories";

const file = `${LessonScenario.PlanName}${Improvement.VersionMarker}${Improvement.FirstVersion}${Improvement.FileExtension}`;

function row(...parts: readonly (string | number | boolean)[]): string {
  return parts.join(LessonScenario.Join);
}

const kept = row(
  file,
  LessonScenario.None,
  true,
  true,
  LessonScenario.One,
  LessonScenario.PersonasAfter,
  LessonScenario.One,
);
const savedWithoutLesson = row(
  file,
  LessonScenario.None,
  false,
  true,
  LessonScenario.Zero,
  LessonScenario.PersonasBefore,
  LessonScenario.Zero,
);
const refused = row(
  LessonScenario.None,
  ImprovementMessage.NotPassed,
  false,
  true,
  LessonScenario.Zero,
  LessonScenario.PersonasBefore,
  LessonScenario.Zero,
);

export const lessonFromRefutationCases = {
  positive: [
    positive(
      "a step refuted twice with time zone evidence gives a commented lesson, a hub entry and a new persona version",
      [true, true, false],
      kept,
    ),
    positive(
      "a lesson for a persona that is not in the workflow is dropped and the other lesson is kept",
      [true, true, true],
      kept,
    ),
  ],
  negative: [
    rejected(
      "with lessons off the new file is saved with no lesson, no hub entry and no new persona version",
      [false, true, false],
      savedWithoutLesson,
    ),
    rejected(
      "check 3 refuses the new file when its run does not pass, so no lesson is kept",
      [true, false, false],
      refused,
    ),
  ],
};
