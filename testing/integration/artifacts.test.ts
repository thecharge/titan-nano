import { unit } from "@titan/test-factories";
import {
  artifactInspectionCases,
  artifactResponseCases,
  artifactResultRecordCases,
  artifactReviewCases,
  dashboardArtifactDeliveryCases,
  dashboardConfigurationDeliveryCases,
} from "../cases/artifacts.ts";
import {
  artifactInspection,
  artifactResponseAdmission,
  artifactResultRecord,
  artifactReview,
  dashboardArtifactDelivery,
  dashboardConfigurationDelivery,
} from "../factories/artifacts.ts";

unit(artifactReview, artifactReviewCases);
unit(dashboardArtifactDelivery, dashboardArtifactDeliveryCases);
unit(dashboardConfigurationDelivery, dashboardConfigurationDeliveryCases);

unit(artifactInspection, artifactInspectionCases);

unit(artifactResponseAdmission, artifactResponseCases);

unit(artifactResultRecord, artifactResultRecordCases);
