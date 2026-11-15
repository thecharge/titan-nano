import { unit } from "@titan/test-factories";
import { improvedSaveCases } from "../cases/improved-file.ts";
import { improvedSave } from "../factories/improved-file.ts";

unit(improvedSave, improvedSaveCases);
