import { unit } from "@titan/test-factories";
import { programFileCases } from "../cases/programs.ts";
import { programFile } from "../factories/programs.ts";

unit(programFile, programFileCases);
