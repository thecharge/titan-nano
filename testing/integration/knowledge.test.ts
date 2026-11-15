import { unit } from "@titan/test-factories";
import {
  knowledgeAdmissionCases,
  knowledgeFormatCases,
  knowledgeHubInputCases,
  knowledgeLiveConsistencyCases,
  knowledgeRecoveryCases,
  knowledgeRoundTripCases,
  knowledgeShutdownCases,
  knowledgeVersionCases,
} from "../cases/knowledge.ts";
import {
  knowledgeAdmission,
  knowledgeFormat,
  knowledgeHubInput,
  knowledgeLiveConsistency,
  knowledgeRecovery,
  knowledgeRoundTrip,
  knowledgeShutdown,
  knowledgeVersion,
} from "../factories/knowledge.ts";

unit(knowledgeRoundTrip, knowledgeRoundTripCases);
unit(knowledgeRecovery, knowledgeRecoveryCases);
unit(knowledgeVersion, knowledgeVersionCases);
unit(knowledgeAdmission, knowledgeAdmissionCases);
unit(knowledgeFormat, knowledgeFormatCases);
unit(knowledgeHubInput, knowledgeHubInputCases);
unit(knowledgeLiveConsistency, knowledgeLiveConsistencyCases);

unit(knowledgeShutdown, knowledgeShutdownCases);
