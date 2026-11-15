import { unit } from "@titan/test-factories";
import { hookManifestContractCases, requestTurnContractCases } from "../cases/contract-shapes.ts";
import { hookManifestContract, requestTurnContract } from "../factories/contract-shapes.ts";

unit(hookManifestContract, hookManifestContractCases);
unit(requestTurnContract, requestTurnContractCases);
