import { unit } from "@titan/test-factories";
import { scriptAnswerCases } from "../cases/script-check.ts";
import { scriptAnswer } from "../factories/script-check.ts";

unit(scriptAnswer, scriptAnswerCases);
