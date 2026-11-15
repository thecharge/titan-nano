import { LessonListScenario } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const zone = [
  LessonListScenario.PersonaZone,
  LessonListScenario.Run,
  LessonListScenario.StepZone,
  LessonListScenario.TextZone,
].join(LessonListScenario.FieldJoin);
const rounding = [
  LessonListScenario.PersonaRound,
  LessonListScenario.RunNext,
  LessonListScenario.StepRound,
  LessonListScenario.TextRound,
].join(LessonListScenario.FieldJoin);
const newer = [
  LessonListScenario.PersonaZone,
  LessonListScenario.RunNext,
  LessonListScenario.StepZone,
  LessonListScenario.TextNewer,
].join(LessonListScenario.FieldJoin);

export const lessonsBeforeDesignCases = {
  positive: [
    positive(
      "the word time prints only the time zone lesson with its persona, run and step",
      [[LessonListScenario.Words], false, []],
      zone,
    ),
    positive(
      "no words print every lesson, newest first",
      [[], false, []],
      [rounding, zone].join(LessonListScenario.RowJoin),
    ),
    positive(
      "a newer lesson about time comes before the older one",
      [[LessonListScenario.Words], true, []],
      [newer, zone].join(LessonListScenario.RowJoin),
    ),
    positive(
      "entries of kind lesson that are not lesson records are left out",
      [
        [LessonListScenario.Words],
        false,
        [LessonListScenario.BodyBroken, LessonListScenario.BodyShape],
      ],
      zone,
    ),
  ],
  negative: [
    rejected(
      "the word round does not print the time zone lesson",
      [[LessonListScenario.Rounding], false, []],
      rounding,
    ),
    rejected(
      "words nothing contains print no lesson",
      [[LessonListScenario.Missing], false, []],
      "",
    ),
  ],
};
