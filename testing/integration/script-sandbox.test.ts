import { unit } from "@titan/test-factories";
import {
  scriptBoundaryCases,
  scriptLifetimeCases,
  scriptPolicyCases,
} from "../cases/script-sandbox.ts";
import { scriptBoundary, scriptLifetime, scriptPolicy } from "../factories/script-sandbox.ts";

unit(scriptBoundary, scriptBoundaryCases);
unit(scriptPolicy, scriptPolicyCases);

unit(scriptLifetime, scriptLifetimeCases);
