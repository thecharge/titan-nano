import { unit } from "@titan/test-factories";
import { personaMergeProcessCases } from "../cases/persona-merge.ts";
import { personaOffersCases } from "../cases/persona-offers.ts";
import { personaMergeProcess } from "../factories/persona-merge.ts";
import { personaOffers } from "../factories/persona-offers.ts";

unit(personaOffers, personaOffersCases);
unit(personaMergeProcess, personaMergeProcessCases);
