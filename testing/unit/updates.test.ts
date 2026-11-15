import { unit } from "@titan/test-factories";
import {
  releaseComparisonCases,
  releaseTagsCases,
  validUpdateSettingsCases,
} from "../cases/updates.ts";
import { releaseComparison, releaseTags, validUpdateSettings } from "../factories/updates.ts";

unit(releaseComparison, releaseComparisonCases);
unit(releaseTags, releaseTagsCases);
unit(validUpdateSettings, validUpdateSettingsCases);
