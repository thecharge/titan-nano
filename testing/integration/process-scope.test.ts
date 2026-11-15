import { unit } from "@titan/test-factories";
import { processScopeCases } from "../cases/process-scope.ts";
import { processScope } from "../factories/process-scope.ts";

unit(processScope, processScopeCases);
