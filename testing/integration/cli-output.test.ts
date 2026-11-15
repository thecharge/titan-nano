import { unit } from "@titan/test-factories";
import {
  cliEnvelopeProcessCases,
  cliEnvelopeQueryCases,
  cliOutputObservationCases,
  cliOutputObservationProcessCases,
} from "../cases/cli-output.ts";
import { cliEnvelopeProcess, cliEnvelopeQuery } from "../factories/cli-output.ts";
import {
  cliOutputObservation,
  cliOutputObservationProcess,
} from "../factories/cli-output-observation.ts";

unit(cliEnvelopeProcess, cliEnvelopeProcessCases);
unit(cliEnvelopeQuery, cliEnvelopeQueryCases);
unit(cliOutputObservation, cliOutputObservationCases);
unit(cliOutputObservationProcess, cliOutputObservationProcessCases);
