import { PersonaPickRun } from "@titan/constants";
import { unit } from "@titan/test-factories";
import {
  personaFloorCases,
  personaFloorShareCases,
  personaSwapCases,
} from "../cases/persona-lifecycle.ts";
import { personaFloor, personaFloorShare, personaSwap } from "../factories/persona-lifecycle.ts";

unit(personaSwap, personaSwapCases, PersonaPickRun.Timeout);
unit(personaFloor, personaFloorCases, PersonaPickRun.Timeout);
unit(personaFloorShare, personaFloorShareCases);
