import { unit } from "@titan/test-factories";
import {
  codeOutcomeCases,
  cookieSessionCases,
  dashboardArtifactQueryCases,
  dashboardConfigurationQueryCases,
  dashboardFallbackCases,
  dashboardListQueryCases,
  dashboardRunDetailsCases,
  mintedCodeCases,
  packedDashboardAssetsCases,
  rewrittenSourceCases,
  sessionRetentionCases,
  sessionValidCases,
  stepReportCases,
  streamedIdCases,
} from "../cases/dashboard-unit.ts";
import {
  codeOutcome,
  cookieSession,
  dashboardArtifactQuery,
  dashboardConfigurationQuery,
  dashboardFallback,
  dashboardListQuery,
  dashboardRunDetails,
  mintedCodes,
  packedDashboardAssets,
  rewrittenSources,
  sessionRetention,
  sessionValid,
  stepReport,
  streamedIds,
} from "../factories/dashboard-unit.ts";

unit(codeOutcome, codeOutcomeCases);
unit(dashboardArtifactQuery, dashboardArtifactQueryCases);
unit(dashboardConfigurationQuery, dashboardConfigurationQueryCases);
unit(packedDashboardAssets, packedDashboardAssetsCases);
unit(dashboardListQuery, dashboardListQueryCases);
unit(dashboardRunDetails, dashboardRunDetailsCases);
unit(dashboardFallback, dashboardFallbackCases);

unit(mintedCodes, mintedCodeCases);

unit(sessionValid, sessionValidCases);
unit(sessionRetention, sessionRetentionCases);

unit(cookieSession, cookieSessionCases);

unit(rewrittenSources, rewrittenSourceCases);

unit(streamedIds, streamedIdCases);

unit(stepReport, stepReportCases);
