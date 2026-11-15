import { unit } from "@titan/test-factories";
import {
  lintCycleCases,
  lintOwnershipCases,
  lintPolicyCandidateCases,
  lintPolicyFileCases,
  lintPromiseCases,
} from "../cases/lint-policy.ts";
import { lintPolicyCandidate, lintPolicyFile, lintSource } from "../factories/lint-policy.ts";

unit(lintPolicyCandidate, lintPolicyCandidateCases);
unit(lintPolicyFile, lintPolicyFileCases);
unit(lintSource, lintOwnershipCases);
unit(lintSource, lintPromiseCases);
unit(lintSource, lintCycleCases);
