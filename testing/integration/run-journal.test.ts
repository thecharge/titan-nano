import { unit } from "@titan/test-factories";
import {
  runJournalBlockedCases,
  runJournalCancellationCases,
  runJournalCancelRetryCases,
  runJournalIdentityCases,
  runJournalNextCases,
  runJournalRecordCases,
  runJournalRecoveryCases,
  runJournalReplayCases,
} from "../cases/run-journal.ts";
import {
  runJournalBlocked,
  runJournalCancellation,
  runJournalIdentity,
  runJournalNext,
  runJournalRecord,
  runJournalRecovery,
} from "../factories/run-journal.ts";

unit(runJournalRecord, runJournalRecordCases);
unit(runJournalBlocked, runJournalBlockedCases);
unit(runJournalNext, runJournalNextCases);
unit(runJournalRecovery, runJournalRecoveryCases);
unit(runJournalRecovery, runJournalReplayCases);
unit(runJournalRecovery, runJournalCancelRetryCases);
unit(runJournalCancellation, runJournalCancellationCases);
unit(runJournalIdentity, runJournalIdentityCases);
