import { unit } from "@titan/test-factories";
import { sourceStabilityCases } from "../cases/source-stability.ts";
import { sourceStability } from "../factories/source-stability.ts";

unit(sourceStability, sourceStabilityCases);
