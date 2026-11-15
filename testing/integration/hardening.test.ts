import { unit } from "@titan/test-factories";
import {
  boardAvailabilityCases,
  clientAvailabilityCases,
  engineInterruptionCases,
  gitOutputCases,
  residentRunCases,
  serverProtocolCases,
  workspaceSafetyCases,
  writeProgressCases,
} from "../cases/hardening.ts";
import {
  boardAvailability,
  clientAvailability,
  engineInterruption,
  gitOutput,
  residentRuns,
  serverProtocol,
  workspaceSafety,
  writeProgress,
} from "../factories/hardening.ts";

unit(writeProgress, writeProgressCases);
unit(clientAvailability, clientAvailabilityCases);
unit(workspaceSafety, workspaceSafetyCases);
unit(gitOutput, gitOutputCases);
unit(boardAvailability, boardAvailabilityCases);
unit(engineInterruption, engineInterruptionCases);
unit(serverProtocol, serverProtocolCases);

unit(residentRuns, residentRunCases);
