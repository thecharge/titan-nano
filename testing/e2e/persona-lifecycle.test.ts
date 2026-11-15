import { unit } from "@titan/test-factories";
import {
  personaLaterCheckCases,
  personaProductionHistoryCases,
  personaProductionLifecycleCases,
} from "../cases/persona-quality.ts";
import {
  personaLaterCheck,
  personaLifecycleProcess,
  personaProductionHistory,
} from "../factories/persona-quality.ts";

unit(personaLifecycleProcess, personaProductionLifecycleCases);
unit(personaProductionHistory, personaProductionHistoryCases);
unit(personaLaterCheck, personaLaterCheckCases);
