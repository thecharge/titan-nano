import { unit } from "@titan/test-factories";
import {
  personaCandidatesCases,
  personaDeleteCases,
  personaFloorCases,
  personaFloorShareCases,
  personaHistoryCases,
  personaMeasuresCases,
  personaMergeCases,
  personaProvenCases,
  personaRecordCases,
  personaSearchCases,
  personaSwapCases,
  personaTrialCases,
  personaWeakCases,
} from "../cases/persona-lifecycle.ts";
import {
  personaCandidates,
  personaDelete,
  personaFloor,
  personaFloorShare,
  personaHistory,
  personaMeasures,
  personaMerge,
  personaMove,
  personaMoveRecord,
  personaSearch,
  personaSwap,
} from "../factories/persona-lifecycle.ts";

unit(personaMove, personaProvenCases);
unit(personaMove, personaTrialCases);
unit(personaMove, personaWeakCases);
unit(personaMoveRecord, personaRecordCases);
unit(personaCandidates, personaCandidatesCases);
unit(personaSearch, personaSearchCases);
unit(personaMeasures, personaMeasuresCases);
unit(personaMerge, personaMergeCases);
unit(personaHistory, personaHistoryCases);
unit(personaDelete, personaDeleteCases);
unit(personaSwap, personaSwapCases);
unit(personaFloorShare, personaFloorShareCases);
unit(personaFloor, personaFloorCases);
