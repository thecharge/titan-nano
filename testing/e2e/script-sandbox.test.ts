import { unit } from "@titan/test-factories";
import { scriptReadClaimCases, scriptScopeProcessCases } from "../cases/script-sandbox.ts";
import { scriptReadClaim, scriptScopeProcess } from "../factories/script-sandbox.ts";

unit(scriptScopeProcess, scriptScopeProcessCases);

unit(scriptReadClaim, scriptReadClaimCases);
