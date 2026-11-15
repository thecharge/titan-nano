import { unit } from "@titan/test-factories";
import { outputOperation } from "../../apps/cli/src/output.ts";
import {
  cliOutputContractCases,
  cliOutputFailureCases,
  cliOutputOperationCases,
  cliOutputRendererCases,
} from "../cases/cli-output-contract.ts";
import {
  cliOutputContract,
  cliOutputFailure,
  cliOutputRenderer,
} from "../factories/cli-output-contract.ts";

unit(cliOutputRenderer, cliOutputRendererCases);
unit(outputOperation, cliOutputOperationCases);
unit(cliOutputContract, cliOutputContractCases);
unit(cliOutputFailure, cliOutputFailureCases);
