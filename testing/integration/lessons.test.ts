import { unit } from "@titan/test-factories";
import { lessonFromRefutationCases } from "../cases/lessons.ts";
import { lessonFromRefutation } from "../factories/lessons.ts";

unit(lessonFromRefutation, lessonFromRefutationCases);
