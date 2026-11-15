import { unit } from "@titan/test-factories";
import {
  artifactByteRangeCases,
  artifactListAliasCases,
  artifactMcpAdmissionCases,
  artifactReadHttpQueryCases,
  artifactReadResponseCases,
  artifactReadReviewCases,
  artifactReadSearchCases,
  artifactReadTransportCases,
} from "../cases/artifact-content.ts";
import {
  artifactByteRange,
  artifactListAlias,
  artifactMcpAdmission,
  artifactReadHttpQuery,
  artifactReadResponse,
  artifactReadReview,
  artifactReadSearch,
  artifactReadTransport,
} from "../factories/artifact-content.ts";

unit(artifactByteRange, artifactByteRangeCases);
unit(artifactMcpAdmission, artifactMcpAdmissionCases);
unit(artifactReadReview, artifactReadReviewCases);
unit(artifactReadTransport, artifactReadTransportCases);
unit(artifactReadResponse, artifactReadResponseCases);
unit(artifactReadSearch, artifactReadSearchCases);
unit(artifactListAlias, artifactListAliasCases);
unit(artifactReadHttpQuery, artifactReadHttpQueryCases);
