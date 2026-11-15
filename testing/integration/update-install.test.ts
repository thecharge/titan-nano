import { unit } from "@titan/test-factories";
import {
  automaticUpdateCases,
  updateAdmissionCases,
  updateInstallationCases,
  updateInterruptionCases,
  updateRecoveryCases,
  updateSourceBuildCases,
} from "../cases/update-install.ts";
import {
  automaticUpdate,
  updateAdmission,
  updateInstallation,
  updateInterruption,
  updateRecovery,
  updateSourceBuild,
} from "../factories/update-install.ts";

unit(updateInstallation, updateInstallationCases);
unit(updateSourceBuild, updateSourceBuildCases);
unit(automaticUpdate, automaticUpdateCases);
unit(updateRecovery, updateRecoveryCases);
unit(updateInterruption, updateInterruptionCases);
unit(updateAdmission, updateAdmissionCases);
