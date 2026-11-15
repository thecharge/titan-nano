import { unit } from "@titan/test-factories";
import { packagePolicyCases } from "../cases/package-policy.ts";
import { packagePolicyTree } from "../factories/package-policy.ts";

unit(packagePolicyTree, packagePolicyCases);
