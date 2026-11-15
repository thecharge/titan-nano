import { unit } from "@titan/test-factories";
import { installChecksCases } from "../cases/skills.ts";
import { installChecks } from "../factories/skills.ts";

unit(installChecks, installChecksCases);
