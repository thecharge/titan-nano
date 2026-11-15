import { unit } from "@titan/test-factories";
import {
  personaPrivateVisibilityCases,
  personaSearchCases,
  personaVisibilityCases,
  personaVisibilityCliCases,
} from "../cases/persona-search.ts";
import {
  personaPrivateVisibility,
  personaSearch,
  personaVisibility,
  personaVisibilityCli,
} from "../factories/persona-search.ts";

unit(personaSearch, personaSearchCases);
unit(personaPrivateVisibility, personaPrivateVisibilityCases);
unit(personaVisibility, personaVisibilityCases);
unit(personaVisibilityCli, personaVisibilityCliCases);
