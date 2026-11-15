import { unit } from "@titan/test-factories";
import {
  personaHistoryRecoveryCases,
  personaHistoryReplayCases,
  personaHistoryWithoutTotalsCases,
  personaLaterResultCases,
  personaLegacyQualityCases,
  personaLifecycleDeliveryCases,
  personaProductionLifecycleCases,
  personaProductionSplitHistoryCases,
  personaSamplingCases,
  personaTerminalHistoryRecoveryCases,
  personaUsageProductionCases,
  personaUsageReplayCases,
} from "../cases/persona-quality.ts";
import {
  personaHistoryRecovery,
  personaHistoryReplay,
  personaHistoryWithoutTotals,
  personaLaterResult,
  personaLegacyQuality,
  personaLifecycleDelivery,
  personaProductionLifecycle,
  personaProductionSplitHistory,
  personaTerminalHistoryRecovery,
} from "../factories/persona-quality.ts";
import { personaSampling } from "../factories/persona-sampling.ts";
import { personaUsageProduction, personaUsageReplay } from "../factories/persona-usage.ts";

unit(personaHistoryRecovery, personaHistoryRecoveryCases);
unit(personaProductionSplitHistory, personaProductionSplitHistoryCases);
unit(personaHistoryReplay, personaHistoryReplayCases);
unit(personaTerminalHistoryRecovery, personaTerminalHistoryRecoveryCases);
unit(personaLegacyQuality, personaLegacyQualityCases);
unit(personaHistoryWithoutTotals, personaHistoryWithoutTotalsCases);
unit(personaProductionLifecycle, personaProductionLifecycleCases);
unit(personaLifecycleDelivery, personaLifecycleDeliveryCases);
unit(personaLaterResult, personaLaterResultCases);
unit(personaUsageProduction, personaUsageProductionCases);
unit(personaUsageReplay, personaUsageReplayCases);
unit(personaSampling, personaSamplingCases);
