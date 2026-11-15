import { unit } from "@titan/test-factories";
import {
  renderedArtifactCases,
  renderedCapacityCases,
  renderedConfigurationCases,
  renderedDashboardFiltersCases,
  renderedDashboardInteractionCases,
  renderedDashboardPaginationCases,
  renderedDashboardRecoveryCases,
  renderedPageCases,
  renderedRunDetailsCases,
} from "../cases/dashboard-unit.ts";
import {
  renderedArtifact,
  renderedCapacity,
  renderedConfiguration,
  renderedDashboardFilters,
  renderedDashboardInteraction,
  renderedDashboardPagination,
  renderedDashboardRecovery,
  renderedPage,
  renderedRunDetails,
} from "../factories/dashboard-page.ts";

unit(renderedPage, renderedPageCases);
unit(renderedArtifact, renderedArtifactCases);
unit(renderedConfiguration, renderedConfigurationCases);
unit(renderedDashboardPagination, renderedDashboardPaginationCases);
unit(renderedRunDetails, renderedRunDetailsCases);
unit(renderedCapacity, renderedCapacityCases);
unit(renderedDashboardFilters, renderedDashboardFiltersCases);

import { renderedKnowledgeCases, renderedPendingCases } from "../cases/dashboard-knowledge-page.ts";
import { renderedKnowledge, renderedPending } from "../factories/dashboard-page.ts";

unit(renderedKnowledge, renderedKnowledgeCases);

unit(renderedPending, renderedPendingCases);

unit(renderedDashboardRecovery, renderedDashboardRecoveryCases);

unit(renderedDashboardInteraction, renderedDashboardInteractionCases);
