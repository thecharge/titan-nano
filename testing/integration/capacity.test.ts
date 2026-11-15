import { unit } from "@titan/test-factories";
import {
  capacityAdmissionCases,
  capacityBudgetCases,
  capacityFairnessCases,
  capacityOverlapCases,
  capacityRunRecoveryCases,
  capacitySettingsCases,
  configuredAgentCapacityCases,
} from "../cases/capacity.ts";
import {
  capacityAdmission,
  capacityBudget,
  capacityFairness,
  capacityOverlap,
  capacityRunRecovery,
  capacitySettings,
  configuredAgentCapacity,
} from "../factories/capacity.ts";

unit(capacitySettings, capacitySettingsCases);
unit(capacityBudget, capacityBudgetCases);
unit(capacityOverlap, capacityOverlapCases);
unit(configuredAgentCapacity, configuredAgentCapacityCases);
unit(capacityRunRecovery, capacityRunRecoveryCases);
unit(capacityAdmission, capacityAdmissionCases);
unit(capacityFairness, capacityFairnessCases);
