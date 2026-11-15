import { unit } from "@titan/test-factories";
import {
  knowledgeCommitAdmissionCases,
  knowledgeCommitCorruptionCases,
  knowledgeCommitReceiptCases,
  knowledgeCommitRecoveryCases,
  knowledgeCommitRefusalCases,
  knowledgeCommitReplacementCases,
  knowledgeCommitRoundTripCases,
} from "../cases/knowledge-commit.ts";
import {
  knowledgeCommitAdmission,
  knowledgeCommitCorruption,
  knowledgeCommitReceipt,
  knowledgeCommitRecovery,
  knowledgeCommitRefusal,
  knowledgeCommitReplacement,
  knowledgeCommitRoundTrip,
} from "../factories/knowledge-commit.ts";

unit(knowledgeCommitRoundTrip, knowledgeCommitRoundTripCases);
unit(knowledgeCommitRefusal, knowledgeCommitRefusalCases);
unit(knowledgeCommitAdmission, knowledgeCommitAdmissionCases);
unit(knowledgeCommitReplacement, knowledgeCommitReplacementCases);
unit(knowledgeCommitRecovery, knowledgeCommitRecoveryCases);
unit(knowledgeCommitReceipt, knowledgeCommitReceiptCases);
unit(knowledgeCommitCorruption, knowledgeCommitCorruptionCases);
