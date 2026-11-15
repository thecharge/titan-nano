import { unit } from "@titan/test-factories";
import { cliLiveObservationCases } from "../cases/observation.ts";
import { cliLiveObservation } from "../factories/observation.ts";

unit(cliLiveObservation, cliLiveObservationCases);
