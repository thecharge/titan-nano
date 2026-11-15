import { unit } from "@titan/test-factories";
import {
  knowledgeAttemptAdmissionCases,
  knowledgeAttemptConflictCases,
  knowledgeAttemptFileCases,
  knowledgeAttemptValidationCases,
} from "../cases/knowledge-attempt-safety.ts";
import {
  knowledgeAttemptAdmission,
  knowledgeAttemptConflict,
  knowledgeAttemptFile,
  knowledgeAttemptValidation,
} from "../factories/knowledge-attempt-safety.ts";

unit(knowledgeAttemptAdmission, knowledgeAttemptAdmissionCases);
unit(knowledgeAttemptConflict, knowledgeAttemptConflictCases);
unit(knowledgeAttemptValidation, knowledgeAttemptValidationCases);
unit(knowledgeAttemptFile, knowledgeAttemptFileCases);
