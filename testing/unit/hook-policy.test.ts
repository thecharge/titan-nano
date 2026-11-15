import { unit } from "@titan/test-factories";
import { validHookPolicy } from "../../tooling/scripts/hook-policy.ts";
import { hookPolicyCases } from "../cases/hook-policy.ts";

unit(validHookPolicy, hookPolicyCases);
