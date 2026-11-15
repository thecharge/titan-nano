import { unit } from "@titan/test-factories";
import {
  nativeBindingContractCases,
  nativeBindingEnvironmentCases,
  nativeEnvironmentBudgetCases,
} from "../cases/native-binding-contract.ts";
import {
  nativeBindingContract,
  nativeBindingEnvironment,
  nativeEnvironmentBudget,
} from "../factories/native-binding-contract.ts";

unit(nativeBindingContract, nativeBindingContractCases);
unit(nativeBindingEnvironment, nativeBindingEnvironmentCases);
unit(nativeEnvironmentBudget, nativeEnvironmentBudgetCases);
