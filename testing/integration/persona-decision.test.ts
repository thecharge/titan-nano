import { unit } from "@titan/test-factories";
import {
  personaDecisionProcessCases,
  personaDecisionRecoveryCases,
} from "../cases/persona-decision.ts";
import { personaDeletionHistoryCases } from "../cases/persona-deletion.ts";
import { personaDecisionProcess, personaDecisionRecovery } from "../factories/persona-decision.ts";
import { personaDeletionHistory } from "../factories/persona-deletion.ts";

unit(personaDecisionProcess, personaDecisionProcessCases);
unit(personaDecisionRecovery, personaDecisionRecoveryCases);
unit(personaDeletionHistory, personaDeletionHistoryCases);
