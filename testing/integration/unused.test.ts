import { unit } from "@titan/test-factories";
import { unusedAdmissionCases, unusedBindingsCases, unusedCheckCases } from "../cases/unused.ts";
import { unusedAdmission, unusedBindings, unusedCheck } from "../factories/unused.ts";

unit(unusedCheck, unusedCheckCases);
unit(unusedAdmission, unusedAdmissionCases);
unit(unusedBindings, unusedBindingsCases);
