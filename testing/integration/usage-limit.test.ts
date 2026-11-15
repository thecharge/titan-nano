import { limitDelay, minutesLeft } from "@titan/core";
import { parseResumeBackend } from "@titan/server/client";
import { unit } from "@titan/test-factories";
import { limitUntil } from "../../apps/cli/src/limit-wait.ts";
import {
  cliResumeCases,
  limitAutomaticCases,
  limitDelayCases,
  limitRecordCases,
  limitSwitchCases,
  limitUntilCases,
  minutesLeftCases,
  resumeBackendCases,
} from "../cases/usage-limit.ts";
import { cliResume, limitRun } from "../factories/usage-limit.ts";

unit(limitDelay, limitDelayCases);
unit(minutesLeft, minutesLeftCases);
unit(limitUntil, limitUntilCases);
unit(parseResumeBackend, resumeBackendCases);
unit(cliResume, cliResumeCases);
unit(limitRun, limitRecordCases);
unit(limitRun, limitAutomaticCases);
unit(limitRun, limitSwitchCases);
