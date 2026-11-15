import { unit } from "@titan/test-factories";
import {
  approvalPolicyCases,
  approvalPolicyCliCases,
  approvalPolicyReplayCases,
} from "../cases/approval-policy.ts";
import { approvalPolicy, approvalPolicyReplay } from "../factories/approval-policy.ts";

unit(approvalPolicy, approvalPolicyCases);
unit(approvalPolicyReplay, approvalPolicyReplayCases);

unit(approvalPolicy, approvalPolicyCliCases);
