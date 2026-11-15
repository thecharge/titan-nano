import { unit } from "@titan/test-factories";
import {
  catalogContractCases,
  cliBackendCases,
  cliObservationCases,
  invocationCases,
} from "../cases/cli.ts";
import {
  catalogContract,
  checkedInvocation,
  cliBackend,
  cliObservation,
} from "../factories/cli.ts";

unit(checkedInvocation, invocationCases);

unit(catalogContract, catalogContractCases);

unit(cliBackend, cliBackendCases);
unit(cliObservation, cliObservationCases);
