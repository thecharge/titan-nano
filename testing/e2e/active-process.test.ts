import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import {
  activeProcessRecoveryCases,
  processStateErrorCases,
  processStateEvidenceCases,
} from "../cases/active-process.ts";
import {
  activeProcessRecovery,
  processStateError,
  processStateEvidence,
} from "../factories/active-process.ts";

unit(activeProcessRecovery, activeProcessRecoveryCases, undefined, TestSchedule.Concurrent);
unit(processStateEvidence, processStateEvidenceCases, undefined, TestSchedule.Concurrent);
unit(processStateError, processStateErrorCases, undefined, TestSchedule.Concurrent);
