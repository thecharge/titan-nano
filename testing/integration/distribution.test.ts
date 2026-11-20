import { unit } from "@titan/test-factories";
import {
  archiveDistributionCases,
  distributionOutputAdmissionCases,
  distributionOutputCases,
  distributionOutputOptionsCases,
  distributionVersionCases,
  nativeDistributionCases,
} from "../cases/distribution.ts";
import {
  archiveDistributionProbe,
  distributionOutput,
  distributionOutputAdmission,
  distributionOutputOptions,
  distributionVersion,
  nativeDistributionProbe,
} from "../factories/distribution.ts";

unit(distributionVersion, distributionVersionCases);

unit(distributionOutput, distributionOutputCases);

unit(distributionOutputOptions, distributionOutputOptionsCases);

unit(distributionOutputAdmission, distributionOutputAdmissionCases);

unit(archiveDistributionProbe, archiveDistributionCases);

unit(nativeDistributionProbe, nativeDistributionCases);
