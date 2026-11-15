import { unit } from "@titan/test-factories";
import { boardIsolationCases } from "../cases/ask-answer.ts";
import { boardIsolation } from "../factories/ask-answer.ts";

unit(boardIsolation, boardIsolationCases);
