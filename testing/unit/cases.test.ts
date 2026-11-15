import { unit } from "@titan/test-factories";
import { suiteValidationCases } from "../cases/config.ts";
import { acceptsCaseCounts } from "../factories/cases.ts";

unit(acceptsCaseCounts, suiteValidationCases);
