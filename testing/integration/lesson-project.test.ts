import { unit } from "@titan/test-factories";
import { runSavesLessonCases } from "../cases/lesson-project.ts";
import { runSavesLesson } from "../factories/lesson-project.ts";

unit(runSavesLesson, runSavesLessonCases);
