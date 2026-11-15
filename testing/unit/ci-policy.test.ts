import { unit } from "@titan/test-factories";
import { validCiPolicy } from "../../tooling/scripts/hook-policy.ts";
import { ciPolicyCases } from "../cases/ci-policy.ts";

unit(validCiPolicy, ciPolicyCases);
