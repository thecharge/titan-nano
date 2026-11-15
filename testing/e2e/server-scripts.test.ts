import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import {
  goalProofProcessCases,
  scriptProcessCases,
  scriptProofProcessCases,
} from "../cases/server-scripts.ts";
import {
  goalProofProcess,
  scriptProcess,
  scriptProofProcess,
} from "../factories/server-scripts.ts";

unit(scriptProcess, scriptProcessCases, undefined, TestSchedule.Concurrent);

unit(scriptProofProcess, scriptProofProcessCases, undefined, TestSchedule.Concurrent);

unit(goalProofProcess, goalProofProcessCases, undefined, TestSchedule.Concurrent);
