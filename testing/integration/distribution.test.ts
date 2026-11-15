import { unit } from "@titan/test-factories";
import {
  distributionOutputAdmissionCases,
  distributionOutputCases,
  distributionOutputOptionsCases,
  distributionVersionCases,
} from "../cases/distribution.ts";
import {
  distributionOutput,
  distributionOutputAdmission,
  distributionOutputOptions,
  distributionVersion,
} from "../factories/distribution.ts";

unit(distributionVersion, distributionVersionCases);

unit(distributionOutput, distributionOutputCases);

unit(distributionOutputOptions, distributionOutputOptionsCases);

unit(distributionOutputAdmission, distributionOutputAdmissionCases);
