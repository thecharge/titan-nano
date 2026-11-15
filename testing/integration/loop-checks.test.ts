import { unit } from "@titan/test-factories";
import {
  checksNeedScriptCases,
  failingCheckCases,
  neverPassingCheckCases,
} from "../cases/loop-checks.ts";
import { checksNeedScripts, loopChecks } from "../factories/loop-checks.ts";

unit(loopChecks, failingCheckCases);

unit(loopChecks, neverPassingCheckCases);

unit(checksNeedScripts, checksNeedScriptCases);
