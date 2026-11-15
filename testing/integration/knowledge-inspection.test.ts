import { unit } from "@titan/test-factories";
import {
  inspectionAdmissionCases,
  knowledgeInspectionCases,
  missingInspectionCases,
} from "../cases/knowledge-inspection.ts";
import {
  inspectionAdmission,
  knowledgeInspection,
  missingInspection,
} from "../factories/knowledge-inspection.ts";

unit(knowledgeInspection, knowledgeInspectionCases);
unit(missingInspection, missingInspectionCases);

unit(inspectionAdmission, inspectionAdmissionCases);
