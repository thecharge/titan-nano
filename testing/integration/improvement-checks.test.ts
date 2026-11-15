import { unit } from "@titan/test-factories";
import {
  improverAddsScriptCases,
  improverRemovesFalsifierCases,
  newFileBetterCases,
  newFileWorseCases,
} from "../cases/improvement-checks.ts";
import {
  improverAddsScript,
  improverRemovesFalsifier,
  newFileBetter,
  newFileWorse,
} from "../factories/improvement-checks.ts";

unit(improverRemovesFalsifier, improverRemovesFalsifierCases);
unit(improverAddsScript, improverAddsScriptCases);
unit(newFileBetter, newFileBetterCases);
unit(newFileWorse, newFileWorseCases);
