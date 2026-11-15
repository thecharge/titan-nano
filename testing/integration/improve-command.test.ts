import { unit } from "@titan/test-factories";
import { improveCommandCases } from "../cases/improve-command.ts";
import { improveCommand } from "../factories/improve-command.ts";

unit(improveCommand, improveCommandCases);
