import { unit } from "@titan/test-factories";
import {
  validPackageTypeScriptPolicy,
  validRootTypeScriptPolicy,
} from "../../tooling/scripts/check-typescript-policy.ts";
import {
  packageTypeScriptPolicyCases,
  rootTypeScriptPolicyCases,
} from "../cases/typescript-policy.ts";

unit(validRootTypeScriptPolicy, rootTypeScriptPolicyCases);
unit(validPackageTypeScriptPolicy, packageTypeScriptPolicyCases);
