import { unit } from "@titan/test-factories";
import {
  knowledgeAttemptEmptyCases,
  knowledgeAttemptLoserCases,
  knowledgeAttemptRecoveryCases,
  knowledgeAttemptRevisionCases,
  knowledgeAttemptRoundTripCases,
} from "../cases/knowledge-attempts.ts";
import {
  knowledgeAttemptEmpty,
  knowledgeAttemptLoser,
  knowledgeAttemptRecovery,
  knowledgeAttemptRevision,
  knowledgeAttemptRoundTrip,
} from "../factories/knowledge-attempts.ts";

unit(knowledgeAttemptRoundTrip, knowledgeAttemptRoundTripCases);
unit(knowledgeAttemptRevision, knowledgeAttemptRevisionCases);
unit(knowledgeAttemptLoser, knowledgeAttemptLoserCases);
unit(knowledgeAttemptRecovery, knowledgeAttemptRecoveryCases);
unit(knowledgeAttemptEmpty, knowledgeAttemptEmptyCases);
