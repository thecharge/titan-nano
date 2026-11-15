import { unit } from "@titan/test-factories";
import { documentationGateCases, hookTreeScopeCases } from "../cases/hook-documentation.ts";
import { documentationGate, hookTreeScope } from "../factories/hook-documentation.ts";

unit(documentationGate, documentationGateCases);
unit(hookTreeScope, hookTreeScopeCases);
