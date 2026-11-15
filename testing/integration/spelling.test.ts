import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import {
  spellingAdmissionCases,
  spellingBatchCases,
  spellingCheckCases,
} from "../cases/spelling.ts";
import { spellingAdmission, spellingBatchCheck, spellingCheck } from "../factories/spelling.ts";

unit(spellingCheck, spellingCheckCases, undefined, TestSchedule.Concurrent);
unit(spellingAdmission, spellingAdmissionCases, undefined, TestSchedule.Concurrent);
unit(spellingBatchCheck, spellingBatchCases, undefined, TestSchedule.Concurrent);
