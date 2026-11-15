import { unit } from "@titan/test-factories";
import { hookScope, parseHookChanges } from "../../tooling/scripts/hook-scope.ts";
import { documentationScopeCases, hookChangeParsingCases } from "../cases/hook-documentation.ts";

unit(parseHookChanges, hookChangeParsingCases);
unit(hookScope, documentationScopeCases);
