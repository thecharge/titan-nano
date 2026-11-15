import { unit } from "@titan/test-factories";
import {
  scopedScriptAdmissionCases,
  scriptProofFlowCases,
  scriptWorkerFlowCases,
  serverScriptCases,
} from "../cases/server-scripts.ts";
import {
  scopedScriptAdmission,
  scriptProofFlow,
  scriptWorkerFlow,
  serverScripts,
} from "../factories/server-scripts.ts";

unit(serverScripts, serverScriptCases);
unit(scopedScriptAdmission, scopedScriptAdmissionCases);
unit(scriptWorkerFlow, scriptWorkerFlowCases);

unit(scriptProofFlow, scriptProofFlowCases);
