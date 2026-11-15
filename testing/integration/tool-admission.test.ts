import { unit } from "@titan/test-factories";
import {
  cliFallbackToolAdmissionCases,
  mcpToolAdmissionCases,
  planToolAdmissionCases,
  toolAdmissionCases,
} from "../cases/tool-admission.ts";
import {
  cliFallbackToolAdmission,
  cliToolAdmission,
  engineToolAdmission,
  httpToolAdmission,
  mcpToolAdmission,
  planToolAdmission,
} from "../factories/tool-admission.ts";

unit(planToolAdmission, planToolAdmissionCases);
unit(cliToolAdmission, toolAdmissionCases);
unit(engineToolAdmission, toolAdmissionCases);
unit(mcpToolAdmission, mcpToolAdmissionCases);
unit(cliFallbackToolAdmission, cliFallbackToolAdmissionCases);

unit(httpToolAdmission, toolAdmissionCases);
